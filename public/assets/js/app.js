/* ══════════════════════════════════════════
   TROWDED — Main SPA JavaScript
   ══════════════════════════════════════════ */
'use strict';

/* ─── API Client ─── */
const API = (() => {
  const BASE = '/api';
  let _accessToken  = localStorage.getItem('tw_access') || null;
  let _refreshToken = localStorage.getItem('tw_refresh') || null;
  let _refreshing   = false;
  let _queue        = [];

  function setTokens(at, rt) {
    _accessToken  = at;
    _refreshToken = rt;
    if (at) localStorage.setItem('tw_access',  at);
    else    localStorage.removeItem('tw_access');
    if (rt) localStorage.setItem('tw_refresh', rt);
    else    localStorage.removeItem('tw_refresh');
  }

  async function refreshTokens() {
    if (!_refreshToken) throw new Error('No refresh token');
    const r = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: _refreshToken }),
    });
    if (!r.ok) { setTokens(null, null); throw new Error('Refresh failed'); }
    const d = await r.json();
    setTokens(d.access_token, d.refresh_token);
    return d.access_token;
  }

  async function request(method, path, body, isRetry = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (_accessToken) headers['Authorization'] = `Bearer ${_accessToken}`;

    const opts = { method, headers };
    if (body && !(body instanceof FormData)) opts.body = JSON.stringify(body);
    if (body instanceof FormData) { delete headers['Content-Type']; opts.body = body; }

    let res = await fetch(`${BASE}${path}`, opts);

    if (res.status === 401 && !isRetry) {
      const data = await res.clone().json().catch(() => ({}));
      if (data.code === 'TOKEN_EXPIRED' || res.status === 401) {
        if (_refreshing) {
          return new Promise((resolve, reject) => {
            _queue.push({ resolve, reject, method, path, body });
          });
        }
        _refreshing = true;
        try {
          await refreshTokens();
          _refreshing = false;
          _queue.forEach(q => request(q.method, q.path, q.body, true).then(q.resolve).catch(q.reject));
          _queue = [];
          return request(method, path, body, true);
        } catch {
          _refreshing = false;
          _queue.forEach(q => q.reject(new Error('Auth expired')));
          _queue = [];
          App.auth.logout();
          throw new Error('Session expired');
        }
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const e   = new Error(err.error || 'Request failed');
      e.status  = res.status;
      e.data    = err;
      throw e;
    }
    return res.json();
  }

  return {
    get:    (p)    => request('GET',    p),
    post:   (p, b) => request('POST',   p, b),
    patch:  (p, b) => request('PATCH',  p, b),
    delete: (p)    => request('DELETE', p),
    upload: (p, f) => request('POST',   p, f),
    setTokens,
    getTokens: () => ({ access: _accessToken, refresh: _refreshToken }),
    clear: () => setTokens(null, null),
  };
})();

/* ─── State ─── */
const State = {
  user:             null,
  feedPage:         0,
  feedLoading:      false,
  feedEnd:          false,
  currentPostId:    null,
  currentConvId:    null,
  currentUserProf:  null,
  navHistory:       [],
  currentTab:       'home',
  activeStoryGroup: null,
  activeStoryIdx:   0,
  storyTimer:       null,
};

/* ─── Helpers ─── */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0','') + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1).replace('.0','') + 'K';
  return String(n);
}

