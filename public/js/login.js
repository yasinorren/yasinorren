document.addEventListener('DOMContentLoaded', () => {
  if (Auth.isLoggedIn()) { window.location.href = '/'; return; }

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    clearAlert('alertBox');

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      showAlert('alertBox', 'error', 'E-posta ve şifre zorunludur.');
      return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled    = true;
    btn.textContent = 'Giriş yapılıyor...';

    try {
      const data = await POST('/auth/login', { email, password });
      Auth.set(data.token, data.user);
      window.location.href = '/';
    } catch (err) {
      showAlert('alertBox', 'error', err.message);
      btn.disabled    = false;
      btn.textContent = 'Giriş Yap';
    }
  });
});
