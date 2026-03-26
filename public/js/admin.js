/* Yönetim Paneli */
let roleTargetId  = null;
let deleteTarget  = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
    window.location.href = '/';
    return;
  }

  await loadStats();
  await loadUsers();

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'articles') await loadAdminArticles();
    });
  });

  document.getElementById('closeRoleModal').addEventListener('click', closeRoleModal);
  document.getElementById('cancelRoleBtn').addEventListener('click', closeRoleModal);
  document.getElementById('confirmRoleBtn').addEventListener('click', doRoleChange);
  document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDeleteBtn').addEventListener('click', doDelete);
});

async function loadStats() {
  const s = await GET('/admin/stats').catch(() => ({}));
  document.getElementById('sUsers').textContent    = s.totalUsers    ?? '—';
  document.getElementById('sArticles').textContent = s.totalArticles ?? '—';
  document.getElementById('sApproved').textContent = s.approved      ?? '—';
  document.getElementById('sPending').textContent  = s.pending       ?? '—';
  document.getElementById('sComments').textContent = s.totalComments ?? '—';
  document.getElementById('sViews').textContent    = s.totalViews    ?? '—';

  // Grafik çubukları
  const total = s.totalArticles || 1;
  renderBar('barApproved', (s.approved / total) * 100, 'green',  `Onaylı: ${s.approved}`);
  renderBar('barPending',  (s.pending  / total) * 100, 'orange', `Bekleyen: ${s.pending}`);
  renderBar('barRejected', ((s.totalArticles - s.approved - s.pending) / total) * 100, 'red', `Reddedilen: ${s.totalArticles - s.approved - s.pending}`);
}

function renderBar(id, pct, color, label) {
  const el = document.getElementById(id);
  if (!el) return;
  el.querySelector('.chart-bar-label').innerHTML = `<span>${label}</span><span>${Math.round(pct)}%</span>`;
  el.querySelector('.chart-bar-fill').style.width = Math.max(0, pct) + '%';
  el.querySelector('.chart-bar-fill').className = `chart-bar-fill ${color}`;
}

async function loadUsers() {
  const users = await GET('/admin/users').catch(() => []);
  const tbody = document.getElementById('usersBody');
  const me = Auth.getUser();
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:24px">Kullanıcı bulunamadı.</td></tr>';
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td style="color:var(--gray-400);font-size:.8rem">#${u.id}</td>
      <td><strong>${escHtml(u.username)}</strong></td>
      <td style="color:var(--gray-400)">${escHtml(u.email)}</td>
      <td>${roleBadge(u.role)}</td>
      <td>${u.article_count}</td>
      <td>${fmtDateShort(u.created_at)}</td>
      <td>
        <div class="d-flex gap-2">
          ${u.id !== me.id ? `
            <button class="btn btn-secondary btn-sm" onclick="openRoleModal(${u.id}, '${escHtml(u.username)}', '${u.role}')">Rol Değiştir</button>
            <button class="btn btn-danger btn-sm" onclick="openDeleteModal('user', ${u.id}, '${escHtml(u.username)}')">Sil</button>
          ` : '<span class="badge badge-admin">Siz</span>'}
        </div>
      </td>
    </tr>`).join('');
}

async function loadAdminArticles() {
  const data = await GET('/moderation/all').catch(() => ({ articles: [] }));
  const tbody = document.getElementById('adminArticlesBody');
  if (!data.articles.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding:24px">Makale bulunamadı.</td></tr>';
    return;
  }
  tbody.innerHTML = data.articles.map(a => `
    <tr>
      <td style="color:var(--gray-400);font-size:.8rem">#${a.id}</td>
      <td><strong>${escHtml(a.title)}</strong></td>
      <td>${escHtml(a.author)}</td>
      <td>${statusBadge(a.status)}</td>
      <td>${a.views ?? 0}</td>
      <td>${fmtDateShort(a.created_at)}</td>
      <td>
        <div class="d-flex gap-2">
          ${a.status === 'approved' ? `<a href="/article.html?id=${a.id}" class="btn btn-secondary btn-sm" target="_blank">Görüntüle</a>` : ''}
          <button class="btn btn-danger btn-sm" onclick="openDeleteModal('article', ${a.id}, '${escHtml(a.title).replace(/'/g,"\\'")}')">Sil</button>
        </div>
      </td>
    </tr>`).join('');
}

function openRoleModal(id, username, currentRole) {
  roleTargetId = id;
  document.getElementById('roleUsername').textContent = username;
  document.getElementById('newRole').value = currentRole;
  document.getElementById('roleModal').classList.add('show');
}
function closeRoleModal() {
  document.getElementById('roleModal').classList.remove('show');
  roleTargetId = null;
}
async function doRoleChange() {
  const role = document.getElementById('newRole').value;
  try {
    await PUT('/admin/users/' + roleTargetId + '/role', { role });
    closeRoleModal();
    await loadUsers();
    showToast('Rol güncellendi.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openDeleteModal(type, id, name) {
  deleteTarget = { type, id };
  document.getElementById('deleteModalTitle').textContent = type === 'user' ? 'Kullanıcıyı Sil' : 'Makaleyi Sil';
  document.getElementById('deleteModalMsg').textContent = `"${name}" ${type === 'user' ? 'adlı kullanıcıyı' : 'başlıklı makaleyi'} kalıcı olarak silmek istediğinizden emin misiniz?`;
  document.getElementById('deleteModal').classList.add('show');
}
function closeDeleteModal() {
  document.getElementById('deleteModal').classList.remove('show');
  deleteTarget = null;
}
async function doDelete() {
  if (!deleteTarget) return;
  const path = deleteTarget.type === 'user'
    ? '/admin/users/' + deleteTarget.id
    : '/admin/articles/' + deleteTarget.id;
  const savedTarget = { ...deleteTarget };
  closeDeleteModal();
  try {
    await DEL(path);
    await loadStats();
    if (savedTarget.type === 'user') await loadUsers();
    else await loadAdminArticles();
    showToast('Başarıyla silindi.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
