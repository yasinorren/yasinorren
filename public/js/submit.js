let refCount = 0;

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.isLoggedIn()) {
    document.getElementById('authWarning').classList.remove('hidden');
    document.getElementById('submitLayout').classList.add('hidden');
    return;
  }

  // Load categories
  const cats = await GET('/articles/categories').catch(() => []);
  const sel  = document.getElementById('category_id');
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });

  // Add reference button
  document.getElementById('addRefBtn').addEventListener('click', addRefRow);

  // Submit
  document.getElementById('submitForm').addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert('alertBox');

    const title       = document.getElementById('title').value.trim();
    const category_id = document.getElementById('category_id').value;
    const summary     = document.getElementById('summary').value.trim();
    const content     = document.getElementById('content').value.trim();

    if (!title)       { showAlert('alertBox', 'error', 'Başlık zorunludur.'); return; }
    if (!category_id) { showAlert('alertBox', 'error', 'Kategori seçin.'); return; }
    if (!summary)     { showAlert('alertBox', 'error', 'Özet zorunludur.'); return; }
    if (!content)     { showAlert('alertBox', 'error', 'İçerik zorunludur.'); return; }

    const references = collectRefs();

    const btn = document.getElementById('submitBtn');
    btn.disabled    = true;
    btn.textContent = 'Gönderiliyor...';

    try {
      const data = await POST('/articles', { title, category_id: parseInt(category_id), summary, content, references });
      showAlert('alertBox', 'success', 'Makaleniz alındı! Moderatör incelemesinin ardından yayınlanacaktır.');
      document.getElementById('submitForm').reset();
      document.getElementById('refsList').innerHTML = '';
      refCount = 0;
    } catch (err) {
      showAlert('alertBox', 'error', err.message);
    } finally {
      btn.disabled    = false;
      btn.textContent = 'Makaleyi Gönder';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
});

function addRefRow() {
  refCount++;
  const id = 'ref_' + refCount;
  const div = document.createElement('div');
  div.className = 'ref-row';
  div.id = id;
  div.innerHTML = `
    <div class="form-group mb-0">
      <label class="form-label">Yazarlar <span class="req">*</span></label>
      <input class="form-control" type="text" name="ref_authors_${refCount}" placeholder="Soyadı, A. B. & Soyadı, C.">
    </div>
    <div class="form-group mb-0">
      <label class="form-label">Makale/Kitap Başlığı <span class="req">*</span></label>
      <input class="form-control" type="text" name="ref_title_${refCount}" placeholder="Yayın başlığı">
    </div>
    <div class="form-group mb-0">
      <label class="form-label">Dergi / Yayınevi</label>
      <input class="form-control" type="text" name="ref_journal_${refCount}" placeholder="Nature, Science...">
    </div>
    <div class="form-group mb-0">
      <label class="form-label">Yıl</label>
      <input class="form-control" type="number" name="ref_year_${refCount}" placeholder="2024" min="1800" max="2100">
    </div>
    <div class="form-group mb-0">
      <label class="form-label">DOI</label>
      <input class="form-control" type="text" name="ref_doi_${refCount}" placeholder="10.xxxx/xxxx">
    </div>
    <div class="form-group mb-0">
      <label class="form-label">URL (DOI yoksa)</label>
      <input class="form-control" type="url" name="ref_url_${refCount}" placeholder="https://...">
    </div>
    <button type="button" class="btn btn-ghost btn-sm remove-ref" onclick="removeRef('${id}')" title="Kaynağı Kaldır">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  document.getElementById('refsList').appendChild(div);
}

function removeRef(id) {
  document.getElementById(id)?.remove();
}

function collectRefs() {
  const rows = document.querySelectorAll('#refsList .ref-row');
  const refs = [];
  rows.forEach((row, i) => {
    const n = row.id.split('_')[1];
    const authors = row.querySelector(`[name="ref_authors_${n}"]`)?.value.trim();
    const title   = row.querySelector(`[name="ref_title_${n}"]`)?.value.trim();
    if (!authors || !title) return;
    refs.push({
      authors,
      title,
      journal: row.querySelector(`[name="ref_journal_${n}"]`)?.value.trim() || '',
      year:    parseInt(row.querySelector(`[name="ref_year_${n}"]`)?.value) || null,
      doi:     row.querySelector(`[name="ref_doi_${n}"]`)?.value.trim() || '',
      url:     row.querySelector(`[name="ref_url_${n}"]`)?.value.trim() || '',
    });
  });
  return refs;
}
