// =====================================================
// LHAS sign in. The server checks the password.
// The session stays for the tab, or for weeks when "Keep me signed in" is ticked.
// =====================================================

// The login page does not load app.js, so it keeps its own copy of these two helpers.
function storedSession() {
  try { return JSON.parse(sessionStorage.getItem('lhas_session') || localStorage.getItem('lhas_session')); } catch { return null; }
}
function clearSession() {
  sessionStorage.removeItem('lhas_session');
  localStorage.removeItem('lhas_session');
}

document.addEventListener('DOMContentLoaded', () => {
  const existing = storedSession();
  if (existing && existing.token) {
    redirectByRole(existing.role);
    return;
  }

  const $ = id => document.getElementById(id);
  const form = $('loginForm');
  const forgotForm = $('forgotForm');
  const errorEl = $('loginError');

  // A small "x" inside a text box that appears when there is something to clear
  function withClearButton(input, button) {
    const sync = () => { button.hidden = !input.value; };
    input.addEventListener('input', sync);
    button.addEventListener('click', () => { input.value = ''; sync(); input.focus(); });
    sync();
    return sync;
  }
  const syncId = withClearButton($('identifier'), $('clearIdentifier'));
  withClearButton($('forgotIdentifier'), $('clearForgot'));

  // Show the last ID when the person asked to be remembered
  try {
    const last = localStorage.getItem('lhas_last_id');
    if (last) { $('identifier').value = last; $('remember').checked = true; syncId(); $('password').focus(); }
  } catch { /* ignore */ }

  // Password visibility
  const toggleBtn = document.querySelector('.toggle-password');
  toggleBtn.addEventListener('click', () => {
    const input = $('password');
    const icon = toggleBtn.querySelector('i');
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    icon.classList.toggle('fa-eye', !show);
    icon.classList.toggle('fa-eye-slash', show);
  });

  // Switch between sign in and reset password
  $('forgotLink').addEventListener('click', e => {
    e.preventDefault();
    form.hidden = true; forgotForm.hidden = false;
    $('forgotIdentifier').value = $('identifier').value; $('forgotIdentifier').dispatchEvent(new Event('input'));
    $('forgotMessage').hidden = true;
    $('forgotIdentifier').focus();
  });
  $('backToLogin').addEventListener('click', e => {
    e.preventDefault();
    forgotForm.hidden = true; form.hidden = false;
  });

  // Reset link request
  forgotForm.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('forgotMessage');
    const identifier = $('forgotIdentifier').value.trim();
    msg.hidden = true;
    if (!identifier) { msg.className = 'alert alert-error'; msg.textContent = 'Enter your ID or email.'; msg.hidden = false; return; }
    $('forgotButton').disabled = true;
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier })
      });
      const data = await res.json().catch(() => ({}));
      msg.className = res.ok ? 'alert alert-success' : 'alert alert-error';
      msg.textContent = data.message || 'Something went wrong. Please try again.';
    } catch {
      msg.className = 'alert alert-error';
      msg.textContent = 'Unable to reach the server. Please try again.';
    }
    msg.hidden = false;
    $('forgotButton').disabled = false;
  });

  // Sign in
  form.addEventListener('submit', async e => {
    e.preventDefault();
    errorEl.hidden = true;
    const identifier = $('identifier').value.trim();
    const password = $('password').value;
    const remember = $('remember').checked;
    const fail = text => { errorEl.textContent = text; errorEl.hidden = false; };
    if (!identifier || !password) { fail('Enter your ID or email and your password.'); return; }

    $('loginButton').disabled = true;
    let result;
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, remember })
      });
      result = await response.json();
      if (!response.ok) { fail(result.message || 'Invalid credentials. Please check them and try again.'); $('loginButton').disabled = false; return; }
    } catch {
      fail('Unable to reach the server. Please try again.');
      $('loginButton').disabled = false;
      return;
    }

    // Only the signed token and basic profile data are kept in the browser
    const session = {
      email: result.user.email.toLowerCase(),
      role: result.user.role,
      name: result.user.name,
      initials: result.user.initials,
      userId: result.user.id,
      indexNo: result.user.index_no,
      batchYear: result.user.batch_year,
      department: result.user.department,
      token: result.token,
      loginAt: new Date().toISOString()
    };
    clearSession();
    (remember ? localStorage : sessionStorage).setItem('lhas_session', JSON.stringify(session));
    try {
      if (remember) localStorage.setItem('lhas_last_id', identifier);
      else localStorage.removeItem('lhas_last_id');
    } catch { /* ignore */ }

    redirectByRole(result.user.role);
  });
});

function redirectByRole(role) {
  if (role === 'admin') window.location.href = 'pages/dashboard.html';
  else if (role === 'lecturer') window.location.href = 'pages/lecturer-timetable.html';
  else window.location.href = 'pages/student-timetable.html';
}
