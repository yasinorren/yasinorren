'use strict';

/* ── shared token state ── */
let _accessToken  = null;
let _refreshToken = null;

/* ══════════════════════════════════════════════════════════
   E2EE — ECDH P-256 + AES-GCM-256
   Server is zero-knowledge; stores only opaque ciphertext.
══════════════════════════════════════════════════════════ */
const E2EE = (() => {
  const sub = window.crypto.subtle;

  function b64ToBytes(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function bytesToB64(buf) {
    const u = new Uint8Array(buf); let s = '';
    for (const b of u) s += String.fromCharCode(b);
    return btoa(s);
  }

  async function genKeyPair() {
    return sub.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
  }
  async function exportPubRaw(kp)  { return bytesToB64(await sub.exportKey('raw', kp.publicKey)); }
  async function exportPrivJWK(kp) { return sub.exportKey('jwk', kp.privateKey); }
  async function importPubRaw(b64) {
    return sub.importKey('raw', b64ToBytes(b64), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  }
  async function importPrivJWK(jwk) {
    return sub.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey']);
  }
  async function deriveAES(privKey, theirPub) {
    return sub.deriveKey(
      { name: 'ECDH', public: theirPub }, privKey,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }

  async function encrypt(aesKey, plaintext) {
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const ct  = await sub.encrypt({ name: 'AES-GCM', iv }, aesKey, new TextEncoder().encode(plaintext));
    const out = new Uint8Array(12 + ct.byteLength);
    out.set(iv); out.set(new Uint8Array(ct), 12);
    return bytesToB64(out.buffer);
  }
  async function decrypt(aesKey, b64) {
    const d  = b64ToBytes(b64);
    const pt = await sub.decrypt({ name: 'AES-GCM', iv: d.slice(0, 12) }, aesKey, d.slice(12));
    return new TextDecoder().decode(pt);
  }

  function lsKey(uid) { return `tw_kp_${uid}`; }

  async function init(uid) {
    const raw = localStorage.getItem(lsKey(uid));
    if (raw) {
      try {
        const { priv, pub } = JSON.parse(raw);
        const privKey = await importPrivJWK(priv);
        const pubKey  = await importPubRaw(pub);
        return { privateKey: privKey, publicKey: pubKey, _pubB64: pub };
      } catch (_) { localStorage.removeItem(lsKey(uid)); }
    }
    const kp   = await genKeyPair();
    const pub  = await exportPubRaw(kp);
    const priv = await exportPrivJWK(kp);
    localStorage.setItem(lsKey(uid), JSON.stringify({ priv, pub }));
    kp._pubB64 = pub;
    return kp;
  }

  async function getSharedKey(myKP, theirB64) {
    const theirKey = await importPubRaw(theirB64);
    return deriveAES(myKP.privateKey, theirKey);
  }

  return { init, exportPubRaw, getSharedKey, encrypt, decrypt };
})();


/* ══════════════════════════════════════════════════════════
   API CLIENT  (JWT auto-refresh + queue)
══════════════════════════════════════════════════════════ */
const API = (() => {
  let _refreshing = false;
  let _queue = [];

  function setTokens(a, r) {
    _accessToken  = a;
    if (r) { _refreshToken = r; localStorage.setItem('tw_rf', r); }
    if (a) localStorage.setItem('tw_ac', a);
  }
  function clearTokens() {
    _accessToken = _refreshToken = null;
    localStorage.removeItem('tw_rf');
    localStorage.removeItem('tw_ac');
  }

  async function _req(method, url, body, retry) {
    const headers = { 'Content-Type': 'application/json' };
    if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);

    if (res.status === 401 && !retry && _refreshToken) {
      const d = await res.clone().json().catch(() => ({}));
      if (d.code === 'TOKEN_EXPIRED') {
        if (_refreshing) {
          await new Promise(r => _queue.push(r));
          return _req(method, url, body, true);
        }
        _refreshing = true;
        try {
          const r2 = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: _refreshToken }),
          });
          if (r2.ok) {
            const tk = await r2.json();
            setTokens(tk.access_token, tk.refresh_token || _refreshToken);
          } else {
            clearTokens();
            App.auth.logout();
            throw new Error('Session expired');
          }
        } finally {
          _refreshing = false;
          _queue.forEach(fn => fn());
          _queue = [];
        }
        return _req(method, url, body, true);
      }
    }
    return res;
  }

  async function json(method, url, body) {
    const res = await _req(method, url, body);
    if (!res.ok) {
      const e = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(e.error || 'Request failed');
    }
    return res.json();
  }

  return {
    setTokens, clearTokens,
    get:   (u)    => _req('GET',    u),
    post:  (u, b) => _req('POST',   u, b),
    put:   (u, b) => _req('PUT',    u, b),
    del:   (u, b) => _req('DELETE', u, b),
    json,
  };
})();