function avatarPlaceholder(name) {
  return (name || '?')[0].toUpperCase();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function parseContent(text) {
  return escapeHtml(text)
    .replace(/#([a-zA-Z0-9_]{1,50})/g, '<span class="hashtag" onclick="App.nav.hashtag(\'$1\')">#$1</span>')
    .replace(/@([a-zA-Z0-9_]{3,30})/g, '<span class="mention" onclick="App.nav.userProfile(\'$1\')">@$1</span>');
}

function userAvatar(user, size = 40) {
  if (user.avatar_url) {
    return `<img src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(user.username)}" loading="lazy"/>`;
  }
  return `<div class="post-avatar-placeholder" style="font-size:${Math.round(size*0.4)}px;font-weight:700;color:#A0A0BB;">${avatarPlaceholder(user.display_name || user.username)}</div>`;
}

window.togglePw = (id) => {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
};

/* ─── Password Strength ─── */
function checkPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const bar = document.getElementById('pw-strength');
  if (!bar) return;
  const widths  = ['0%', '20%', '40%', '65%', '85%', '100%'];
  const colors  = ['#666', '#FF4444', '#FF9900', '#FFC107', '#00C853', '#00E676'];
  bar.style.setProperty('--pw-w', widths[score]);
  bar.style.setProperty('--pw-c', colors[score]);
}

/* ════════════════════════════════════════
   APP OBJECT
   ════════════════════════════════════════ */
const App = {

  /* ─── Boot ─── */
  async init() {
    /* Progress animation */
    await new Promise(r => setTimeout(r, 1800));
    const splash = document.getElementById('splash');
    splash.style.opacity = '0';
    await new Promise(r => setTimeout(r, 500));
    splash.style.display = 'none';

    const tokens = API.getTokens();
    if (tokens.access) {
      try {
        const data = await API.get('/auth/me');
        State.user = data.user;
        this.showApp();
      } catch {
        API.clear();
        this.showAuth();
      }
    } else {
      this.showAuth();
    }
  },

  showApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    this.updateNavAvatar();
    this.nav.go('home');
    this.notifications.loadUnreadCount();
    setInterval(() => this.notifications.loadUnreadCount(), 60000);
  },

  showAuth() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
  },

  updateNavAvatar() {
    const el = document.getElementById('nav-avatar');
    if (!el || !State.user) return;
    if (State.user.avatar_url) {
      el.innerHTML = `<img src="${escapeHtml(State.user.avatar_url)}" alt=""/>`;
    } else {
      el.innerHTML = `<div style="font-size:12px;font-weight:700;color:#A0A0BB;">${avatarPlaceholder(State.user.display_name)}</div>`;
    }
  },

  toast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), duration);
  },

  /* ─── AUTH ─── */
  auth: {
    showLogin() {
      document.getElementById('login-form').classList.remove('hidden');
      document.getElementById('register-form').classList.add('hidden');
    },
    showRegister() {
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('register-form').classList.remove('hidden');
    },

    async login() {
      const identifier = document.getElementById('login-identifier').value.trim();
      const password   = document.getElementById('login-password').value;
      const totp       = document.getElementById('login-totp').value.trim();
      const errEl      = document.getElementById('login-error');

      if (!identifier || !password) {
        this._showError(errEl, 'Please fill in all fields.');
        return;
      }

      const btn = document.querySelector('#login-form .btn-primary');
      btn.disabled = true; btn.textContent = 'Signing in…';

      try {
        const body = { identifier, password };
        if (totp) body.totp_code = totp;

        const data = await API.post('/auth/login', body);

        if (data.two_fa_required) {
          document.getElementById('login-2fa').classList.remove('hidden');
          document.getElementById('login-totp').focus();
          errEl.classList.add('hidden');
          return;
        }

        API.setTokens(data.access_token, data.refresh_token);
        State.user = data.user;
        App.showApp();
      } catch (e) {
        this._showError(errEl, e.message || 'Login failed.');
        if (e.data?.two_fa_required) {
          document.getElementById('login-2fa').classList.remove('hidden');
        }
      } finally {
        btn.disabled = false; btn.textContent = 'Sign In';
      }
    },

    async register() {
      const display_name = document.getElementById('reg-display').value.trim();
      const username     = document.getElementById('reg-username').value.trim();
      const email        = document.getElementById('reg-email').value.trim();
      const password     = document.getElementById('reg-password').value;
      const errEl        = document.getElementById('reg-error');

      if (!username || !email || !password) {
        this._showError(errEl, 'Please fill in all required fields.');
        return;
      }

      const btn = document.querySelector('#register-form .btn-primary');
      btn.disabled = true; btn.textContent = 'Creating account…';

      try {
        const data = await API.post('/auth/register', { username, email, password, display_name });
        API.setTokens(data.access_token, data.refresh_token);
        State.user = data.user;
        App.showApp();
      } catch (e) {
        this._showError(errEl, e.message || 'Registration failed.');
      } finally {
        btn.disabled = false; btn.textContent = 'Create Account';
      }
    },

    async logout() {
      const refresh = API.getTokens().refresh;
      try { await API.post('/auth/logout', { refresh_token: refresh }); } catch(_) {}
      API.clear();
      State.user = null;
      State.feedPage = 0;
      State.feedEnd = false;
      document.getElementById('feed-container').innerHTML = '';
      App.showAuth();
    },

    _showError(el, msg) {
      el.textContent = msg;
      el.classList.remove('hidden');
    },
  },

  /* ─── NAVIGATION ─── */
  nav: {
    go(tab, data) {
      /* Hide all screens */
      document.querySelectorAll('.tab-screen').forEach(s => s.classList.remove('active'));

      /* Update bottom nav */
      document.querySelectorAll('.nav-btn[data-tab]').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
      });

      /* Show/hide header */
      const topBar = document.getElementById('top-bar');
      const wordmark = topBar.querySelector('.app-wordmark');
      const titleEl  = document.getElementById('top-bar-title');
      const rightEl  = document.querySelector('.top-bar-right');

      if (['home', 'explore', 'notifications', 'profile', 'chat'].includes(tab)) {
        topBar.style.display = '';
        wordmark.style.display = tab === 'home' ? '' : 'none';
        titleEl.textContent = tab === 'home' ? '' : tab.charAt(0).toUpperCase() + tab.slice(1);
        rightEl.style.display = tab === 'home' ? '' : 'none';
        document.getElementById('bottom-nav').style.display = '';
        State.navHistory = [];
        State.currentTab = tab;
      } else {
        /* Sub-screen */
        topBar.style.display = 'none';
        document.getElementById('bottom-nav').style.display = 'none';
        State.navHistory.push(State.currentTab);
      }

      const screen = document.getElementById(`screen-${tab}`);
      if (screen) {
        screen.classList.add('active');
        /* Lazy load content */
        if (tab === 'home') App.feed.load();
        else if (tab === 'explore') App.explore.load();
        else if (tab === 'notifications') App.notifications.load();
        else if (tab === 'profile') App.profile.loadOwn();
        else if (tab === 'chat') App.chat.loadList();
        else if (tab === 'search') { document.getElementById('search-input-full')?.focus(); }
        else if (tab === 'settings') App.settings.render();
        else if (tab === 'edit-profile') App.profile.renderEdit();
        else if (tab === '2fa') App.settings.render2FA();
      }
    },

    back() {
      const prev = State.navHistory.pop() || State.currentTab;
      this.go(prev);
    },

    async userProfile(usernameOrId) {
      this.go('user-profile');
      const el = document.getElementById('user-profile-content');
      el.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';
      try {
        const isId   = /^\d+$/.test(String(usernameOrId));
        const prefix = isId ? `/users/by-id/${usernameOrId}` : `/users/${usernameOrId}`;
        const data   = await API.get(prefix);
        State.currentUserProf = data.user;
        document.getElementById('user-profile-title').textContent = data.user.username;
        App.profile.renderFull(data.user, el);
      } catch (e) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">😕</div><h3>Not Found</h3><p>${escapeHtml(e.message)}</p></div>`;
      }
    },

    async openPost(postId) {
      State.currentPostId = postId;
      this.go('post');
      const el = document.getElementById('single-post-content');
      el.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';
      try {
        const data = await API.get(`/posts/${postId}`);
        el.innerHTML = App.feed.renderPostCard(data.post);
        /* Load comments inline */
        el.insertAdjacentHTML('beforeend', '<div id="inline-comments"></div>');
        App.comments.loadInline(postId, document.getElementById('inline-comments'));
      } catch(e) {
        el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">😕</div><h3>Post not found</h3></div>`;
      }
    },

    hashtag(tag) {
      App.explore.loadHashtag(tag);
    },
  },

  /* ─── FEED ─── */
  feed: {
    async load(reset = false) {
      if (reset) { State.feedPage = 0; State.feedEnd = false; document.getElementById('feed-container').innerHTML = ''; App.stories.load(); }
      if (State.feedLoading || State.feedEnd) return;
      State.feedLoading = true;

      const loader = document.getElementById('feed-loader');
      loader.classList.remove('hidden');

      try {
        const data = await API.get(`/feed/home?limit=15&offset=${State.feedPage * 15}`);
        const container = document.getElementById('feed-container');
        if (data.posts.length === 0) {
          State.feedEnd = true;
          if (State.feedPage === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🌟</div><h3>Your feed is empty</h3><p>Follow people to see their posts here.</p><button class="btn-primary" onclick="App.nav.go('explore')" style="margin-top:16px">Explore</button></div>`;
          }
        } else {
          container.insertAdjacentHTML('beforeend', data.posts.map(p => this.renderPostCard(p)).join(''));
          State.feedPage++;
          if (!data.has_more) State.feedEnd = true;
        }
      } catch(e) {
        if (State.feedPage === 0) {
          document.getElementById('feed-container').innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Couldn't load feed</h3><p>${escapeHtml(e.message)}</p></div>`;
        }
      } finally {
        State.feedLoading = false;
        loader.classList.add('hidden');
      }
    },

    renderPostCard(post) {
      const u = post.user;
      const hasMedia = post.media_urls && post.media_urls.length;
      const mediaHtml = hasMedia ? `<div class="post-media">${post.media_urls.map(url =>
        url.match(/\.(mp4|webm|mov)$/i)
          ? `<video src="${escapeHtml(url)}" controls playsinline></video>`
          : `<img src="${escapeHtml(url)}" alt="post media" loading="lazy" onclick="App.nav.openPost(${post.id})"/>`
      ).join('')}</div>` : '';

      const tagsHtml = post.hashtags && post.hashtags.length
        ? `<div class="post-hashtags">${post.hashtags.map(t => `<span class="post-tag" onclick="App.nav.hashtag('${escapeHtml(t)}')">#${escapeHtml(t)}</span>`).join('')}</div>`
        : '';

      return `<div class="post-card" id="post-${post.id}">
        <div class="post-header">
          <div class="post-user" onclick="App.nav.userProfile('${escapeHtml(u.username)}')">
            <div class="post-avatar">${userAvatar(u, 40)}</div>
            <div class="post-user-info">
              <div class="post-display-name">
                ${escapeHtml(u.display_name || u.username)}
                ${u.is_verified ? '<span class="verified-badge">✓</span>' : ''}
              </div>
              <div class="post-username-time">@${escapeHtml(u.username)} · ${timeAgo(post.created_at)}</div>
            </div>
          </div>
          <button class="post-menu-btn" onclick="App.post.showMenu(${post.id}, '${escapeHtml(u.username)}')">⋯</button>
        </div>
        ${post.content ? `<div class="post-content">${parseContent(post.content)}</div>` : ''}
        ${mediaHtml}
        ${tagsHtml}
        <div class="post-actions">
          <button class="action-btn ${post.is_liked ? 'liked' : ''}" onclick="App.post.toggleLike(${post.id}, this)">
            <svg viewBox="0 0 24 24" stroke="currentColor" fill="${post.is_liked ? 'currentColor' : 'none'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            <span>${formatCount(post.like_count)}</span>
          </button>
          <button class="action-btn" onclick="App.comments.open(${post.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            <span>${formatCount(post.comment_count)}</span>
          </button>
          <button class="action-btn" onclick="App.post.share(${post.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
          <button class="action-btn ${post.is_bookmarked ? 'bookmarked' : ''}" onclick="App.post.toggleBookmark(${post.id}, this)" style="margin-left:auto">
            <svg viewBox="0 0 24 24" stroke="currentColor" fill="${post.is_bookmarked ? 'currentColor' : 'none'}" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
          </button>
        </div>
      </div>`;
    },

    setupInfiniteScroll() {
      const container = document.getElementById('screen-home');
      container.addEventListener('scroll', () => {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 200) {
          App.feed.load();
        }
      });
    },
  },

  /* ─── STORIES ─── */
  stories: {
    async load() {
      const row = document.getElementById('stories-row');
      try {
        const data = await API.get('/feed/stories');
        const groups = data.story_groups || [];

        /* My story add button */
        let html = `<div class="story-item story-add" onclick="App.stories.showCreate()">
          <div class="story-avatar-wrap add"><div class="story-avatar-inner">+</div></div>
          <span>Your Story</span>
        </div>`;

        html += groups.map((g, i) => `
          <div class="story-item" onclick="App.stories.open(${i})">
            <div class="story-avatar-wrap ${g.has_unviewed ? '' : 'viewed'}">
              <div class="story-avatar-inner">
                ${g.user.avatar_url ? `<img src="${escapeHtml(g.user.avatar_url)}" alt=""/>` : avatarPlaceholder(g.user.display_name)}
              </div>
            </div>
            <span>${escapeHtml(g.user.display_name || g.user.username)}</span>
          </div>
        `).join('');

        row.innerHTML = html;
        window._storyGroups = groups;
      } catch(_) {}
    },

    open(groupIdx) {
      window._storyGroups = window._storyGroups || [];
      State.activeStoryGroup = groupIdx;
      State.activeStoryIdx   = 0;
      this._showStory();
      document.getElementById('modal-story-viewer').classList.remove('hidden');
    },

    _showStory() {
      const group = (window._storyGroups || [])[State.activeStoryGroup];
      if (!group) { this.close(); return; }
      const story = group.stories[State.activeStoryIdx];
      if (!story) {
        if (State.activeStoryGroup < (window._storyGroups || []).length - 1) {
          State.activeStoryGroup++;
          State.activeStoryIdx = 0;
          this._showStory();
        } else {
          this.close();
        }
        return;
      }

      /* Progress segments */
      const total = group.stories.length;
      const pbEl  = document.getElementById('story-progress-bar');
      pbEl.innerHTML = group.stories.map((_, i) => `
        <div class="story-segment">
          <div class="story-segment-fill ${i < State.activeStoryIdx ? 'done' : i === State.activeStoryIdx ? 'active' : ''}"></div>
        </div>
      `).join('');

      /* User info */
      document.getElementById('story-viewer-user').innerHTML = `
        <div class="story-avatar-wrap viewed" style="width:36px;height:36px;padding:1px;">
          <div class="story-avatar-inner" style="font-size:14px;">
            ${group.user.avatar_url ? `<img src="${escapeHtml(group.user.avatar_url)}" alt=""/>` : avatarPlaceholder(group.user.display_name)}
          </div>
        </div>
        <span style="color:white;font-weight:600;font-size:14px;">${escapeHtml(group.user.display_name || group.user.username)}</span>
        <span style="color:rgba(255,255,255,0.6);font-size:12px;">${timeAgo(story.created_at)}</span>
      `;

      document.getElementById('story-viewer-text').textContent = story.content || '';

      /* Auto-advance */
      clearTimeout(State.storyTimer);
      State.storyTimer = setTimeout(() => this.next(), 5000);

      /* Mark viewed */
      API.post(`/feed/stories/${story.id}/view`, {}).catch(() => {});
    },

    next() {
      clearTimeout(State.storyTimer);
      State.activeStoryIdx++;
      this._showStory();
    },

    prev() {
      clearTimeout(State.storyTimer);
      if (State.activeStoryIdx > 0) { State.activeStoryIdx--; this._showStory(); }
      else if (State.activeStoryGroup > 0) {
        State.activeStoryGroup--;
        State.activeStoryIdx = 0;
        this._showStory();
      }
    },

    close() {
      clearTimeout(State.storyTimer);
      document.getElementById('modal-story-viewer').classList.add('hidden');
    },

    async showCreate() {
      const content = prompt('What\'s your story?');
      if (!content) return;
      try {
        await API.post('/feed/stories', { content });
        App.toast('Story posted! 🎉');
        this.load();
      } catch(e) { App.toast(e.message); }
    },

    async likeCurrentStory() {
      App.toast('❤️ Liked!');
    },
  },

  /* ─── POSTS ─── */
  post: {
    _mediaFiles: [],
    _mediaUrls:  [],

    showCreate() {
      this._mediaFiles = [];
      this._mediaUrls  = [];
      document.getElementById('post-content-input').value = '';
      document.getElementById('post-char-count').textContent = '5000';
      document.getElementById('create-media-preview').innerHTML = '';
      document.getElementById('modal-create-post').classList.remove('hidden');

      /* Show current user avatar */
      if (State.user) {
        document.getElementById('create-post-user').innerHTML = `
          <div class="post-avatar" style="width:36px;height:36px;">${userAvatar(State.user, 36)}</div>
          <span style="font-weight:600;font-size:14px;">${escapeHtml(State.user.display_name || State.user.username)}</span>
        `;
      }
    },

    closeCreate() {
      document.getElementById('modal-create-post').classList.add('hidden');
    },

    countChars() {
      const len = document.getElementById('post-content-input').value.length;
      const el  = document.getElementById('post-char-count');
      el.textContent = 5000 - len;
      el.style.color = len > 4500 ? '#FF4444' : 'var(--text-3)';
    },

    handleMedia(e) {
      const files = Array.from(e.target.files);
      this._mediaFiles.push(...files);
      const preview = document.getElementById('create-media-preview');
      files.forEach((file, i) => {
        const url = URL.createObjectURL(file);
        const idx = this._mediaFiles.length - files.length + i;
        const el  = document.createElement('div');
        el.style.cssText = 'position:relative;display:inline-block;';
        el.innerHTML = file.type.startsWith('video')
          ? `<video src="${url}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;"></video>`
          : `<img src="${url}" class="create-media-thumb"/>`;
        el.insertAdjacentHTML('beforeend', `<button class="media-remove-btn" onclick="App.post.removeMedia(${idx}, this.parentElement)">✕</button>`);
        preview.appendChild(el);
      });
    },

    removeMedia(idx, el) {
      this._mediaFiles.splice(idx, 1);
      el.remove();
    },

    addLocation() {
      App.toast('Location feature coming soon!');
    },

    async submit() {
      const content    = document.getElementById('post-content-input').value.trim();
      const visibility = document.getElementById('post-visibility').value;

      if (!content && !this._mediaFiles.length) {
        App.toast('Post must have content or media.');
        return;
      }

      const btn = document.querySelector('#modal-create-post .btn-primary-sm');
      btn.disabled = true; btn.textContent = 'Posting…';

      try {
        let media_urls = [];
        let media_type = 'none';

        if (this._mediaFiles.length) {
          const form = new FormData();
          this._mediaFiles.forEach(f => form.append('files', f));
          const uploadData = await API.upload('/upload/media', form);
          media_urls = uploadData.urls;
          media_type = uploadData.media_type;
        }

        const data = await API.post('/posts', { content, media_urls, media_type, visibility });
        this.closeCreate();
        App.toast('Posted! ✨');

        /* Prepend to feed */
        const fc = document.getElementById('feed-container');
        fc.insertAdjacentHTML('afterbegin', App.feed.renderPostCard(data.post));
      } catch(e) {
        App.toast(e.message || 'Failed to post.');
      } finally {
        btn.disabled = false; btn.textContent = 'Post';
      }
    },

    async toggleLike(postId, btn) {
      const isLiked = btn.classList.contains('liked');
      const countEl = btn.querySelector('span');
      const current = parseInt(countEl.textContent.replace(/[KM]/, '')) || 0;

      btn.classList.toggle('liked');
      const svg = btn.querySelector('svg');
      svg.setAttribute('fill', isLiked ? 'none' : 'currentColor');

      try {
        if (isLiked) {
          const d = await API.delete(`/posts/${postId}/like`);
          countEl.textContent = formatCount(d.like_count);
        } else {
          const d = await API.post(`/posts/${postId}/like`, {});
          countEl.textContent = formatCount(d.like_count);
        }
      } catch(e) {
        btn.classList.toggle('liked');
        svg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
        App.toast(e.message);
      }
    },

    async toggleBookmark(postId, btn) {
      const isBookmarked = btn.classList.contains('bookmarked');
      btn.classList.toggle('bookmarked');
      const svg = btn.querySelector('svg');
      svg.setAttribute('fill', isBookmarked ? 'none' : 'currentColor');
      try {
        if (isBookmarked) { await API.delete(`/posts/${postId}/bookmark`); App.toast('Removed from bookmarks'); }
        else               { await API.post(`/posts/${postId}/bookmark`, {}); App.toast('Saved to bookmarks ✓'); }
      } catch(e) { btn.classList.toggle('bookmarked'); svg.setAttribute('fill', isBookmarked ? 'currentColor' : 'none'); }
    },

    share(postId) {
      if (navigator.share) {
        navigator.share({ title: 'Trowded Post', url: `${location.origin}/p/${postId}` }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(`${location.origin}/p/${postId}`);
        App.toast('Link copied! 🔗');
      }
    },

    showMenu(postId, username) {
      const isOwn = State.user?.username === username;
      const actions = isOwn
        ? [
            { label: '✏️ Edit',   fn: () => App.post.editPost(postId) },
            { label: '🗑️ Delete', fn: () => App.post.deletePost(postId), danger: true },
          ]
        : [
            { label: '🚩 Report', fn: () => App.post.reportPost(postId) },
            { label: '🚫 Block @' + username, fn: () => App.users.block(username) },
          ];

      /* Simple sheet */
      const existing = document.getElementById('action-sheet');
      if (existing) existing.remove();

      const sheet = document.createElement('div');
      sheet.id = 'action-sheet';
      sheet.className = 'modal-overlay';
      sheet.innerHTML = `<div class="modal-sheet" style="padding:16px;">
        ${actions.map(a => `<button class="settings-item" style="${a.danger ? 'color:#FF4444;' : ''}" onclick="document.getElementById('action-sheet').remove(); (${a.fn.toString()})()">${a.label}</button>`).join('')}
        <button class="settings-item" style="justify-content:center;" onclick="document.getElementById('action-sheet').remove()">Cancel</button>
      </div>`;
      sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
      document.body.appendChild(sheet);
    },

    async deletePost(postId) {
      if (!confirm('Delete this post?')) return;
      try {
        await API.delete(`/posts/${postId}`);
        document.getElementById(`post-${postId}`)?.remove();
        App.toast('Post deleted.');
        if (State.currentPostId === postId) App.nav.back();
      } catch(e) { App.toast(e.message); }
    },

    async reportPost(postId) {
      const reason = prompt('Reason for report?');
      if (!reason) return;
      try {
        await API.post(`/posts/${postId}/report`, { reason });
        App.toast('Report submitted.');
      } catch(e) { App.toast(e.message); }
    },

    editPost(postId) { App.toast('Edit feature coming soon!'); },
  },

  /* ─── COMMENTS ─── */
  comments: {
    _postId: null,

    open(postId) {
      this._postId = postId;
      document.getElementById('modal-comments').classList.remove('hidden');
      document.getElementById('comments-list').innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';
      if (State.user) {
        document.getElementById('comment-avatar').innerHTML = userAvatar(State.user, 36);
      }
      this.load(postId);
    },

    close() {
      document.getElementById('modal-comments').classList.add('hidden');
      this._postId = null;
    },

    async load(postId) {
      try {
        const data = await API.get(`/posts/${postId}/comments?limit=30`);
        const el   = document.getElementById('comments-list');
        if (!data.comments.length) {
          el.innerHTML = '<div class="empty-state" style="padding:24px;"><p>No comments yet. Be the first!</p></div>';
          return;
        }
        el.innerHTML = data.comments.map(c => this._renderComment(c)).join('');
      } catch(e) {
        document.getElementById('comments-list').innerHTML = `<div style="padding:16px;color:var(--text-2);">${escapeHtml(e.message)}</div>`;
      }
    },

    async loadInline(postId, container) {
      try {
        const data = await API.get(`/posts/${postId}/comments?limit=5`);
        container.innerHTML = `<div style="padding:16px;border-top:1px solid var(--border);">
          <h4 style="font-size:14px;font-weight:600;margin-bottom:12px;">Comments (${data.comments.length})</h4>
          ${data.comments.map(c => this._renderComment(c)).join('')}
          <button class="btn-text" onclick="App.comments.open(${postId})">View all comments</button>
        </div>`;
      } catch(_) {}
    },

    _renderComment(c) {
      return `<div class="comment-item">
        <div class="comment-avatar">${userAvatar(c, 32)}</div>
        <div class="comment-body">
          <div class="comment-username">${escapeHtml(c.display_name || c.username)}</div>
          <div class="comment-text">${parseContent(c.content)}</div>
          <div class="comment-meta">
            <span>${timeAgo(c.created_at)}</span>
            <button class="comment-like-btn" onclick="App.comments.likeComment(${c.id}, this)">
              ❤️ ${c.like_count || 0}
            </button>
            <button class="comment-like-btn" onclick="App.comments.replyTo('${escapeHtml(c.username)}')">Reply</button>
          </div>
          ${c.replies && c.replies.length ? `<div style="margin-top:8px;">${c.replies.map(r => this._renderComment(r)).join('')}</div>` : ''}
        </div>
      </div>`;
    },

    async submit() {
      const input = document.getElementById('comment-input');
      const content = input.value.trim();
      if (!content || !this._postId) return;

      input.value = '';
      try {
        const data = await API.post(`/posts/${this._postId}/comments`, { content });
        const el   = document.getElementById('comments-list');
        el.insertAdjacentHTML('afterbegin', this._renderComment(data.comment));

        /* Update comment count on card */
        const card    = document.getElementById(`post-${this._postId}`);
        const countEl = card?.querySelectorAll('.action-btn')[1]?.querySelector('span');
        if (countEl) countEl.textContent = formatCount((parseInt(countEl.textContent) || 0) + 1);
      } catch(e) { App.toast(e.message); }
    },

    async likeComment(id, btn) {
      try {
        await API.post(`/posts/comments/${id}/like`, {});
        const parts = btn.textContent.split(' ');
        btn.textContent = `❤️ ${(parseInt(parts[1]) || 0) + 1}`;
      } catch(e) { App.toast('Already liked'); }
    },

    replyTo(username) {
      const input = document.getElementById('comment-input');
      input.value = `@${username} `;
      input.focus();
    },
  },

  /* ─── EXPLORE ─── */
  explore: {
    _debounceTimer: null,
    _hashtagMode: false,

    async load() {
      this._hashtagMode = false;
      document.getElementById('search-results').classList.add('hidden');
      document.getElementById('explore-content').style.display = '';
      this.loadTrending();
      this.loadGrid();
    },

    async loadTrending() {
      try {
        const data = await API.get('/feed/trending');
        const el   = document.getElementById('explore-trending');
        el.innerHTML = `<h3>🔥 Trending</h3><div class="trending-list">
          ${data.hashtags.map(t => `
            <div class="trending-item" onclick="App.explore.loadHashtag('${escapeHtml(t.name)}')">
              <span class="trending-tag">#${escapeHtml(t.name)}</span>
              <span class="trending-count">${formatCount(t.post_count)} posts</span>
            </div>
          `).join('')}
        </div>`;
      } catch(_) {}
    },

    async loadGrid() {
      try {
        const data = await API.get('/feed/explore?limit=18');
        const el   = document.getElementById('explore-grid');
        el.innerHTML = data.posts.map(p => `
          <div class="explore-grid-item" onclick="App.nav.openPost(${p.id})">
            ${p.media_urls && p.media_urls[0]
              ? `<img src="${escapeHtml(p.media_urls[0])}" alt="" loading="lazy"/>`
              : `<div class="explore-grid-placeholder" style="background:var(--bg-card);">
                  <div class="posts-grid-item-text">${escapeHtml((p.content || '').slice(0, 120))}</div>
                </div>`
            }
            <div class="posts-grid-stats">
              <span>❤️ ${formatCount(p.like_count)}</span>
              <span>💬 ${formatCount(p.comment_count)}</span>
            </div>
          </div>
        `).join('');
      } catch(_) {}
    },

    async loadHashtag(tag) {
      this._hashtagMode = true;
      document.getElementById('explore-content').style.display = 'none';
      const resultsEl = document.getElementById('search-results');
      resultsEl.classList.remove('hidden');
      resultsEl.innerHTML = `<div class="loader-wrap"><div class="spinner"></div></div>`;
      document.getElementById('explore-search-input').value = '#' + tag;

      try {
        const data = await API.get(`/feed/hashtag/${encodeURIComponent(tag)}`);
        resultsEl.innerHTML = `
          <div style="padding:16px;border-bottom:1px solid var(--border);">
            <div style="font-size:22px;font-weight:700;">#${escapeHtml(tag)}</div>
            <div style="font-size:14px;color:var(--text-2);margin-top:4px;">${formatCount(data.hashtag.post_count)} posts</div>
          </div>
          <div class="explore-grid">
            ${data.posts.map(p => `
              <div class="explore-grid-item" onclick="App.nav.openPost(${p.id})">
                ${p.media_urls && p.media_urls[0]
                  ? `<img src="${escapeHtml(p.media_urls[0])}" alt="" loading="lazy"/>`
                  : `<div class="explore-grid-placeholder" style="background:var(--bg-card);padding:8px;"><div class="posts-grid-item-text">${escapeHtml((p.content||'').slice(0,100))}</div></div>`
                }
              </div>
            `).join('')}
          </div>`;
      } catch(e) {
        resultsEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon">😕</div><h3>Not found</h3></div>`;
      }
    },

    debounce() {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => this.runSearch(), 400);
    },

    async runSearch() {
      const q = document.getElementById('explore-search-input').value.trim();
      if (!q || q.startsWith('#')) return;

      const resultsEl = document.getElementById('search-results');
      resultsEl.classList.remove('hidden');
      document.getElementById('explore-content').style.display = 'none';
      resultsEl.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';

      try {
        const data = await API.get(`/search?q=${encodeURIComponent(q)}`);
        resultsEl.innerHTML = this._renderSearchResults(data);
      } catch(e) {
        resultsEl.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
      }
    },

    _renderSearchResults(data) {
      let html = '';
      if (data.users?.length) {
        html += `<div class="search-results-section"><div class="search-section-title">People</div>
          ${data.users.map(u => `
            <div class="search-user-item" onclick="App.nav.userProfile('${escapeHtml(u.username)}')">
              <div class="post-avatar">${userAvatar(u, 44)}</div>
              <div style="flex:1;">
                <div style="font-weight:600;font-size:14px;">${escapeHtml(u.display_name || u.username)} ${u.is_verified ? '<span class="verified-badge">✓</span>' : ''}</div>
                <div style="font-size:12px;color:var(--text-3);">@${escapeHtml(u.username)} · ${formatCount(u.follower_count)} followers</div>
              </div>
            </div>
          `).join('')}</div>`;
      }
      if (data.hashtags?.length) {
        html += `<div class="search-results-section"><div class="search-section-title">Hashtags</div>
          <div style="display:flex;flex-wrap:wrap;padding:4px 0;">
            ${data.hashtags.map(t => `
              <div class="search-tag-chip" onclick="App.explore.loadHashtag('${escapeHtml(t.name)}')">
                <span class="search-tag-name">#${escapeHtml(t.name)}</span>
                <span class="search-tag-count">${formatCount(t.post_count)}</span>
              </div>
            `).join('')}
          </div></div>`;
      }
      if (!html) html = '<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>No results</h3></div>';
      return html;
    },
  },

  /* ─── SEARCH (full screen) ─── */
  search: {
    _timer: null,
    async fullSearch() {
      clearTimeout(this._timer);
      this._timer = setTimeout(async () => {
        const q  = document.getElementById('search-input-full').value.trim();
        const el = document.getElementById('search-full-results');
        if (!q) { el.innerHTML = ''; return; }

        el.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';
        try {
          const data = await API.get(`/search?q=${encodeURIComponent(q)}`);
          el.innerHTML = App.explore._renderSearchResults(data);
        } catch(e) {
          el.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
        }
      }, 350);
    },
  },

  /* ─── NOTIFICATIONS ─── */
  notifications: {
    async load() {
      const el = document.getElementById('notif-list');
      el.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';
      try {
        const data = await API.get('/notifications?limit=30');
        if (!data.notifications.length) {
          el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔔</div><h3>No notifications yet</h3><p>When people like or comment on your posts, you\'ll see it here.</p></div>';
          return;
        }
        el.innerHTML = data.notifications.map(n => this._renderNotif(n)).join('');
        /* Mark all as read after viewing */
        setTimeout(() => API.post('/notifications/read-all', {}).catch(() => {}), 2000);
      } catch(e) {
        el.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
      }
    },

    async loadUnreadCount() {
      try {
        const data = await API.get('/notifications/unread-count');
        const badge = document.getElementById('notif-badge');
        if (data.count > 0) {
          badge.textContent = data.count > 99 ? '99+' : data.count;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
      } catch(_) {}
    },

    _renderNotif(n) {
      const icons = { like: '❤️', comment: '💬', follow: '👤', message: '✉️', mention: '@' };
      const iconClasses = { like: 'like', comment: 'comment', follow: 'follow', message: 'message' };
      return `<div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="App.notifications.handleClick(${JSON.stringify(n).replace(/</g,'\\u003c')})">
        <div class="notif-avatar">${n.actor_avatar ? `<img src="${escapeHtml(n.actor_avatar)}" alt=""/>` : avatarPlaceholder(n.actor_display_name || '?')}</div>
        <div class="notif-content">
          <div class="notif-text"><b>${escapeHtml(n.actor_display_name || 'Someone')}</b> ${escapeHtml(n.message)}</div>
          <div class="notif-time">${timeAgo(n.created_at)}</div>
        </div>
        <div class="notif-icon ${iconClasses[n.type] || ''}">${icons[n.type] || '🔔'}</div>
      </div>`;
    },

    handleClick(n) {
      if (n.type === 'follow') App.nav.userProfile(n.actor_id || n.actor_username);
      else if (['like', 'comment', 'mention'].includes(n.type) && n.entity_id) App.nav.openPost(n.entity_id);
      else if (n.type === 'message') App.nav.go('chat');
    },
  },

  /* ─── PROFILE ─── */
  profile: {
    async loadOwn() {
      const el = document.getElementById('profile-content');
      el.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';
      try {
        const data = await API.get('/auth/me');
        State.user = data.user;
        this.renderFull(data.user, el, true);
      } catch(e) {
        el.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
      }
    },

    renderFull(user, container, isOwn = false) {
      container.innerHTML = `
        <div class="profile-cover">
          ${user.cover_url ? `<img src="${escapeHtml(user.cover_url)}" alt="cover"/>` : ''}
          <div class="profile-cover-gradient"></div>
        </div>
        <div class="profile-header">
          <div class="profile-avatar-row">
            <div class="profile-big-avatar">
              ${user.avatar_url ? `<img src="${escapeHtml(user.avatar_url)}" alt=""/>` : `<div class="profile-big-avatar-placeholder">${avatarPlaceholder(user.display_name)}</div>`}
            </div>
            <div class="profile-actions">
              ${isOwn
                ? `<button class="btn-outline" onclick="App.nav.go('edit-profile')">Edit Profile</button>
                   <button class="btn-outline" onclick="App.nav.go('settings')">⚙️</button>`
                : `<button class="${user.is_following ? 'btn-following' : 'btn-follow'}" id="follow-btn-${user.id}" onclick="App.users.toggleFollow(${user.id}, '${escapeHtml(user.username)}')">
                     ${user.is_following ? 'Following' : 'Follow'}
                   </button>
                   <button class="btn-outline" onclick="App.chat.openWithUser(${user.id})">Message</button>`
              }
            </div>
          </div>
          <div class="profile-display-name">
            ${escapeHtml(user.display_name || user.username)}
            ${user.is_verified ? '<span class="verified-badge">✓</span>' : ''}
          </div>
          <div class="profile-username">@${escapeHtml(user.username)}</div>
          ${user.bio ? `<div class="profile-bio">${escapeHtml(user.bio)}</div>` : ''}
          ${user.website ? `<a href="${escapeHtml(user.website)}" class="profile-website" target="_blank" rel="noopener">${escapeHtml(user.website)}</a>` : ''}
          <div class="profile-stats">
            <div class="stat-item" onclick="App.nav.openPost && App.profile.showPosts(${user.id})">
              <span class="stat-number">${formatCount(user.post_count)}</span>
              <span class="stat-label">Posts</span>
            </div>
            <div class="stat-item" onclick="App.users.showList(${user.id}, 'followers')">
              <span class="stat-number">${formatCount(user.follower_count)}</span>
              <span class="stat-label">Followers</span>
            </div>
            <div class="stat-item" onclick="App.users.showList(${user.id}, 'following')">
              <span class="stat-number">${formatCount(user.following_count)}</span>
              <span class="stat-label">Following</span>
            </div>
          </div>
        </div>
        <div class="profile-tabs">
          <button class="profile-tab active" onclick="App.profile.loadTab(${user.id}, 'posts', this)">Posts</button>
          ${isOwn ? '<button class="profile-tab" onclick="App.profile.loadTab(\'' + user.id + '\', \'bookmarks\', this)">Saved</button>' : ''}
        </div>
        <div id="profile-tab-content"></div>
      `;
      this.loadTab(user.id, 'posts', null, isOwn);
    },

    async loadTab(userId, tab, tabEl, isOwn) {
      if (tabEl) {
        document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
        tabEl.classList.add('active');
      }
      const el = document.getElementById('profile-tab-content');
      el.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';

      try {
        let posts;
        if (tab === 'bookmarks') {
          const data = await API.get('/posts/bookmarks/all?limit=30');
          posts = data.posts;
        } else {
          const data = await API.get(`/posts/user/${userId}?limit=30`);
          posts = data.posts;
        }

        if (!posts.length) {
          el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📷</div><h3>No posts yet</h3></div>';
          return;
        }

        el.innerHTML = `<div class="posts-grid">${posts.map(p => `
          <div class="posts-grid-item" onclick="App.nav.openPost(${p.id})">
            ${p.media_urls && p.media_urls[0]
              ? `<img src="${escapeHtml(p.media_urls[0])}" alt="" loading="lazy"/>`
              : `<div class="posts-grid-item-text">${escapeHtml((p.content||'').slice(0,120))}</div>`
            }
            <div class="posts-grid-stats">
              <span>❤️ ${formatCount(p.like_count)}</span>
              <span>💬 ${formatCount(p.comment_count)}</span>
            </div>
          </div>
        `).join('')}</div>`;
      } catch(e) {
        el.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
      }
    },

    renderEdit() {
      const user = State.user;
      if (!user) return;
      document.getElementById('edit-profile-content').innerHTML = `
        <div class="edit-profile-form">
          <div class="edit-profile-avatar">
            <label for="avatar-input" class="edit-profile-avatar-img">
              ${user.avatar_url ? `<img src="${escapeHtml(user.avatar_url)}" alt="" style="width:80px;height:80px;border-radius:50%;object-fit:cover;"/>` : `<div style="font-size:28px;font-weight:700;color:var(--text-2);">${avatarPlaceholder(user.display_name)}</div>`}
              <div class="edit-avatar-overlay">📷</div>
            </label>
            <span class="edit-profile-label">Change photo</span>
            <input type="file" id="avatar-input" accept="image/*" class="hidden" onchange="App.profile.uploadAvatar(event)"/>
          </div>
          <div class="edit-form-field">
            <label>Display Name</label>
            <input id="edit-display-name" type="text" value="${escapeHtml(user.display_name || '')}" maxlength="80"/>
          </div>
          <div class="edit-form-field">
            <label>Bio</label>
            <textarea id="edit-bio" maxlength="160">${escapeHtml(user.bio || '')}</textarea>
          </div>
          <div class="edit-form-field">
            <label>Website</label>
            <input id="edit-website" type="url" value="${escapeHtml(user.website || '')}" placeholder="https://..."/>
          </div>
          <div class="edit-form-field">
            <label>Location</label>
            <input id="edit-location" type="text" value="${escapeHtml(user.location || '')}" maxlength="100"/>
          </div>
        </div>
      `;
    },

    async uploadAvatar(e) {
      const file = e.target.files[0];
      if (!file) return;
      const form = new FormData();
      form.append('avatar', file);
      try {
        App.toast('Uploading…');
        const data = await API.upload('/upload/avatar', form);
        State.user.avatar_url = data.url;
        App.toast('Avatar updated! ✓');
        App.updateNavAvatar();
        this.renderEdit();
      } catch(e) { App.toast(e.message); }
    },

    async saveEdit() {
      const display_name = document.getElementById('edit-display-name')?.value.trim();
      const bio          = document.getElementById('edit-bio')?.value.trim();
      const website      = document.getElementById('edit-website')?.value.trim();
      const location     = document.getElementById('edit-location')?.value.trim();

      try {
        const data = await API.patch('/users/profile', { display_name, bio, website, location });
        State.user = { ...State.user, ...data.user };
        App.toast('Profile saved! ✓');
        App.nav.back();
        App.updateNavAvatar();
      } catch(e) { App.toast(e.message); }
    },
  },

  /* ─── USERS ─── */
  users: {
    async toggleFollow(userId, username) {
      const btn = document.getElementById(`follow-btn-${userId}`);
      const isFollowing = btn?.classList.contains('btn-following');

      try {
        if (isFollowing) {
          await API.delete(`/users/${userId}/follow`);
          if (btn) { btn.textContent = 'Follow'; btn.className = 'btn-follow'; }
          App.toast('Unfollowed @' + username);
        } else {
          const data = await API.post(`/users/${userId}/follow`, {});
          if (btn) {
            btn.textContent = data.status === 'pending' ? 'Requested' : 'Following';
            btn.className = 'btn-following';
          }
          App.toast(data.status === 'pending' ? 'Follow request sent' : 'Following @' + username + ' 👋');
        }
      } catch(e) { App.toast(e.message); }
    },

    async block(username) {
      if (!confirm(`Block @${username}?`)) return;
      try {
        const user = await API.get(`/users/${username}`);
        await API.post(`/users/${user.user.id}/block`, {});
        App.toast(`@${username} blocked.`);
        App.nav.back();
      } catch(e) { App.toast(e.message); }
    },

    async showList(userId, type) {
      const data = await API.get(`/users/${userId}/${type}?limit=30`);
      const existing = document.getElementById('action-sheet');
      if (existing) existing.remove();
      const sheet = document.createElement('div');
      sheet.id = 'action-sheet';
      sheet.className = 'modal-overlay';
      sheet.innerHTML = `<div class="modal-sheet" style="max-height:70vh;overflow-y:auto;">
        <div class="modal-header">${type.charAt(0).toUpperCase() + type.slice(1)}
          <button class="icon-btn" onclick="document.getElementById('action-sheet').remove()">✕</button>
        </div>
        <div style="padding:8px 16px;">
          ${(data.users || []).map(u => `
            <div class="search-user-item" onclick="document.getElementById('action-sheet').remove(); App.nav.userProfile('${escapeHtml(u.username)}')">
              <div class="post-avatar" style="width:44px;height:44px;">${userAvatar(u, 44)}</div>
              <div style="flex:1;">
                <div style="font-weight:600;">${escapeHtml(u.display_name || u.username)} ${u.is_verified ? '<span class="verified-badge">✓</span>' : ''}</div>
                <div style="font-size:12px;color:var(--text-3);">@${escapeHtml(u.username)}</div>
              </div>
              ${u.is_following !== undefined ? `<button class="${u.is_following ? 'btn-following' : 'btn-follow'}" style="font-size:12px;padding:6px 14px;" onclick="event.stopPropagation();App.users.toggleFollow(${u.id}, '${escapeHtml(u.username)}')">${u.is_following ? 'Following' : 'Follow'}</button>` : ''}
            </div>
          `).join('') || '<div class="empty-state" style="padding:24px;"><p>No users yet</p></div>'}
        </div>
      </div>`;
      sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
      document.body.appendChild(sheet);
    },
  },

  /* ─── CHAT ─── */
  chat: {
    _convId: null,
    _ws: null,

    async loadList() {
      const el = document.getElementById('chat-list');
      el.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';
      try {
        const data = await API.get('/chat/conversations');
        if (!data.conversations.length) {
          el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✉️</div><h3>No messages</h3><p>Start a conversation with someone you follow.</p></div>';
          return;
        }
        el.innerHTML = data.conversations.map(c => `
          <div class="chat-item" onclick="App.chat.openConversation(${c.id})">
            <div class="chat-avatar">${c.other_user ? userAvatar(c.other_user, 50) : '?'}</div>
            <div class="chat-info">
              <div class="chat-name">
                ${escapeHtml(c.other_user?.display_name || c.other_user?.username || 'Unknown')}
                ${c.last_message_at ? `<span class="chat-time">${timeAgo(c.last_message_at)}</span>` : ''}
              </div>
              <div class="chat-last-msg">${escapeHtml(c.last_message || 'No messages yet')}</div>
            </div>
            ${c.unread_count > 0 ? `<span class="chat-unread">${c.unread_count}</span>` : ''}
          </div>
        `).join('');
      } catch(e) {
        el.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
      }
    },

    async openConversation(convId) {
      this._convId = convId;
      App.nav.go('conversation');
      await this.loadMessages(convId);
      this.connectWS(convId);
    },

    async openWithUser(userId) {
      try {
        const data = await API.post('/chat/conversations', { user_id: userId });
        this.openConversation(data.conversation_id);
      } catch(e) { App.toast(e.message); }
    },

    async loadMessages(convId) {
      const el = document.getElementById('messages-container');
      el.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';
      try {
        /* Get other user info */
        const convs = await API.get('/chat/conversations');
        const conv  = (convs.conversations || []).find(c => c.id === convId);
        if (conv?.other_user) {
          document.getElementById('conv-user-info').innerHTML = `
            <div class="post-avatar" style="width:36px;height:36px;">${userAvatar(conv.other_user, 36)}</div>
            <div>
              <div style="font-weight:600;font-size:14px;">${escapeHtml(conv.other_user.display_name || conv.other_user.username)}</div>
              <div style="font-size:11px;color:var(--text-3);">@${escapeHtml(conv.other_user.username)}</div>
            </div>
          `;
        }

        const data = await API.get(`/chat/conversations/${convId}/messages`);
        this.renderMessages(el, data.messages);
      } catch(e) {
        el.innerHTML = `<div class="empty-state"><p>${escapeHtml(e.message)}</p></div>`;
      }
    },

    renderMessages(el, messages) {
      if (!messages.length) {
        el.innerHTML = '<div class="empty-state" style="padding:32px;"><div class="empty-state-icon">👋</div><p>Say hello!</p></div>';
        return;
      }
      el.innerHTML = messages.map(m => {
        const isMine = m.sender_id === State.user?.id;
        return `<div style="display:flex;justify-content:${isMine ? 'flex-end' : 'flex-start'};">
          <div class="msg-bubble ${isMine ? 'msg-sent' : 'msg-received'}">
            ${escapeHtml(m.content)}
            <div class="msg-time">${timeAgo(m.created_at)}</div>
          </div>
        </div>`;
      }).join('');
      el.scrollTop = el.scrollHeight;
    },

    async sendMessage() {
      const input = document.getElementById('message-input');
      const content = input.value.trim();
      if (!content || !this._convId) return;
      input.value = '';

      try {
        const data = await API.post(`/chat/conversations/${this._convId}/messages`, { content });
        const el = document.getElementById('messages-container');
        el.insertAdjacentHTML('beforeend', `
          <div style="display:flex;justify-content:flex-end;">
            <div class="msg-bubble msg-sent">
              ${escapeHtml(data.message.content)}
              <div class="msg-time">Just now</div>
            </div>
          </div>
        `);
        el.scrollTop = el.scrollHeight;
      } catch(e) { App.toast(e.message); }
    },

    connectWS(convId) {
      if (this._ws) { this._ws.close(); this._ws = null; }
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/ws`);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token: API.getTokens().access }));
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'auth_ok') {
            ws.send(JSON.stringify({ type: 'subscribe', conversation_id: convId }));
          } else if (msg.type === 'new_message' && msg.message.sender_id !== State.user?.id) {
            const el = document.getElementById('messages-container');
            if (el) {
              el.insertAdjacentHTML('beforeend', `
                <div style="display:flex;justify-content:flex-start;">
                  <div class="msg-bubble msg-received">
                    ${escapeHtml(msg.message.content)}
                    <div class="msg-time">Just now</div>
                  </div>
                </div>
              `);
              el.scrollTop = el.scrollHeight;
            }
          }
        } catch(_) {}
      };
      ws.onerror = () => {};
      ws.onclose = () => {};
      this._ws = ws;
    },

    showNewDM() {
      const q = prompt('Search username to message:');
      if (q) {
        API.get(`/search/users?q=${encodeURIComponent(q)}&limit=5`).then(data => {
          if (!data.users?.length) { App.toast('No users found'); return; }
          const u = data.users[0];
          this.openWithUser(u.id);
        }).catch(e => App.toast(e.message));
      }
    },
  },

  /* ─── SETTINGS ─── */
  settings: {
    render() {
      const user = State.user;
      document.getElementById('settings-content').innerHTML = `
        <div class="settings-section">
          <div class="settings-section-title">Account</div>
          <div class="settings-item" onclick="App.nav.go('edit-profile')">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:rgba(123,97,255,0.15);">👤</div>
              <div><div class="settings-item-text">Edit Profile</div></div>
            </div>
            <span class="settings-arrow">›</span>
          </div>
          <div class="settings-item" onclick="App.settings.changePassword()">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:rgba(255,97,171,0.15);">🔑</div>
              <div><div class="settings-item-text">Change Password</div></div>
            </div>
            <span class="settings-arrow">›</span>
          </div>
          <div class="settings-item" onclick="App.nav.go('2fa')">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:rgba(0,210,180,0.15);">🛡️</div>
              <div>
                <div class="settings-item-text">Two-Factor Authentication</div>
                <div class="settings-item-sub">${user?.two_fa_enabled ? 'Enabled ✓' : 'Disabled'}</div>
              </div>
            </div>
            <span class="settings-arrow">›</span>
          </div>
          <div class="settings-item" onclick="App.settings.viewSessions()">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:rgba(255,193,7,0.15);">📱</div>
              <div>
                <div class="settings-item-text">Active Sessions</div>
                <div class="settings-item-sub">Manage logged-in devices</div>
              </div>
            </div>
            <span class="settings-arrow">›</span>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-title">Privacy</div>
          <div class="settings-item">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:rgba(123,97,255,0.15);">🔒</div>
              <div>
                <div class="settings-item-text">Private Account</div>
                <div class="settings-item-sub">Only followers see your posts</div>
              </div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" ${user?.is_private ? 'checked' : ''} onchange="App.settings.togglePrivacy(this.checked)"/>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
        <div class="settings-section">
          <div class="settings-section-title">Danger Zone</div>
          <div class="settings-item" onclick="App.auth.logout()">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:rgba(255,68,68,0.15);">🚪</div>
              <div><div class="settings-item-text" style="color:#FF4444;">Log Out</div></div>
            </div>
          </div>
          <div class="settings-item" onclick="App.auth.logout()" style="opacity:0.7;">
            <div class="settings-item-left">
              <div class="settings-item-icon" style="background:rgba(255,68,68,0.1);">🗑️</div>
              <div>
                <div class="settings-item-text" style="color:#FF6666;">Log Out All Devices</div>
                <div class="settings-item-sub">Sign out everywhere</div>
              </div>
            </div>
          </div>
        </div>
        <div style="padding:24px;text-align:center;color:var(--text-3);font-size:12px;">
          Trowded v1.0.0 · Made with ❤️<br/>
          Logged in as @${escapeHtml(user?.username || '')}
        </div>
      `;
    },

    async togglePrivacy(isPrivate) {
      try {
        await API.patch('/users/privacy', { is_private: isPrivate });
        if (State.user) State.user.is_private = isPrivate;
        App.toast(isPrivate ? 'Account set to private 🔒' : 'Account set to public 🌍');
      } catch(e) { App.toast(e.message); }
    },

    async changePassword() {
      const current = prompt('Current password:');
      if (!current) return;
      const newPw   = prompt('New password (8+ chars, A-Z, a-z, 0-9):');
      if (!newPw) return;

      try {
        await API.post('/auth/change-password', { current_password: current, new_password: newPw });
        App.toast('Password changed. Please log in again.');
        setTimeout(() => App.auth.logout(), 1500);
      } catch(e) { App.toast(e.message); }
    },

    async viewSessions() {
      try {
        const data = await API.get('/auth/sessions');
        const existing = document.getElementById('action-sheet');
        if (existing) existing.remove();
        const sheet = document.createElement('div');
        sheet.id = 'action-sheet';
        sheet.className = 'modal-overlay';
        sheet.innerHTML = `<div class="modal-sheet">
          <div class="modal-header">Active Sessions
            <button class="icon-btn" onclick="document.getElementById('action-sheet').remove()">✕</button>
          </div>
          <div style="padding:8px 16px;">
            ${data.sessions.map(s => `
              <div class="settings-item">
                <div class="settings-item-left">
                  <div class="settings-item-icon" style="background:var(--bg-elevated);">📱</div>
                  <div>
                    <div class="settings-item-text" style="font-size:13px;">${escapeHtml(s.device_info || 'Unknown device').slice(0,50)}</div>
                    <div class="settings-item-sub">${escapeHtml(s.ip_address)} · ${timeAgo(s.created_at)}</div>
                  </div>
                </div>
                <button class="btn-text" style="color:#FF4444;" onclick="App.settings.revokeSession(${s.id})">Revoke</button>
              </div>
            `).join('')}
          </div>
        </div>`;
        sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
        document.body.appendChild(sheet);
      } catch(e) { App.toast(e.message); }
    },

    async revokeSession(id) {
      try {
        await API.delete(`/auth/sessions/${id}`);
        App.toast('Session revoked.');
        document.getElementById('action-sheet')?.remove();
        this.viewSessions();
      } catch(e) { App.toast(e.message); }
    },

    render2FA() {
      const user = State.user;
      const el   = document.getElementById('twofa-content');
      el.innerHTML = `
        <div style="padding:24px;">
          <div style="text-align:center;margin-bottom:28px;">
            <div style="font-size:48px;margin-bottom:12px;">🛡️</div>
            <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">Two-Factor Authentication</h2>
            <p style="color:var(--text-2);line-height:1.5;">Add an extra layer of security to your account with a time-based one-time password (TOTP).</p>
          </div>
          <div style="background:var(--bg-card);border-radius:var(--r-md);padding:16px;margin-bottom:20px;border:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:40px;height:40px;background:rgba(0,210,180,0.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;">✓</div>
              <div>
                <div style="font-weight:600;">Status: ${user?.two_fa_enabled ? '<span style="color:#00D2B4;">Enabled</span>' : '<span style="color:var(--text-3);">Disabled</span>'}</div>
                <div style="font-size:12px;color:var(--text-2);">Use Google Authenticator or similar app</div>
              </div>
            </div>
          </div>
          ${user?.two_fa_enabled
            ? `<button class="btn-outline btn-full" style="color:#FF4444;border-color:#FF4444;" onclick="App.settings.disable2FA()">Disable 2FA</button>`
            : `<button class="btn-primary btn-full" onclick="App.settings.setup2FA()">Enable 2FA</button>`
          }
        </div>
      `;
    },

    async setup2FA() {
      const el = document.getElementById('twofa-content');
      el.innerHTML = '<div class="loader-wrap"><div class="spinner"></div></div>';
      try {
        const data = await API.post('/auth/2fa/setup', {});
        el.innerHTML = `
          <div style="padding:24px;">
            <h3 style="margin-bottom:16px;">Scan QR Code</h3>
            ${data.qr_code ? `<div style="text-align:center;margin-bottom:16px;"><img src="${data.qr_code}" alt="QR Code" style="border-radius:8px;max-width:200px;"/></div>` : ''}
            <p style="color:var(--text-2);font-size:13px;margin-bottom:16px;">
              Scan with <b>Google Authenticator</b>, <b>Authy</b>, or any TOTP app.<br/><br/>
              Manual key: <code style="background:var(--bg-elevated);padding:2px 6px;border-radius:4px;font-size:12px;">${escapeHtml(data.secret)}</code>
            </p>
            <div class="edit-form-field">
              <label>Enter 6-digit code to confirm</label>
              <input id="totp-confirm" type="text" inputmode="numeric" maxlength="6" placeholder="000000"/>
            </div>
            <button class="btn-primary btn-full" onclick="App.settings.confirm2FA()">Confirm & Enable</button>
          </div>
        `;
      } catch(e) { App.toast(e.message); this.render2FA(); }
    },

    async confirm2FA() {
      const code = document.getElementById('totp-confirm')?.value.trim();
      if (!code) { App.toast('Enter the code first.'); return; }
      try {
        await API.post('/auth/2fa/enable', { totp_code: code });
        if (State.user) State.user.two_fa_enabled = true;
        App.toast('2FA enabled! Your account is now more secure. 🛡️');
        this.render2FA();
      } catch(e) { App.toast(e.message); }
    },

    async disable2FA() {
      const password = prompt('Enter your password to disable 2FA:');
      if (!password) return;
      const code = prompt('Enter current 2FA code:');
      try {
        await API.post('/auth/2fa/disable', { password, totp_code: code });
        if (State.user) State.user.two_fa_enabled = false;
        App.toast('2FA disabled.');
        this.render2FA();
      } catch(e) { App.toast(e.message); }
    },
  },
};

/* ─── Register password input listener ─── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('reg-password')?.addEventListener('input', e => checkPasswordStrength(e.target.value));

  /* Infinite scroll for home feed */
  App.feed.setupInfiniteScroll();

  /* Close modals on overlay click */
  document.getElementById('modal-create-post').addEventListener('click', e => {
    if (e.target === e.currentTarget) App.post.closeCreate();
  });
  document.getElementById('modal-comments').addEventListener('click', e => {
    if (e.target === e.currentTarget) App.comments.close();
  });
});

/* ─── Kick off ─── */
App.init();
