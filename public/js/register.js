document.addEventListener('DOMContentLoaded', () => {
  if (Auth.isLoggedIn()) { window.location.href = '/'; return; }

  document.getElementById('registerForm').addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert('alertBox');

    const username  = document.getElementById('username').value.trim();
    const email     = document.getElementById('email').value.trim();
    const password  = document.getElementById('password').value;
    const password2 = document.getElementById('password2').value;

    if (!username || !email || !password || !password2) {
      showAlert('alertBox', 'error', 'Tüm alanları doldurun.'); return;
    }
    if (username.length < 3) {
      showAlert('alertBox', 'error', 'Kullanıcı adı en az 3 karakter olmalıdır.'); return;
    }
    if (password.length < 6) {
      showAlert('alertBox', 'error', 'Şifre en az 6 karakter olmalıdır.'); return;
    }
    if (password !== password2) {
      showAlert('alertBox', 'error', 'Şifreler eşleşmiyor.'); return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled    = true;
    btn.textContent = 'Hesap oluşturuluyor...';

    try {
      const data = await POST('/auth/register', { username, email, password });
      Auth.set(data.token, data.user);
      window.location.href = '/';
    } catch (err) {
      showAlert('alertBox', 'error', err.message);
      btn.disabled    = false;
      btn.textContent = 'Hesap Oluştur';
    }
  });
});
