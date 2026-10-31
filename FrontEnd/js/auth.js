// =====================================================
// LHAS Authentication (the server checks the password)
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect
  const session = getSession();
  if (session) {
    redirectByRole(session.role);
    return;
  }

  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');
  const toggleBtn = document.querySelector('.toggle-password');

  // Password visibility toggle
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const input = document.getElementById('password');
      const icon = toggleBtn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
      } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
      }
    });
  }

  // Demo account buttons
  document.querySelectorAll('.demo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('email').value = btn.dataset.email;
      document.getElementById('password').value = btn.dataset.pass;
      errorEl.hidden = true;
    });
  });

  // Login submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;

    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;

    let result;
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      result = await response.json();
      if (!response.ok) {
        errorEl.textContent = result.message || 'Invalid credentials. Please check your email and password.';
        errorEl.hidden = false;
        return;
      }
    } catch (err) {
      errorEl.textContent = 'Unable to reach the server. Please try again.';
      errorEl.hidden = false;
      return;
    }

    // The server checked the password. We keep only the signed token and basic profile data.
    localStorage.setItem('lhas_session', JSON.stringify({
      email: result.user.email.toLowerCase(),
      role: result.user.role,
      name: result.user.name,
      initials: result.user.initials,
      userId: result.user.id,
      token: result.token,
      loginAt: new Date().toISOString()
    }));

    redirectByRole(result.user.role);
  });
});

function getSession() {
  try {
    const raw = localStorage.getItem('lhas_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function redirectByRole(role) {
  if (role === 'admin') {
    window.location.href = 'pages/dashboard.html';
  } else if (role === 'lecturer') {
    window.location.href = 'pages/lecturer-timetable.html';
  } else {
    window.location.href = 'pages/student-timetable.html';
  }
}

function logout() {
  localStorage.removeItem('lhas_session');
  window.location.href = '../index.html';
}

// Expose for other pages
window.LHASAuth = { getSession, logout };