/* ══════════════════════════════════════════════════════════
   WEBSOCKET
══════════════════════════════════════════════════════════ */
const WS = (() => {
  let ws = null, subConvId = null;
  const handlers = {};

  function on(type, fn) { handlers[type] = fn; }

  function connect() {
    const token = _accessToken;
    if (!token) return;
    if (ws && ws.readyState <= 1) ws.close();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}`);
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'auth', token }));
      if (subConvId) ws.send(JSON.stringify({ type: 'subscribe', conversation_id: subConvId }));
    };
    ws.onmessage = e => {
      try { const msg = JSON.parse(e.data); if (handlers[msg.type]) handlers[msg.type](msg); } catch (_) {}
    };
    ws.onclose = () => setTimeout(() => { if (_accessToken) connect(); }, 3000);
  }

  function subscribe(cid) {
    subConvId = cid;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'subscribe', conversation_id: cid }));
  }

  function unsubscribe() {
    subConvId = null;
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'unsubscribe' }));
  }

  return { on, connect, subscribe, unsubscribe };
})();


/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (s < 60)      return 'now';
  if (s < 3600)    return `${Math.floor(s / 60)}m`;
  if (s < 86400)   return `${Math.floor(s / 3600)}h`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d`;
  return new Date(ts).toLocaleDateString();
}
function numFmt(n) {
  n = n || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function mkInitials(letter, size) {
  const cols = ['#7B61FF', '#FF61AB', '#00F5D4', '#FF9F40', '#4BC0C8'];
  const c = cols[letter.charCodeAt(0) % cols.length];
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${c};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${Math.round(size * 0.4)}px;color:#fff;flex-shrink:0;">${letter}</div>`;
}
function avatar(user, size) {
  size = size || 40;
  const letter = ((user && (user.display_name || user.username)) || '?')[0].toUpperCase();
  if (user && user.avatar_url)
    return `<img src="${esc(user.avatar_url)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.outerHTML=mkInitials('${letter}',${size})">`;
  return mkInitials(letter, size);
}
function formatContent(text) {
  if (!text) return '';
  return esc(text)
    .replace(/#(\w+)/g, '<span class="hash-tag" onclick="App.explore.tag(\'$1\')">#$1</span>')
    .replace(/@(\w+)/g, '<span class="mention-tag" onclick="App.profile.goUser(\'$1\')">@$1</span>')
    .replace(/\n/g, '<br>');
}
function spawnHearts(btn) {
  const r = btn.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const emojis = ['❤️', '💜', '💗', '✨', '⭐'];
  for (let i = 0; i < 8; i++) {
    const p   = document.createElement('div');
    p.className = 'like-particle';
    const ang = (360 / 8) * i + Math.random() * 20;
    const d   = 30 + Math.random() * 30;
    p.style.cssText = `left:${cx}px;top:${cy}px;--dx:${Math.cos(ang * Math.PI / 180) * d}px;--dy:${Math.sin(ang * Math.PI / 180) * d}px;`;
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}


/* ══════════════════════════════════════════════════════════
   APP
══════════════════════════════════════════════════════════ */
const App = (() => {

  /* ── state ── */
  const S = {
    user: null,
    keyPair: null,
    sharedKeys: {},
    peerPubs: {},
    currentScreen: 'home',
    screenStack: [],
    feedPage: 0,
    feedDone: false,
    feedLoading: false,
    notifCount: 0,
    storyGroups: [],
    storyUI: 0,
    storyII: 0,
    storyTimer: null,
    convId: null,
    convOther: null,
    msgBefore: null,
    msgLoading: false,
    commentPostId: null,
    mediaFiles: [],
  };

  /* ── toast ── */
  function toast(msg, dur) {
    dur = dur || 3000;
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.classList.add('hidden'), 300);
    }, dur);
  }

  /* ─────────────── AUTH ─────────────── */
  const auth = {
    showLogin() {
      document.getElementById('auth-login').classList.remove('hidden');
      document.getElementById('auth-register').classList.add('hidden');
    },
    showReg() {
      document.getElementById('auth-login').classList.add('hidden');
      document.getElementById('auth-register').classList.remove('hidden');
    },
    async login() {
      const id   = document.getElementById('li-id').value.trim();
      const pw   = document.getElementById('li-pw').value;
      const totp = document.getElementById('li-totp').value.trim();
      const err  = document.getElementById('li-err');
      err.classList.add('hidden');
      try {
        const body = { identifier: id, password: pw };
        if (totp) body.totp_code = totp;
        const res  = await API.post('/api/auth/login', body);
        const data = await res.json();
        if (data.two_fa_required) {
          document.getElementById('li-2fa').classList.remove('hidden');
          document.getElementById('li-totp').focus();
          return;
        }
        if (!res.ok) { err.textContent = data.error || 'Login failed'; err.classList.remove('hidden'); return; }
        await _boot(data);
      } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
    },
    async register() {
      const name  = document.getElementById('rg-name').value.trim();
      const uname = document.getElementById('rg-user').value.trim();
      const email = document.getElementById('rg-email').value.trim();
      const pw    = document.getElementById('rg-pw').value;
      const err   = document.getElementById('rg-err');
      err.classList.add('hidden');
      try {
        const res  = await API.post('/api/auth/register', { display_name: name, username: uname, email, password: pw });
        const data = await res.json();
        if (!res.ok) { err.textContent = data.error || 'Registration failed'; err.classList.remove('hidden'); return; }
        await _boot(data);
      } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
    },
    logout() {
      API.post('/api/auth/logout', { refresh_token: _refreshToken }).catch(() => {});
      API.clearTokens();
      S.user = null; S.keyPair = null; S.sharedKeys = {}; S.peerPubs = {};
      document.getElementById('app').classList.add('hidden');
      document.getElementById('auth-screen').classList.remove('hidden');
      auth.showLogin();
    },
  };

  async function _boot(data) {
    API.setTokens(data.access_token, data.refresh_token);
    S.user = data.user;
    try {
      S.keyPair = await E2EE.init(S.user.id);
      const pub = S.keyPair._pubB64 || await E2EE.exportPubRaw(S.keyPair);
      S.keyPair._pubB64 = pub;
      await API.json('PUT', '/api/auth/public-key', { public_key: pub });
    } catch (e) { console.warn('E2EE init:', e); }
    WS.connect();
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    _updateNavAv();
    nav.go('home');
    _pollNotifs();
    feed.load(true);
    stories.load();
  }

  function _updateNavAv() {
    if (!S.user) return;
    document.getElementById('nav-av').innerHTML = avatar(S.user, 26);
  }

  /* ─────────────── NAV ─────────────── */
  const SUB = new Set(['search', 'post', 'userprofile', 'conv', 'settings', 'editprofile', '2fa']);
  const TITLES = { search: 'Search', post: 'Post', userprofile: 'Profile', conv: '', settings: 'Settings', editprofile: 'Edit Profile', '2fa': 'Two-Factor Auth' };

  const nav = {
    go(screen, data) {
      const prev = S.currentScreen;
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      const el = document.getElementById('sc-' + screen);
      if (!el) return;
      el.classList.add('active');
      S.currentScreen = screen;

      const back  = document.getElementById('topbar-back');
      const title = document.getElementById('topbar-title');
      const logo  = document.getElementById('topbar-logo');
      const right = document.getElementById('topbar-right');
      const bnav  = document.getElementById('bottomnav');

      if (SUB.has(screen)) {
        S.screenStack.push(prev);
        back.classList.remove('hidden'); logo.classList.add('hidden');
        title.classList.remove('hidden'); title.textContent = TITLES[screen] || '';
        right.style.visibility = 'hidden';
        bnav.style.transform = 'translateY(100%)';
      } else {
        S.screenStack = [];
        back.classList.add('hidden'); logo.classList.remove('hidden');
        title.classList.add('hidden');
        right.style.visibility = '';
        bnav.style.transform = '';
        document.querySelectorAll('.nav-item[data-tab]').forEach(b =>
          b.classList.toggle('active', b.dataset.tab === screen));
        _moveIndicator(screen);
      }
      _loadScreen(screen, data);
    },
    back() { nav.go(S.screenStack.pop() || 'home'); },
  };

  function _moveIndicator(tab) {
    const btn = document.querySelector('.nav-item[data-tab="' + tab + '"]');
    const ind = document.getElementById('nav-indicator');
    if (!btn || !ind) return;
    const br = btn.getBoundingClientRect();
    const nr = document.getElementById('bottomnav').getBoundingClientRect();
    ind.style.transform = 'translateX(' + (br.left - nr.left + br.width / 2 - 20) + 'px)';
  }

  function _loadScreen(screen, data) {
    switch (screen) {
      case 'home':          feed.load(true); stories.load(); break;
      case 'explore':       explore.load();  break;
      case 'notifications': notifications.load(); break;
      case 'profile':       profile.loadOwn(); break;
      case 'chat':          chatList.load(); break;
      case 'search':        setTimeout(() => { const q = document.getElementById('search-q'); if (q) q.focus(); }, 80); break;
      case 'userprofile':   if (data) profile.loadUser(data); break;
      case 'conv':          if (data) chatConv.open(data); break;
      case 'settings':      settings.load(); break;
      case 'editprofile':   editProfile.load(); break;
      case '2fa':           twofa.load(); break;
    }
  }

  /* ─────────────── FEED ─────────────── */
  const feed = {
    async load(reset) {
      if (S.feedLoading) return;
      if (!reset && S.feedDone) return;
      S.feedLoading = true;
      const spin = document.getElementById('feed-spinner');
      spin.classList.remove('hidden');
      if (reset) { S.feedPage = 0; S.feedDone = false; document.getElementById('feed-list').innerHTML = ''; }
      try {
        const data = await API.json('GET', '/api/feed/home?page=' + S.feedPage);
        const posts = data.posts || [];
        S.feedPage++;
        if (!posts.length) S.feedDone = true;
        posts.forEach(p => renderPost(p, document.getElementById('feed-list')));
      } catch (e) { toast(e.message); }
      finally { S.feedLoading = false; spin.classList.add('hidden'); }
    },
  };

  function renderPost(p, container, prepend) {
    const div   = document.createElement('div');
    div.className = 'post-card';
    div.dataset.postId = p.id;
    const liked = !!p.is_liked, bmed = !!p.is_bookmarked;
    div.innerHTML =
      '<div class="post-header">' +
        '<div class="post-av" onclick="App.profile.goUser(\'' + esc(p.username) + '\')">' + avatar(p, 42) + '</div>' +
        '<div class="post-meta">' +
          '<div class="post-name-row">' +
            '<span class="post-username" onclick="App.profile.goUser(\'' + esc(p.username) + '\')">' + esc(p.display_name || p.username) + '</span>' +
            (p.is_verified ? '<svg class="verified-ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#7B61FF"/><path d="M8 12l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') +
          '</div>' +
          '<span class="post-handle">@' + esc(p.username) + ' · ' + timeAgo(p.created_at) + '</span>' +
        '</div>' +
        '<button class="post-more-btn" onclick="App.post.more(' + p.id + ',\'' + esc(p.username) + '\')">⋯</button>' +
      '</div>' +
      '<div class="post-content">' + formatContent(p.content) + '</div>' +
      _mediaHtml(p) +
      '<div class="post-actions">' +
        '<button class="pa-btn' + (liked ? ' liked' : '') + '" id="lbtn-' + p.id + '" onclick="App.post.toggleLike(' + p.id + ',this)">' +
          '<svg viewBox="0 0 24 24" fill="' + (liked ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' +
          '<span id="lcnt-' + p.id + '">' + numFmt(p.like_count) + '</span>' +
        '</button>' +
        '<button class="pa-btn" onclick="App.comments.open(' + p.id + ')">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
          '<span>' + numFmt(p.comment_count) + '</span>' +
        '</button>' +
        '<button class="pa-btn" onclick="App.post.share(' + p.id + ')">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
        '</button>' +
        '<button class="pa-btn' + (bmed ? ' bookmarked' : '') + '" id="bbtn-' + p.id + '" onclick="App.post.toggleBookmark(' + p.id + ',this)">' +
          '<svg viewBox="0 0 24 24" fill="' + (bmed ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>' +
        '</button>' +
      '</div>';
    if (prepend) container.prepend(div);
    else container.appendChild(div);
  }

  function _mediaHtml(p) {
    if (!p.media_urls) return '';
    var urls; try { urls = JSON.parse(p.media_urls); } catch (_) { return ''; }
    if (!urls || !urls.length) return '';
    if (urls.length === 1) {
      var u = urls[0];
      return u.match(/\.(mp4|webm|mov)$/i)
        ? '<video class="post-media" src="' + u + '" controls playsinline></video>'
        : '<img class="post-media" src="' + u + '" alt="" loading="lazy" onclick="App.lightbox(\'' + u + '\')">';
    }
    return '<div class="post-media-grid">' + urls.map(function(u) {
      return '<img src="' + u + '" loading="lazy" alt="" onclick="App.lightbox(\'' + u + '\')">';
    }).join('') + '</div>';
  }

  /* ─────────────── STORIES ─────────────── */
  const stories = {
    async load() {
      try {
        const data   = await API.json('GET', '/api/feed/stories');
        const groups = data.stories || [];
        S.storyGroups = groups;
        const strip = document.getElementById('stories-strip');
        const add   = strip.querySelector('.add-story');
        strip.innerHTML = '';
        strip.appendChild(add);
        groups.forEach(function(g, i) {
          const chip = document.createElement('div');
          chip.className = 'story-chip';
          chip.onclick = function() { stories.view(i); };
          chip.innerHTML =
            '<div class="story-ring-wrap ' + (g.has_unviewed ? 'has-story' : 'seen-story') + '">' +
              '<div class="story-av-shell">' + avatar(g, 52) + '</div>' +
            '</div>' +
            '<span>' + esc(g.display_name || g.username) + '</span>';
          strip.appendChild(chip);
        });
      } catch (_) {}
    },
    view(ui) {
      if (!S.storyGroups.length) return;
      S.storyUI = ui; S.storyII = 0;
      document.getElementById('modal-story').classList.remove('hidden');
      stories._show();
    },
    _show() {
      const g = S.storyGroups[S.storyUI];
      if (!g || !g.items || !g.items.length) { stories.close(); return; }
      const s = g.items[S.storyII];
      document.getElementById('story-segs').innerHTML = g.items.map(function(_, i) {
        return '<div class="story-seg' + (i < S.storyII ? ' done' : i === S.storyII ? ' active' : '') + '"><div class="seg-fill"></div></div>';
      }).join('');
      document.getElementById('story-vuser').innerHTML =
        avatar(g, 36) +
        '<div><span class="sv-name">' + esc(g.display_name || g.username) + '</span>' +
        '<span class="sv-time"> ' + timeAgo(s.created_at) + '</span></div>';
      const body = document.getElementById('story-vbody');
      if (s.media_url && s.media_url.match(/\.(mp4|webm)$/i))
        body.innerHTML = '<video class="sv-media" src="' + s.media_url + '" autoplay muted playsinline loop></video>';
      else if (s.media_url)
        body.innerHTML = '<img class="sv-media" src="' + s.media_url + '" alt="">';
      else
        body.innerHTML = '<div class="sv-text-story">' + esc(s.content || '') + '</div>';
      clearTimeout(S.storyTimer);
      S.storyTimer = setTimeout(function() { stories.next(); }, (s.duration || 5) * 1000);
    },
    next() {
      const g = S.storyGroups[S.storyUI];
      if (S.storyII < ((g && g.items && g.items.length) || 0) - 1) { S.storyII++; stories._show(); }
      else if (S.storyUI < S.storyGroups.length - 1) { S.storyUI++; S.storyII = 0; stories._show(); }
      else stories.close();
    },
    prev() {
      if (S.storyII > 0) { S.storyII--; stories._show(); }
      else if (S.storyUI > 0) { S.storyUI--; S.storyII = 0; stories._show(); }
    },
    close() { clearTimeout(S.storyTimer); document.getElementById('modal-story').classList.add('hidden'); },
    showCreate() { toast('Story creation coming soon!'); },
  };

  /* ─────────────── POST ─────────────── */
  const post = {
    async toggleLike(postId, btn) {
      const was = btn.classList.contains('liked');
      const cnt = document.getElementById('lcnt-' + postId);
      const n   = parseInt(cnt.textContent) || 0;
      btn.classList.toggle('liked');
      btn.querySelector('svg').setAttribute('fill', was ? 'none' : 'currentColor');
      if (!was) spawnHearts(btn);
      cnt.textContent = numFmt(was ? Math.max(0, n - 1) : n + 1);
      try {
        if (was) await API.del('/api/posts/' + postId + '/like');
        else     await API.post('/api/posts/' + postId + '/like');
      } catch (e) {
        btn.classList.toggle('liked');
        btn.querySelector('svg').setAttribute('fill', was ? 'currentColor' : 'none');
        cnt.textContent = numFmt(n);
        toast(e.message);
      }
    },
    async toggleBookmark(postId, btn) {
      const was = btn.classList.contains('bookmarked');
      btn.classList.toggle('bookmarked');
      btn.querySelector('svg').setAttribute('fill', was ? 'none' : 'currentColor');
      try {
        if (was) await API.del('/api/posts/' + postId + '/bookmark');
        else     await API.post('/api/posts/' + postId + '/bookmark');
        toast(was ? 'Removed from bookmarks' : 'Bookmarked!');
      } catch (e) {
        btn.classList.toggle('bookmarked');
        btn.querySelector('svg').setAttribute('fill', was ? 'currentColor' : 'none');
        toast(e.message);
      }
    },
    showCreate() {
      document.getElementById('modal-create').classList.remove('hidden');
      document.getElementById('post-ta').value = '';
      document.getElementById('post-char').textContent = '5000';
      document.getElementById('media-preview-row').innerHTML = '';
      S.mediaFiles = [];
      document.getElementById('create-user-row').innerHTML =
        avatar(S.user, 40) +
        '<div><strong>' + esc(S.user.display_name || S.user.username) + '</strong>' +
        '<span class="sub-text"> @' + esc(S.user.username) + '</span></div>';
      setTimeout(function() { document.getElementById('post-ta').focus(); }, 80);
    },
    closeCreate() { document.getElementById('modal-create').classList.add('hidden'); },
    onInput()     { document.getElementById('post-char').textContent = 5000 - document.getElementById('post-ta').value.length; },
    addMedia(e) {
      S.mediaFiles.push.apply(S.mediaFiles, Array.from(e.target.files));
      const row = document.getElementById('media-preview-row');
      row.innerHTML = '';
      S.mediaFiles.forEach(function(f, i) {
        const u = URL.createObjectURL(f);
        const d = document.createElement('div');
        d.className = 'media-prev-item';
        d.innerHTML = (f.type.startsWith('video') ? '<video src="' + u + '" class="media-thumb"></video>' : '<img src="' + u + '" class="media-thumb">') +
          '<button class="media-remove" onclick="App.post._rmMedia(' + i + ')">×</button>';
        row.appendChild(d);
      });
    },
    _rmMedia(i) { S.mediaFiles.splice(i, 1); post.addMedia({ target: { files: [] } }); },
    async submit() {
      const content = document.getElementById('post-ta').value.trim();
      const vis     = document.getElementById('post-vis').value;
      if (!content && !S.mediaFiles.length) { toast('Write something first!'); return; }
      const btn = document.getElementById('post-submit-btn');
      btn.disabled = true; btn.textContent = 'Posting…';
      try {
        const mediaUrls = [];
        for (var i = 0; i < S.mediaFiles.length; i++) {
          const fd = new FormData(); fd.append('media', S.mediaFiles[i]);
          const r  = await fetch('/api/upload/media', { method: 'POST', headers: { Authorization: 'Bearer ' + _accessToken }, body: fd });
          if (r.ok) { const d = await r.json(); mediaUrls.push(d.url); }
        }
        const data = await API.json('POST', '/api/posts', { content: content, visibility: vis, media_urls: mediaUrls.length ? mediaUrls : undefined });
        post.closeCreate();
        toast('Posted!');
        renderPost(data.post, document.getElementById('feed-list'), true);
      } catch (e) { toast(e.message); }
      finally { btn.disabled = false; btn.textContent = 'Post'; }
    },
    more(postId, username) {
      const isOwn = S.user && S.user.username === username;
      actionSheet(isOwn
        ? [{ label: '🗑️ Delete post', action: function() { post._delete(postId); } }]
        : [{ label: '🚩 Report post', action: function() { post._report(postId); } },
           { label: '👤 View @' + username, action: function() { profile.goUser(username); } }]);
    },
    async _delete(postId) {
      try {
        await API.json('DELETE', '/api/posts/' + postId);
        const c = document.querySelector('[data-post-id="' + postId + '"]');
        if (c) { c.style.opacity = '0'; c.style.transition = 'opacity .3s'; setTimeout(function() { c.remove(); }, 300); }
        toast('Deleted.');
      } catch (e) { toast(e.message); }
    },
    async _report(postId) {
      try { await API.post('/api/posts/' + postId + '/report', { reason: 'spam' }); toast('Reported. Thank you.'); }
      catch (e) { toast(e.message); }
    },
    share(postId) {
      const url = location.origin + '/post/' + postId;
      if (navigator.share) navigator.share({ url: url });
      else navigator.clipboard.writeText(url).then(function() { toast('Link copied!'); });
    },
    async openDetail(postId) {
      try {
        const data = await API.json('GET', '/api/posts/' + postId);
        const cont = document.getElementById('post-detail-content');
        cont.innerHTML = '';
        renderPost(data.post, cont);
        nav.go('post');
      } catch (e) { toast(e.message); }
    },
  };

  /* ─────────────── COMMENTS ─────────────── */
  const comments = {
    async open(postId) {
      S.commentPostId = postId;
      document.getElementById('modal-comments').classList.remove('hidden');
      document.getElementById('comment-av-me').innerHTML = avatar(S.user, 36);
      await comments._load();
    },
    async _load() {
      try {
        const data = await API.json('GET', '/api/posts/' + S.commentPostId + '/comments');
        const list = document.getElementById('comments-list');
        list.innerHTML = '';
        (data.comments || []).forEach(function(c) {
          const el = document.createElement('div');
          el.className = 'comment-item';
          el.innerHTML =
            '<div class="comment-av">' + avatar(c, 34) + '</div>' +
            '<div class="comment-body">' +
              '<span class="comment-name">' + esc(c.display_name || c.username) + '</span>' +
              '<span class="comment-handle"> @' + esc(c.username) + '</span>' +
              '<p class="comment-text">' + formatContent(c.content) + '</p>' +
              '<span class="comment-time">' + timeAgo(c.created_at) + '</span>' +
            '</div>';
          list.appendChild(el);
        });
      } catch (_) {}
    },
    async submit() {
      const inp = document.getElementById('comment-inp');
      const txt = inp.value.trim();
      if (!txt) return;
      inp.value = '';
      try { await API.json('POST', '/api/posts/' + S.commentPostId + '/comments', { content: txt }); await comments._load(); }
      catch (e) { toast(e.message); }
    },
    close() { document.getElementById('modal-comments').classList.add('hidden'); },
  };

  /* ─────────────── EXPLORE ─────────────── */
  const explore = {
    _t: null,
    debounce() { clearTimeout(explore._t); explore._t = setTimeout(function() { explore._search(); }, 300); },
    async load() {
      try {
        const trend = await API.json('GET', '/api/feed/trending');
        const grid  = await API.json('GET', '/api/feed/explore');
        const tags  = trend.tags || [];
        document.getElementById('exp-trending').innerHTML = tags.length
          ? '<div class="section-head">Trending</div><div class="trending-chips">' +
            tags.map(function(t) {
              return '<button class="trend-chip" onclick="App.explore.tag(\'' + esc(t.tag) + '\')">#' + esc(t.tag) + '<span class="trend-count">' + numFmt(t.count) + '</span></button>';
            }).join('') + '</div>'
          : '';
        const gridEl = document.getElementById('exp-grid');
        gridEl.innerHTML = '';
        (grid.posts || []).forEach(function(p) {
          const cell = document.createElement('div');
          cell.className = 'exp-cell';
          cell.onclick = function() { post.openDetail(p.id); };
          var thumb = '';
          if (p.media_urls) { try { var u = JSON.parse(p.media_urls); if (u[0]) thumb = '<img src="' + u[0] + '" loading="lazy" alt="">'; } catch (_) {} }
          cell.innerHTML = thumb || '<div class="exp-text-cell">' + esc((p.content || '').slice(0, 80)) + '</div>';
          gridEl.appendChild(cell);
        });
      } catch (_) {}
    },
    async _search() {
      const q = document.getElementById('exp-q').value.trim();
      if (!q) {
        document.getElementById('exp-results').classList.add('hidden');
        document.getElementById('exp-main').classList.remove('hidden');
        return;
      }
      document.getElementById('exp-main').classList.add('hidden');
      document.getElementById('exp-results').classList.remove('hidden');
      try {
        const data = await API.json('GET', '/api/search?q=' + encodeURIComponent(q));
        _renderSearch(data, document.getElementById('exp-results'));
      } catch (_) {}
    },
    tag(hashtag) { nav.go('search'); document.getElementById('search-q').value = '#' + hashtag; search.run(); },
  };

  /* ─────────────── SEARCH ─────────────── */
  const search = {
    async run() {
      const q   = document.getElementById('search-q').value.trim();
      const out = document.getElementById('search-out');
      if (!q) { out.innerHTML = ''; return; }
      try { const d = await API.json('GET', '/api/search?q=' + encodeURIComponent(q)); _renderSearch(d, out); }
      catch (_) {}
    },
  };

  function _renderSearch(data, container) {
    container.innerHTML = '';
    const users  = data.users || [];
    const posts2 = data.posts || [];
    if (users.length) {
      const sec = document.createElement('div');
      sec.innerHTML = '<div class="section-head">People</div>';
      users.forEach(function(u) {
        const row = document.createElement('div');
        row.className = 'user-row';
        row.innerHTML =
          avatar(u, 46) +
          '<div class="user-row-info" onclick="App.profile.goUser(\'' + esc(u.username) + '\')">' +
            '<span class="user-row-name">' + esc(u.display_name || u.username) + '</span>' +
            '<span class="user-row-handle">@' + esc(u.username) + '</span>' +
          '</div>' +
          '<button class="btn-follow-sm' + (u.is_following ? ' following' : '') + '" onclick="App.profile.followBtn(' + u.id + ',this)">' + (u.is_following ? 'Following' : 'Follow') + '</button>';
        sec.appendChild(row);
      });
      container.appendChild(sec);
    }
    if (posts2.length) {
      const sec = document.createElement('div');
      sec.innerHTML = '<div class="section-head">Posts</div>';
      posts2.forEach(function(p) { renderPost(p, sec); });
      container.appendChild(sec);
    }
    if (!users.length && !posts2.length)
      container.innerHTML = '<div class="empty-state">No results found.</div>';
  }

  /* ─────────────── NOTIFICATIONS ─────────────── */
  const notifications = {
    async load() {
      const list = document.getElementById('notif-list');
      list.innerHTML = '<div class="center-spin"><div class="spin-ring"></div></div>';
      try {
        const data   = await API.json('GET', '/api/notifications');
        const notifs = data.notifications || [];
        list.innerHTML = '';
        if (!notifs.length) { list.innerHTML = '<div class="empty-state">No notifications yet.</div>'; return; }
        notifs.forEach(function(n) {
          const el = document.createElement('div');
          el.className = 'notif-item' + (n.is_read ? '' : ' unread');
          el.innerHTML =
            '<div class="notif-av">' + avatar({ avatar_url: n.actor_avatar, display_name: n.actor_display || n.actor_username, username: n.actor_username }, 40) + '</div>' +
            '<div class="notif-body">' +
              '<span class="notif-actor">' + esc(n.actor_display || n.actor_username) + '</span>' +
              '<span class="notif-msg"> ' + esc(n.message) + '</span>' +
              '<div class="notif-time">' + timeAgo(n.created_at) + '</div>' +
            '</div>';
          el.onclick = function() {
            if (!n.is_read) { API.post('/api/notifications/' + n.id + '/read').catch(function() {}); el.classList.remove('unread'); }
            if (n.entity_type === 'post' && n.entity_id) post.openDetail(n.entity_id);
            else if (n.actor_username) profile.goUser(n.actor_username);
          };
          list.appendChild(el);
        });
        API.post('/api/notifications/read-all').catch(function() {});
        S.notifCount = 0;
        document.getElementById('notif-badge').classList.add('hidden');
      } catch (e) { list.innerHTML = '<div class="empty-state">' + e.message + '</div>'; }
    },
  };

  async function _pollNotifs() {
    try {
      const data = await API.json('GET', '/api/notifications/unread-count');
      const cnt  = data.count || 0;
      S.notifCount = cnt;
      const badge = document.getElementById('notif-badge');
      if (cnt > 0) { badge.textContent = cnt > 99 ? '99+' : cnt; badge.classList.remove('hidden'); }
      else badge.classList.add('hidden');
    } catch (_) {}
    setTimeout(_pollNotifs, 30000);
  }

  /* ─────────────── PROFILE ─────────────── */
  const profile = {
    async loadOwn() {
      if (!S.user) return;
      const el = document.getElementById('own-profile');
      el.innerHTML = '<div class="center-spin"><div class="spin-ring"></div></div>';
      try {
        const data = await API.json('GET', '/api/users/' + S.user.username);
        el.innerHTML = _profileHTML(data.user, data.posts || [], true);
      } catch (e) { el.innerHTML = '<div class="empty-state">' + e.message + '</div>'; }
    },
    goUser(username) { nav.go('userprofile', username); },
    async loadUser(username) {
      const el = document.getElementById('user-profile-out');
      el.innerHTML = '<div class="center-spin"><div class="spin-ring"></div></div>';
      document.getElementById('topbar-title').textContent = '@' + username;
      try {
        const data = await API.json('GET', '/api/users/' + username);
        el.innerHTML = _profileHTML(data.user, data.posts || [], S.user && S.user.id === data.user.id);
      } catch (e) { el.innerHTML = '<div class="empty-state">' + e.message + '</div>'; }
    },
    async followBtn(userId, btn) {
      const was = btn.classList.contains('following');
      btn.textContent = was ? 'Follow' : 'Following';
      btn.classList.toggle('following');
      try {
        if (was) await API.del('/api/users/' + userId + '/follow');
        else     await API.post('/api/users/' + userId + '/follow');
      } catch (e) { btn.textContent = was ? 'Following' : 'Follow'; btn.classList.toggle('following'); toast(e.message); }
    },
    async message(userId) {
      try {
        const data = await API.json('POST', '/api/chat/conversations', { user_id: userId });
        var otherUser = null;
        try { const ud = await API.json('GET', '/api/users/by-id/' + userId); otherUser = ud.user; } catch (_) {}
        nav.go('conv', { conversation_id: data.conversation_id, other_user: otherUser });
      } catch (e) { toast(e.message); }
    },
  };

  function _profileHTML(u, posts2, isOwn) {
    const btn = isOwn
      ? '<button class="btn-outline" onclick="App.nav.go(\'editprofile\')">Edit Profile</button>' +
        '<button class="btn-outline" onclick="App.nav.go(\'settings\')" style="margin-left:8px;">Settings</button>'
      : '<div style="display:flex;gap:8px;">' +
          '<button class="btn-follow-sm' + (u.is_following ? ' following' : '') + '" onclick="App.profile.followBtn(' + u.id + ',this)">' + (u.is_following ? 'Following' : 'Follow') + '</button>' +
          '<button class="btn-outline-sm" onclick="App.profile.message(' + u.id + ')">Message</button>' +
        '</div>';
    const grid = posts2.length
      ? posts2.map(function(p) { return '<div class="profile-post-cell" onclick="App.post.openDetail(' + p.id + ')">' + _miniThumb(p) + '</div>'; }).join('')
      : '<div class="empty-state" style="grid-column:1/-1;padding:24px;">No posts yet.</div>';
    return '<div class="profile-cover"' + (u.cover_url ? ' style="background-image:url(' + u.cover_url + ')"' : '') + '></div>' +
      '<div class="profile-av-wrap">' +
        avatar(u, 80) +
        (isOwn ? '<label class="av-edit-btn" for="av-file-inp">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>' +
          '<input id="av-file-inp" type="file" accept="image/*" class="hidden" onchange="App.uploadAvatar(event)">' +
        '</label>' : '') +
      '</div>' +
      '<div class="profile-info">' +
        '<div class="profile-name-row">' +
          '<h2 class="profile-display">' + esc(u.display_name || u.username) + '</h2>' +
          (u.is_verified ? '<svg class="verified-ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#7B61FF"/><path d="M8 12l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') +
        '</div>' +
        '<p class="profile-handle">@' + esc(u.username) + '</p>' +
        (u.bio ? '<p class="profile-bio">' + esc(u.bio) + '</p>' : '') +
        '<div class="profile-stats">' +
          '<span><strong>' + numFmt(u.post_count) + '</strong> Posts</span>' +
          '<span><strong>' + numFmt(u.follower_count) + '</strong> Followers</span>' +
          '<span><strong>' + numFmt(u.following_count) + '</strong> Following</span>' +
        '</div>' +
        btn +
      '</div>' +
      '<div class="profile-posts">' + grid + '</div>';
  }

  function _miniThumb(p) {
    if (p.media_urls) { try { var u = JSON.parse(p.media_urls); if (u[0]) return '<img src="' + u[0] + '" loading="lazy" alt="">'; } catch (_) {} }
    return '<div class="mini-text-post">' + esc((p.content || '').slice(0, 60)) + '</div>';
  }

  async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('avatar', file);
    try {
      const r = await fetch('/api/upload/avatar', { method: 'POST', headers: { Authorization: 'Bearer ' + _accessToken }, body: fd });
      if (r.ok) { const d = await r.json(); S.user.avatar_url = d.url; _updateNavAv(); profile.loadOwn(); toast('Avatar updated!'); }
      else { const err = await r.json(); toast(err.error || 'Upload failed'); }
    } catch (e) { toast(e.message); }
  }

  /* ─────────────── CHAT LIST ─────────────── */
  const chatList = {
    async load() {
      const list = document.getElementById('chat-list');
      list.innerHTML = '';
      try {
        const data  = await API.json('GET', '/api/chat/conversations');
        const convs = data.conversations || [];
        if (!convs.length) { list.innerHTML = '<div class="empty-state">No messages yet.</div>'; return; }
        convs.forEach(function(c) {
          const el = document.createElement('div');
          el.className = 'chat-row' + (c.unread_count > 0 ? ' unread' : '');
          el.innerHTML =
            avatar(c.other_user, 50) +
            '<div class="chat-row-info">' +
              '<div class="chat-row-top">' +
                '<span class="chat-row-name">' + esc((c.other_user && (c.other_user.display_name || c.other_user.username)) || '—') + '</span>' +
                '<span class="chat-row-time">' + (c.last_message_at ? timeAgo(c.last_message_at) : '') + '</span>' +
              '</div>' +
              '<div class="chat-row-bottom">' +
                '<span class="chat-row-preview">' + (c.last_message ? esc(c.last_message.slice(0, 50)) : 'No messages') + '</span>' +
                (c.unread_count > 0 ? '<span class="chat-unread-dot">' + c.unread_count + '</span>' : '') +
              '</div>' +
            '</div>';
          el.onclick = function() { nav.go('conv', { conversation_id: c.id, other_user: c.other_user }); };
          list.appendChild(el);
        });
      } catch (e) { list.innerHTML = '<div class="empty-state">' + e.message + '</div>'; }
    },
    async newDM() {
      const username = prompt('Enter username to message:');
      if (!username) return;
      try {
        const ud = await API.json('GET', '/api/users/' + username.trim());
        const u  = ud.user;
        const d  = await API.json('POST', '/api/chat/conversations', { user_id: u.id });
        nav.go('conv', { conversation_id: d.conversation_id, other_user: u });
      } catch (e) { toast(e.message); }
    },
  };

  /* ─────────────── CHAT CONVERSATION ─────────────── */
  const chatConv = {
    async open(data) {
      S.convId     = data.conversation_id;
      S.convOther  = data.other_user || null;
      S.msgBefore  = null;
      S.msgLoading = false;

      document.getElementById('topbar-title').textContent =
        S.convOther ? (S.convOther.display_name || S.convOther.username) : 'Chat';

      document.getElementById('conv-user').innerHTML = S.convOther
        ? avatar(S.convOther, 36) +
          '<div><span class="conv-user-name">' + esc(S.convOther.display_name || S.convOther.username) + '</span>' +
          (S.convOther.is_verified ? '<svg class="verified-ico-sm" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#7B61FF"/><path d="M8 12l3 3 5-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '') +
          '</div>'
        : '';

      const hasE2EE = !!S.keyPair;
      document.getElementById('conv-e2ee-badge').style.display = hasE2EE ? 'flex'  : 'none';
      document.getElementById('e2ee-notice').style.display     = hasE2EE ? 'flex'  : 'none';

      if (hasE2EE && S.convOther) await chatConv._fetchPeerKey(S.convOther.id);

      WS.subscribe(S.convId);
      document.getElementById('msg-list').innerHTML = '';
      await chatConv._loadMsgs(false);

      const ml = document.getElementById('msg-list');
      ml.scrollTop = ml.scrollHeight;
      ml.onscroll  = function() { if (ml.scrollTop < 80 && !S.msgLoading) chatConv._loadMsgs(true); };
    },

    async _fetchPeerKey(uid) {
      if (S.peerPubs[uid]) return S.peerPubs[uid];
      try { const d = await API.json('GET', '/api/auth/public-key/' + uid); S.peerPubs[uid] = d.public_key; return d.public_key; }
      catch (_) { return null; }
    },

    async _sharedKey(otherUid) {
      if (S.sharedKeys[otherUid]) return S.sharedKeys[otherUid];
      const pub = await chatConv._fetchPeerKey(otherUid);
      if (!pub || !S.keyPair) return null;
      try { const k = await E2EE.getSharedKey(S.keyPair, pub); S.sharedKeys[otherUid] = k; return k; }
      catch (_) { return null; }
    },

    async _loadMsgs(more) {
      if (S.msgLoading) return;
      S.msgLoading = true;
      const ml    = document.getElementById('msg-list');
      const prevH = ml.scrollHeight;
      try {
        const url  = '/api/chat/conversations/' + S.convId + '/messages?limit=30' + (S.msgBefore ? '&before=' + S.msgBefore : '');
        const data = await API.json('GET', url);
        const msgs = data.messages || [];
        if (msgs.length) {
          S.msgBefore = msgs[0].id;
          const frag = document.createDocumentFragment();
          for (var i = 0; i < msgs.length; i++) frag.appendChild(await chatConv._mkBubble(msgs[i]));
          if (more) { ml.prepend(frag); ml.scrollTop = ml.scrollHeight - prevH; }
          else { ml.appendChild(frag); }
        }
      } catch (e) { toast(e.message); }
      finally { S.msgLoading = false; }
    },

    async _mkBubble(m) {
      const isMine = S.user && m.sender_id === S.user.id;
      var txt = m.content;
      if (m.is_encrypted && S.keyPair) {
        const otherId = isMine ? (S.convOther && S.convOther.id) : m.sender_id;
        if (otherId) {
          try {
            const k = await chatConv._sharedKey(otherId);
            if (k) txt = await E2EE.decrypt(k, txt);
            else   txt = '[Key not available]';
          } catch (_) { txt = '[Decryption failed]'; }
        }
      }
      const el = document.createElement('div');
      el.className = 'msg-bubble ' + (isMine ? 'mine' : 'theirs');
      el.innerHTML =
        '<div class="msg-text">' + esc(txt) + '</div>' +
        '<div class="msg-meta">' +
          (m.is_encrypted ? '<span class="msg-enc-dot" title="End-to-end encrypted">🔒</span>' : '') +
          '<span class="msg-time">' + timeAgo(m.created_at) + '</span>' +
        '</div>';
      return el;
    },

    async send() {
      const inp = document.getElementById('msg-inp');
      const txt = inp.value.trim();
      if (!txt || !S.convId) return;
      inp.value = '';
      try {
        var body;
        const k = S.convOther ? await chatConv._sharedKey(S.convOther.id) : null;
        if (k) { const ct = await E2EE.encrypt(k, txt); body = { content: ct, is_encrypted: true }; }
        else   { body = { content: txt, is_encrypted: false }; }
        const data = await API.json('POST', '/api/chat/conversations/' + S.convId + '/messages', body);
        const el   = await chatConv._mkBubble(data.message);
        el.classList.add('new');
        const ml = document.getElementById('msg-list');
        ml.appendChild(el);
        ml.scrollTop = ml.scrollHeight;
      } catch (e) { toast(e.message); }
    },

    wsMsg(data) {
      if (data.type === 'new_message' && data.message && data.message.conversation_id === S.convId && data.message.sender_id !== (S.user && S.user.id)) {
        chatConv._mkBubble(data.message).then(function(el) {
          el.classList.add('new');
          const ml = document.getElementById('msg-list');
          ml.appendChild(el);
          ml.scrollTop = ml.scrollHeight;
        });
      }
    },
  };

  /* ─────────────── SETTINGS ─────────────── */
  const settings = {
    load() {
      document.getElementById('settings-out').innerHTML =
        '<div class="settings-list">' +
          '<div class="settings-section-title">Account</div>' +
          '<button class="settings-row" onclick="App.nav.go(\'editprofile\')">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' +
            'Edit Profile' +
            '<svg class="settings-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
          '</button>' +
          '<button class="settings-row" onclick="App.nav.go(\'2fa\')">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            'Two-Factor Authentication' +
            '<svg class="settings-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
          '</button>' +
          '<div class="settings-section-title">Security & Privacy</div>' +
          '<button class="settings-row" onclick="App.settings.changePw()">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            'Change Password' +
            '<svg class="settings-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
          '</button>' +
          '<button class="settings-row" onclick="App.settings.regenE2EE()">' +
            '<span class="e2ee-badge-sm">E2EE</span>' +
            'Regenerate Encryption Keys' +
            '<svg class="settings-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>' +
          '</button>' +
          '<div class="settings-section-title">Danger Zone</div>' +
          '<button class="settings-row danger" onclick="App.auth.logout()">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>' +
            'Sign Out' +
          '</button>' +
        '</div>';
    },
    changePw() {
      const cur = prompt('Current password:');
      if (!cur) return;
      const nw = prompt('New password (8+ chars, A-Z, a-z, 0-9):');
      if (!nw) return;
      API.json('POST', '/api/auth/change-password', { current_password: cur, new_password: nw })
        .then(function() { toast('Password changed. Please sign in again.'); auth.logout(); })
        .catch(function(e) { toast(e.message); });
    },
    async regenE2EE() {
      if (!confirm('Regenerate E2EE keys? Previous encrypted messages will not be readable with the new key.')) return;
      localStorage.removeItem('tw_kp_' + S.user.id);
      S.sharedKeys = {}; S.peerPubs = {};
      try {
        S.keyPair = await E2EE.init(S.user.id);
        const pub = S.keyPair._pubB64 || await E2EE.exportPubRaw(S.keyPair);
        S.keyPair._pubB64 = pub;
        await API.json('PUT', '/api/auth/public-key', { public_key: pub });
        toast('E2EE keys regenerated!');
      } catch (e) { toast(e.message); }
    },
  };

  /* ─────────────── EDIT PROFILE ─────────────── */
  const editProfile = {
    load() {
      const u = S.user;
      document.getElementById('editprofile-out').innerHTML =
        '<div class="edit-form">' +
          '<div class="field-wrap"><label class="field-label">Display Name</label>' +
            '<input id="ep-name" class="glass-input" type="text" value="' + esc(u.display_name || '') + '" maxlength="80"></div>' +
          '<div class="field-wrap"><label class="field-label">Bio</label>' +
            '<textarea id="ep-bio" class="glass-input" rows="3" maxlength="300">' + esc(u.bio || '') + '</textarea></div>' +
          '<div class="field-wrap"><label class="field-label">Website</label>' +
            '<input id="ep-web" class="glass-input" type="url" value="' + esc(u.website || '') + '" placeholder="https://"></div>' +
          '<div class="field-wrap"><label class="field-label">Location</label>' +
            '<input id="ep-loc" class="glass-input" type="text" value="' + esc(u.location || '') + '" maxlength="100"></div>' +
          '<button class="btn-grad btn-full" onclick="App.editProfile.save()">Save Changes</button>' +
        '</div>';
    },
    async save() {
      const body = {
        display_name: document.getElementById('ep-name').value.trim(),
        bio:          document.getElementById('ep-bio').value.trim(),
        website:      document.getElementById('ep-web').value.trim(),
        location:     document.getElementById('ep-loc').value.trim(),
      };
      try {
        const data = await API.json('PUT', '/api/users/' + S.user.username, body);
        Object.assign(S.user, data.user || body);
        _updateNavAv();
        toast('Profile updated!');
        nav.back();
      } catch (e) { toast(e.message); }
    },
  };

  /* ─────────────── 2FA ─────────────── */
  const twofa = {
    load() {
      const on = S.user && S.user.two_fa_enabled;
      document.getElementById('twofa-out').innerHTML =
        '<div class="settings-list">' +
          '<div class="twofa-status ' + (on ? 'enabled' : 'disabled') + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            '<div><strong>Two-Factor Authentication</strong>' +
            '<p>Status: <span class="status-pill ' + (on ? 'active' : 'inactive') + '">' + (on ? 'Enabled' : 'Disabled') + '</span></p></div>' +
          '</div>' +
          (on
            ? '<button class="btn-danger btn-full" onclick="App.twofa.disable()">Disable 2FA</button>'
            : '<button class="btn-grad btn-full" onclick="App.twofa.setup()">Enable 2FA</button>') +
        '</div>';
    },
    async setup() {
      try {
        const data = await API.json('POST', '/api/auth/2fa/setup');
        document.getElementById('twofa-out').innerHTML =
          '<div class="settings-list">' +
            '<p class="twofa-instructions">Scan this QR code with Google Authenticator, Authy, or similar.</p>' +
            (data.qr_code ? '<img src="' + data.qr_code + '" class="qr-code" alt="QR Code">' : '') +
            '<p class="twofa-manual">Manual key: <code class="twofa-secret">' + data.secret + '</code></p>' +
            '<div class="field-wrap">' +
              '<input id="totp-v" class="glass-input" type="text" inputmode="numeric" maxlength="6" placeholder="Enter 6-digit code">' +
            '</div>' +
            '<button class="btn-grad btn-full" onclick="App.twofa.enable()">Verify & Enable</button>' +
          '</div>';
      } catch (e) { toast(e.message); }
    },
    async enable() {
      try {
        await API.json('POST', '/api/auth/2fa/enable', { totp_code: document.getElementById('totp-v').value.trim() });
        if (S.user) S.user.two_fa_enabled = true;
        toast('2FA enabled!'); twofa.load();
      } catch (e) { toast(e.message); }
    },
    async disable() {
      const pw   = prompt('Confirm password:');
      const code = prompt('Enter 2FA code:');
      if (!pw || !code) return;
      try {
        await API.json('POST', '/api/auth/2fa/disable', { password: pw, totp_code: code });
        if (S.user) S.user.two_fa_enabled = false;
        toast('2FA disabled.'); twofa.load();
      } catch (e) { toast(e.message); }
    },
  };

  /* ─────────────── ACTION SHEET ─────────────── */
  function actionSheet(items) {
    const body = document.getElementById('action-sheet-body');
    const ov   = document.getElementById('action-sheet');
    body.innerHTML = '<div class="modal-drag-bar"></div>' +
      items.map(function(it, i) {
        return '<button class="action-item' + (it.danger ? ' danger' : '') + '" data-idx="' + i + '">' + it.label + '</button>';
      }).join('') +
      '<button class="action-item action-cancel" onclick="App._closeAS()">Cancel</button>';
    body.querySelectorAll('.action-item[data-idx]').forEach(function(btn) {
      var idx = +btn.getAttribute('data-idx');
      btn.onclick = function() { _closeAS(); items[idx].action(); };
    });
    ov.classList.remove('hidden');
    ov.onclick = function(e) { if (e.target === ov) _closeAS(); };
  }
  function _closeAS() { document.getElementById('action-sheet').classList.add('hidden'); }

  /* ─────────────── LIGHTBOX ─────────────── */
  function lightbox(url) {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.93);z-index:9999;display:flex;align-items:center;justify-content:center;';
    div.innerHTML = '<img src="' + url + '" style="max-width:95vw;max-height:95vh;border-radius:8px;object-fit:contain;">';
    div.onclick = function() { div.remove(); };
    document.body.appendChild(div);
  }

  /* ─────────────── PW STRENGTH ─────────────── */
  function _pwStrength() {
    const inp = document.getElementById('rg-pw');
    if (!inp) return;
    inp.addEventListener('input', function() {
      const v = inp.value, fill = document.getElementById('pw-str-fill');
      if (!fill) return;
      var s = 0;
      if (v.length >= 8) s++;
      if (/[A-Z]/.test(v)) s++;
      if (/[a-z]/.test(v)) s++;
      if (/[0-9]/.test(v)) s++;
      if (/[^A-Za-z0-9]/.test(v)) s++;
      fill.style.width = (s / 5 * 100) + '%';
      fill.style.background = s < 3 ? '#FF4757' : s < 4 ? '#FFA502' : '#2ED573';
    });
  }

  /* ─────────────── INIT ─────────────── */
  async function init() {
    WS.on('new_message', function(d) { chatConv.wsMsg(d); });
    WS.on('notification', function(d) {
      S.notifCount++;
      const b = document.getElementById('notif-badge');
      b.textContent = S.notifCount > 99 ? '99+' : S.notifCount;
      b.classList.remove('hidden');
      toast((d.actor_username || 'Someone') + ' ' + (d.message || 'interacted with you'));
    });

    document.getElementById('sc-home').addEventListener('scroll', function(e) {
      const el = e.target;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 200) feed.load();
    });

    _pwStrength();
    setTimeout(function() { _moveIndicator('home'); }, 150);

    const storedRF = localStorage.getItem('tw_rf');
    setTimeout(async function() {
      const splash = document.getElementById('splash');
      splash.style.transition = 'opacity .5s';
      splash.style.opacity = '0';
      await new Promise(function(r) { setTimeout(r, 500); });
      splash.style.display = 'none';

      if (storedRF) {
        try {
          const r = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: storedRF }),
          });
          if (r.ok) {
            const tk = await r.json();
            API.setTokens(tk.access_token, tk.refresh_token || storedRF);
            const ur = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + _accessToken } });
            if (ur.ok) {
              const ud = await ur.json();
              S.user = ud.user;
              try {
                S.keyPair = await E2EE.init(S.user.id);
                const pub = S.keyPair._pubB64 || await E2EE.exportPubRaw(S.keyPair);
                S.keyPair._pubB64 = pub;
                await API.json('PUT', '/api/auth/public-key', { public_key: pub });
              } catch (_) {}
              WS.connect();
              document.getElementById('auth-screen').classList.add('hidden');
              document.getElementById('app').classList.remove('hidden');
              _updateNavAv();
              nav.go('home');
              _pollNotifs();
              feed.load(true);
              stories.load();
              return;
            }
          }
        } catch (_) {}
      }
      document.getElementById('auth-screen').classList.remove('hidden');
    }, 2000);
  }

  return {
    init,
    auth,
    nav,
    feed,
    stories,
    post,
    comments,
    explore,
    search,
    notifications,
    profile,
    chatList,
    chat: chatConv,
    settings,
    editProfile,
    twofa,
    toast,
    lightbox,
    uploadAvatar,
    _closeAS,
  };
})();

/* ── global helpers used in inline HTML ── */
function togglePw(id) {
  const i = document.getElementById(id);
  i.type = i.type === 'password' ? 'text' : 'password';
}

document.addEventListener('DOMContentLoaded', function() { App.init(); });
