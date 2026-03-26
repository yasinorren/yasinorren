/* Yönetim Paneli */
let roleTargetId  = null;
let deleteTarget  = null; // { type: 'user'|'article', id }

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
    window.location.href = '/';
    return;
  }

  await loadStats();
  await loadUsers();

  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      if (btn.dataset.tab === 'articles') await loadAdminArticles();
    });
  });

  // Role modal
  document.getElementById('closeRoleModal').addEventListener('click', closeRoleModal);
  document.getElementById('cancelRoleBtn').addEventListener('click', closeRoleModal);
  document.getElementById('confirmRoleBtn').addEventListener('click', doRoleChange);

  // Delete modal
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
}

async function loadUsers() {
  const users = await GET('/admin/users').catch(() => []);
  const tbody = document.getElementById('usersBody');
  const me = Auth.getUser();
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>${u.id}</td>
      <td><strong>${escHtml(u.username)}</strong></td>
      <td>${escHtml(u.email)}</td>
      <td>${roleBadge(u.role)}</td>
      <td>${u.article_count}</td>
      <td>${fmtDateShort(u.created_at)}</td>
      <td>
        <div class="d-flex gap-2">
          ${u.id !== me.id ? `
            <button class="btn btn-secondary btn-sm" onclick="openRoleModal(${u.id}, '${escHtml(u.username)}', '${u.role}')">Rol</button>
            <button class="btn btn-danger btn-sm" onclick="openDeleteModal('user', ${u.id}, '${escHtml(u.username)}')">Sil</button>
          ` : '<span class="text-small text-muted">(siz)</span>'}
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
      <td>${a.id}</td>
      <td><strong>${escHtml(a.title)}</strong></td>
      <td>${escHtml(a.author)}</td>
      <td>${statusBadge(a.status)}</td>
      <td>${a.views ?? 0}</td>
      <td>${fmtDateShort(a.created_at)}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="openDeleteModal('article', ${a.id}, '${escHtml(a.title).slice(0,40)}')">Sil</button>
      </td>
    </tr>`).join('');
}

// Role Modal
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
    showAlert('adminAlert', 'success', 'Rol güncellendi.');
  } catch (err) {
    showAlert('adminAlert', 'error', err.message);
  }
}

// Delete Modal
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
  try {
    await DEL(path);
    closeDeleteModal();
    await loadStats();
    if (deleteTarget?.type === 'user') await loadUsers();
  } catch (err) {
    showAlert('adminAlert', 'error', err.message);
    closeDeleteModal();
  }
}
