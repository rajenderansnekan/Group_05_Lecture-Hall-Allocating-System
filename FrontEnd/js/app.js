// =====================================================
// Sends the sign-in token with every call to our own API and signs the
// user out when the token has expired.
// =====================================================
// The session sits in sessionStorage (until the tab closes) or in localStorage when "Remember me" was ticked.
window.lhasStoredSession = function () {
  try { return JSON.parse(sessionStorage.getItem('lhas_session') || localStorage.getItem('lhas_session')); } catch { return null; }
};
window.lhasClearSession = function () {
  sessionStorage.removeItem('lhas_session');
  localStorage.removeItem('lhas_session');
};

(function () {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : ((input && input.url) || '');
    const isApi = url.startsWith('/api/');
    if (isApi) {
      const session = window.lhasStoredSession();
      if (session && session.token) {
        init = { ...init, headers: { ...(init.headers || {}), Authorization: 'Bearer ' + session.token } };
      }
    }
    const res = await nativeFetch(input, init);
    if (isApi && res.status === 401 && !url.startsWith('/api/login') && !url.startsWith('/api/auth/')) {
      window.lhasClearSession();
      window.location.href = window.location.pathname.includes('/pages/') ? '../index.html' : 'index.html';
    }
    return res;
  };
})();

// =====================================================
// LHAS Shared App Logic (Demo Data + Helpers)
// =====================================================

const LHAS = {
  // ---------- Demo Data ----------
  halls: [
    { id: 1, code: 'B204', name: 'Lecture Hall B204', building: 'Building B', capacity: 100, equipment: ['Projector', 'Whiteboard', 'AC'], status: 'active' },
    { id: 2, code: 'A105', name: 'Lecture Hall A105', building: 'Building A', capacity: 60, equipment: ['Projector', 'Whiteboard'], status: 'active' },
    { id: 3, code: 'C301', name: 'Lecture Theatre C301', building: 'Building C', capacity: 120, equipment: ['Whiteboard', 'AC', 'Sound System'], status: 'active' },
    { id: 4, code: 'B210', name: 'Seminar Room B210', building: 'Building B', capacity: 100, equipment: ['Projector', 'Whiteboard', 'AC'], status: 'active' },
    { id: 5, code: 'D101', name: 'Lab D101', building: 'Building D', capacity: 40, equipment: ['Computers', 'Projector'], status: 'maintenance' },
    { id: 6, code: 'A201', name: 'Lecture Hall A201', building: 'Building A', capacity: 80, equipment: ['Projector', 'Whiteboard', 'AC'], status: 'active' },
    { id: 7, code: 'C110', name: 'Tutorial Room C110', building: 'Building C', capacity: 35, equipment: ['Whiteboard'], status: 'inactive' },
    { id: 8, code: 'B105', name: 'Lecture Hall B105', building: 'Building B', capacity: 150, equipment: ['Projector', 'Whiteboard', 'AC', 'Sound System'], status: 'active' }
  ],

  lecturers: [
    { id: 1, name: 'Dr. Nimal Perera', code: 'L001', department: 'Software Engineering', email: 'nimal@uni.lk' },
    { id: 2, name: 'Prof. Saman Jayasuriya', code: 'L002', department: 'Computer Science', email: 'saman@uni.lk' },
    { id: 3, name: 'Ms. Anusha Fernando', code: 'L003', department: 'Information Systems', email: 'anusha@uni.lk' },
    { id: 4, name: 'Dr. Ruwan Wickrama', code: 'L004', department: 'Software Engineering', email: 'ruwan@uni.lk' }
  ],

  classes: [
    { id: 1, code: 'SE3010', name: 'Database Management', group: 'Group A', students: 85, lecturerId: 1, equipment: ['Projector'] },
    { id: 2, code: 'CS2001', name: 'Data Structures', group: 'Group B', students: 70, lecturerId: 2, equipment: ['Projector', 'Whiteboard'] },
    { id: 3, code: 'IS3102', name: 'Systems Analysis', group: 'Group A', students: 55, lecturerId: 3, equipment: ['Projector'] },
    { id: 4, code: 'SE2205', name: 'Object Oriented Programming', group: 'Group C', students: 90, lecturerId: 4, equipment: ['Projector', 'Computers'] },
    { id: 5, code: 'CS1500', name: 'Introduction to Programming', group: 'Group A', students: 110, lecturerId: 2, equipment: ['Projector'] }
  ],

  allocations: [
    { id: 1, classId: 2, hallId: 1, date: '2026-10-15', start: '09:00', end: '11:00', status: 'confirmed', createdBy: 'admin' },
    { id: 2, classId: 1, hallId: 8, date: '2026-10-15', start: '10:00', end: '12:00', status: 'confirmed', createdBy: 'admin' },
    { id: 3, classId: 3, hallId: 6, date: '2026-10-15', start: '13:00', end: '15:00', status: 'confirmed', createdBy: 'admin' },
    { id: 4, classId: 5, hallId: 3, date: '2026-10-16', start: '09:00', end: '11:00', status: 'confirmed', createdBy: 'admin' },
    { id: 5, classId: 4, hallId: 4, date: '2026-10-16', start: '14:00', end: '16:00', status: 'cancelled', createdBy: 'admin', reason: 'Lecturer unavailable' }
  ],

  // ---------- Helpers ----------
  getHall(id) {
    return this.halls.find(h => h.id === id);
  },

  getClass(id) {
    return this.classes.find(c => c.id === id);
  },

  getLecturer(id) {
    return this.lecturers.find(l => l.id === id);
  },

  getSession() {
    return window.lhasStoredSession();
  },

  requireAuth(allowedRoles = ['admin', 'lecturer', 'student']) {
    const session = this.getSession();
    if (!session || !allowedRoles.includes(session.role)) {
      window.location.href = '../index.html';
      return null;
    }
    return session;
  },

  logout() {
    window.lhasClearSession();
    window.location.href = '../index.html';
  },

  // Hall suggestion logic (matches SRS business rules)
  suggestHalls({ students, equipment = [], date, start, end }) {
    const requiredEq = equipment.map(e => e.toLowerCase());
    const results = [];

    this.halls.forEach(hall => {
      const reasons = [];
      let suitable = true;

      // Status check
      if (hall.status !== 'active') {
        suitable = false;
        reasons.push(`Hall is ${hall.status}`);
      }

      // Capacity
      if (hall.capacity < students) {
        suitable = false;
        reasons.push(`Capacity too small (${hall.capacity} < ${students})`);
      }

      // Equipment
      const hallEq = hall.equipment.map(e => e.toLowerCase());
      const missing = requiredEq.filter(eq => !hallEq.some(he => he.includes(eq)));
      if (missing.length) {
        suitable = false;
        reasons.push(`Missing equipment: ${missing.join(', ')}`);
      }

      // Time conflict
      const conflict = this.allocations.find(a =>
        a.hallId === hall.id &&
        a.status === 'confirmed' &&
        a.date === date &&
        this.timesOverlap(a.start, a.end, start, end)
      );
      if (conflict) {
        suitable = false;
        reasons.push('Time conflict with existing allocation');
      }

      if (suitable) {
        // Ranking score (lower excess capacity preferred)
        const excess = hall.capacity - students;
        const eqMatch = requiredEq.length ? (requiredEq.filter(eq => hallEq.some(he => he.includes(eq))).length / requiredEq.length) : 1;
        const score = excess * 0.6 + (1 - eqMatch) * 40;
        results.push({ hall, score, reasons: ['Meets all hard constraints'], excess });
      } else {
        results.push({ hall, score: 9999, reasons, excess: hall.capacity - students });
      }
    });

    // Sort: suitable first (by score), then unsuitable
    results.sort((a, b) => a.score - b.score);
    return results;
  },

  timesOverlap(s1, e1, s2, e2) {
    return s1 < e2 && s2 < e1;
  },

  formatTime(t) {
    return t; // already HH:MM
  },

  showToast(message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : type === 'warning' ? 'warning' : ''}`;
    toast.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'check-circle'}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  },

  // Init common UI elements
  initLayout(session) {
    // User info in sidebar
    const avatar = document.querySelector('.user-avatar');
    const nameEl = document.querySelector('.user-meta .name');
    const roleEl = document.querySelector('.user-meta .role');
    if (avatar) avatar.textContent = session.initials;
    if (nameEl) nameEl.textContent = session.name;
    if (roleEl) roleEl.textContent = session.role.charAt(0).toUpperCase() + session.role.slice(1);
    document.body.dataset.role = session.role;
    const topRight = document.querySelector('.topbar-right');
    if (topRight && !topRight.querySelector('.role-chip')) {
      topRight.insertAdjacentHTML('afterbegin', '<span class="role-chip">' + session.role.charAt(0).toUpperCase() + session.role.slice(1) + '</span>');
    }

    // Menu toggle (mobile)
    const toggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (toggle && sidebar) {
      toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
    }

    // Logout buttons
    document.querySelectorAll('[data-logout]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    });

    // Highlight active nav
    const path = window.location.pathname.split('/').pop();
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('href') === path) {
        link.classList.add('active');
      }
    });

    // Route the Timetable nav link per role
    if (session.role === 'lecturer') {
      document.querySelectorAll('.nav-link[href="timetable.html"]').forEach(link => {
        link.href = 'lecturer-timetable.html';
      });
    }

    this.applyRoleNav(session);
  },

    applyRoleNav(session) {
    if (session.role === 'admin') return; // admins see everything

    const ADMIN_ONLY = [
      'dashboard.html',
      'halls.html',
      'classes.html',
      'reports.html',
      'history.html',
      'users.html'
    ];

    document.querySelectorAll('.nav-link').forEach(link => {
      const href = (link.getAttribute('href') || '').trim();
      if (ADMIN_ONLY.includes(href)) {
        link.style.display = 'none';
      }
    });

    // Hide any nav section whose links are all hidden now
    document.querySelectorAll('.nav-section').forEach(section => {
      const hasVisible = [...section.querySelectorAll('.nav-link')]
        .some(link => link.style.display !== 'none');
      if (!hasVisible) section.style.display = 'none';
    });
  },

  // Sidebar links for pages that more than one role opens
  navFor(role, active) {
    const link = (href, icon, label) => `<a href="${href}" class="nav-link${href === active ? ' active' : ''}"><i class="fas fa-${icon}"></i> ${label}</a>`;
    const logout = '<div class="nav-section"><div class="nav-section-title">' + (role === 'admin' ? 'System' : 'Account') + '</div>' +
      (role === 'admin' ? link('users.html', 'users', 'Users') : '') + '<a href="#" class="nav-link" data-logout><i class="fas fa-sign-out-alt"></i> Logout</a></div>';
    if (role === 'admin') {
      return '<div class="nav-section"><div class="nav-section-title">Main</div>' +
        link('dashboard.html', 'th-large', 'Dashboard') + link('halls.html', 'door-open', 'Lecture Halls') +
        link('classes.html', 'book', 'Classes &amp; Subjects') + link('allocation.html', 'calendar-check', 'Hall Allocation') +
        link('booking-requests.html', 'inbox', 'Booking Requests') + link('hall-feedback.html', 'comment-dots', 'Hall Feedback') +
        link('timetable.html', 'calendar-alt', 'Timetable') + '</div>' +
        '<div class="nav-section"><div class="nav-section-title">Reports</div>' +
        link('reports.html', 'chart-bar', 'Usage Reports') + link('history.html', 'history', 'Allocation History') + '</div>' + logout;
    }
    if (role === 'lecturer') {
      return '<div class="nav-section"><div class="nav-section-title">My Schedule</div>' +
        link('lecturer-timetable.html', 'calendar-alt', 'My Timetable') + link('book-hall.html', 'calendar-plus', 'Book a Hall') +
        link('schedule.html', 'calendar-day', 'Daily Schedule') + link('hall-feedback.html', 'comment-dots', 'Hall Feedback') + '</div>' + logout;
    }
    return '<div class="nav-section"><div class="nav-section-title">My Schedule</div>' +
      link('student-timetable.html', 'calendar-alt', 'Class Timetable') + link('schedule.html', 'calendar-day', 'Daily Schedule') + '</div>' + logout;
  },

  // A small question dialog that asks for text (a reason, for example). Resolves with the text, or null if cancelled.
  askReason({ title, message = '', placeholder = '', confirmText = 'Confirm', minLength = 3 }) {
    return new Promise(resolve => {
      const dlg = document.createElement('dialog');
      dlg.className = 'modal-dialog';
      dlg.innerHTML = `
        <form method="dialog" novalidate>
          <div class="modal-header"><h3>${this.esc(title)}</h3><button type="button" class="modal-close" data-cancel aria-label="Close">&times;</button></div>
          <div class="modal-body">
            ${message ? `<p class="text-muted" style="margin-bottom:.75rem;">${this.esc(message)}</p>` : ''}
            <textarea rows="3" maxlength="250" placeholder="${this.esc(placeholder)}" aria-label="${this.esc(title)}"></textarea>
            <small class="field-error"></small>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
            <button type="submit" class="btn btn-primary">${this.esc(confirmText)}</button>
          </div>
        </form>`;
      document.body.appendChild(dlg);
      const box = dlg.querySelector('textarea');
      const err = dlg.querySelector('.field-error');
      let result = null;
      dlg.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => dlg.close()));
      dlg.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const text = box.value.trim();
        if (text.length < minLength) { err.textContent = 'Please give a short reason.'; return; }
        result = text; dlg.close();
      });
      dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
      dlg.showModal();
      box.focus();
    });
  },

  // Equipment choices: projector and whiteboard are required for every class, the rest is optional.
  // Custom items are kept in this browser so they appear again next time and can be renamed or removed.
  equipmentPicker(root, initial = []) {
    const MANDATORY = ['Projector', 'Whiteboard'];
    const COMMON = ['Air conditioning', 'Microphone', 'Sound system', 'Smart board', 'Wheelchair access'];
    const KEY = 'lhas_custom_equipment';
    const esc = this.esc;
    const lower = v => String(v).trim().toLowerCase();
    const loadCustom = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
    const saveCustom = list => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } };

    let custom = loadCustom();
    const selected = new Set();
    const known = new Set([...MANDATORY, ...COMMON].map(lower));
    const setSelected = list => {
      selected.clear();
      list.forEach(item => {
        const k = lower(item);
        if (!k || MANDATORY.map(lower).includes(k)) return;
        if (!known.has(k) && !custom.some(c => lower(c) === k)) { custom.push(String(item).trim()); saveCustom(custom); }
        selected.add(k);
      });
    };
    setSelected(initial);

    const render = () => {
      root.classList.add('eq-picker');
      root.innerHTML = `
        <div class="eq-row">${MANDATORY.map(m => `<span class="eq-chip eq-locked" title="Required for every class"><i class="fas fa-lock"></i> ${esc(m)}</span>`).join('')}</div>
        <div class="eq-row">${COMMON.map(c => `<label class="eq-chip"><input type="checkbox" data-eq="${esc(c)}" ${selected.has(lower(c)) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}</div>
        <div class="eq-row" data-custom>${custom.map((c, i) => `
          <span class="eq-chip eq-custom">
            <input type="checkbox" data-eq="${esc(c)}" ${selected.has(lower(c)) ? 'checked' : ''} aria-label="${esc(c)}">
            <span class="eq-name">${esc(c)}</span>
            <button type="button" class="eq-icon" data-edit="${i}" title="Rename"><i class="fas fa-pen"></i></button>
            <button type="button" class="eq-icon" data-remove="${i}" title="Remove from the list"><i class="fas fa-times"></i></button>
          </span>`).join('')}</div>
        <div class="eq-add"><input type="text" class="eq-new" placeholder="Add other equipment" maxlength="40"><button type="button" class="btn btn-outline btn-sm eq-add-btn">Add</button></div>`;

      root.querySelectorAll('input[type="checkbox"][data-eq]').forEach(box => box.addEventListener('change', () => {
        const k = lower(box.dataset.eq);
        box.checked ? selected.add(k) : selected.delete(k);
      }));
      const add = () => {
        const input = root.querySelector('.eq-new');
        const name = input.value.trim();
        if (!name) return;
        if (known.has(lower(name)) || MANDATORY.map(lower).includes(lower(name))) { selected.add(lower(name)); render(); return; }
        if (!custom.some(c => lower(c) === lower(name))) { custom.push(name); saveCustom(custom); }
        selected.add(lower(name));
        render();
      };
      root.querySelector('.eq-add-btn').addEventListener('click', add);
      root.querySelector('.eq-new').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

      root.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.remove);
        selected.delete(lower(custom[idx]));
        custom = custom.filter((_, i) => i !== idx);
        saveCustom(custom); render();
      }));
      root.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
        const i = Number(btn.dataset.edit);
        const chip = btn.closest('.eq-custom');
        const old = custom[i];
        const field = document.createElement('input');
        field.type = 'text'; field.value = old; field.maxLength = 40; field.className = 'eq-rename';
        chip.querySelector('.eq-name').replaceWith(field);
        field.focus(); field.select();
        let done = false;
        const finish = save => {
          if (done) return; done = true;
          const name = field.value.trim();
          if (save && name && lower(name) !== lower(old)) {
            const wasOn = selected.has(lower(old));
            selected.delete(lower(old));
            custom[i] = name; saveCustom(custom);
            if (wasOn) selected.add(lower(name));
          }
          render();
        };
        field.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); finish(true); } if (e.key === 'Escape') finish(false); });
        field.addEventListener('blur', () => finish(true));
      }));
    };
    render();

    return {
      // Everything that is ticked, with the two required items first
      get: () => [...MANDATORY, ...[...COMMON, ...custom].filter(n => selected.has(lower(n)))],
      set: list => { setSelected(list || []); render(); }
    };
  },

  // Escapes text before it is placed in a page
  esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  async notify(message, type = 'info', status = 'unread') {
    try {
      const res = await fetch('/api/createnotifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message, type, status })
      });
      if (!res.ok) {
        console.warn('Notification not created:', res.status, await res.text());
        return false;
      }
      return true;
    } catch (err) {
      console.error('notify() failed:', err);
      return false;
    }
  },
};

window.LHAS = LHAS;

// =====================================================
// LHAS Change Password Feature
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  const session = LHAS.getSession();

  if (!session) return;


  // Role navigation (version 2)
  if (session.role === 'lecturer' && !document.querySelector('a[href="book-hall.html"]')) {
    const anchor = document.querySelector('.nav-link[href="lecturer-timetable.html"]');
    if (anchor) {
      anchor.insertAdjacentHTML('afterend',
        '<a href="book-hall.html" class="nav-link"><i class="fas fa-calendar-plus"></i> Book a Hall</a>');
    }
  }
  if (session.role === 'lecturer') {
    const after = document.querySelector('a[href="book-hall.html"]') || document.querySelector('.nav-link[href="lecturer-timetable.html"]');
    if (after && !document.querySelector('a[href="schedule.html"]')) {
      after.insertAdjacentHTML('afterend', '<a href="schedule.html" class="nav-link"><i class="fas fa-calendar-day"></i> Daily Schedule</a>');
    }
    const last = document.querySelector('a[href="schedule.html"]');
    if (last && !document.querySelector('a[href="hall-feedback.html"]')) {
      last.insertAdjacentHTML('afterend', '<a href="hall-feedback.html" class="nav-link"><i class="fas fa-comment-dots"></i> Hall Feedback</a>');
    }
  }
  if (session.role === 'student' && !document.querySelector('a[href="schedule.html"]')) {
    const anchor = document.querySelector('.nav-link[href="student-timetable.html"]');
    if (anchor) anchor.insertAdjacentHTML('afterend', '<a href="schedule.html" class="nav-link"><i class="fas fa-calendar-day"></i> Daily Schedule</a>');
  }
  if (session.role === 'admin' && !document.querySelector('a[href="hall-feedback.html"]')) {
    const anchor = document.querySelector('a[href="booking-requests.html"]') || document.querySelector('.nav-link[href="allocation.html"]');
    if (anchor) anchor.insertAdjacentHTML('afterend', '<a href="hall-feedback.html" class="nav-link"><i class="fas fa-comment-dots"></i> Hall Feedback</a>');
  }
  if (session.role === 'admin' && !document.querySelector('a[href="booking-requests.html"]')) {
    const anchor = document.querySelector('.nav-link[href="allocation.html"]');
    if (anchor) {
      anchor.insertAdjacentHTML('afterend',
        '<a href="booking-requests.html" class="nav-link"><i class="fas fa-inbox"></i> Booking Requests</a>');
    }
  }
  if (session.role === 'admin') {
    fetch('/api/admin/stats').then(r => r.ok ? r.json() : null).then(stats => {
      const link = document.querySelector('a[href="booking-requests.html"]');
      if (link && stats && stats.pendingBookings > 0 && !link.querySelector('.nav-count')) {
        link.insertAdjacentHTML('beforeend', ' <span class="nav-count">' + stats.pendingBookings + '</span>');
      }
      const fb = document.querySelector('a[href="hall-feedback.html"]');
      if (fb && stats && stats.openFeedback > 0 && !fb.querySelector('.nav-count')) {
        fb.insertAdjacentHTML('beforeend', ' <span class="nav-count">' + stats.openFeedback + '</span>');
      }
    }).catch(() => {});
  }

  const logoutButton = document.querySelector('[data-logout]');

  if (!logoutButton) return;

  // Avoid creating duplicate buttons.
  if (document.querySelector('[data-change-password]')) return;

  // Add the Change Password button before Logout.
  const changePasswordButton = document.createElement('a');

  changePasswordButton.href = '#';
  changePasswordButton.className = logoutButton.className || 'nav-link';
  changePasswordButton.setAttribute('data-change-password', '');
  changePasswordButton.innerHTML =
    '<i class="fas fa-key"></i><span>Change Password</span>';

  logoutButton.parentElement.insertBefore(
    changePasswordButton,
    logoutButton
  );

  // Create the modal.
  const modal = document.createElement('div');

  modal.id = 'changePasswordModal';

  modal.innerHTML = `
    <div class="change-password-box">
      <button type="button" id="closePasswordModal"
              class="close-password-modal"
              aria-label="Close">&times;</button>

      <h2>Change Password</h2>
      <p>Enter your current password and your new password.</p>

      <form id="changePasswordForm">
        <label for="currentPassword">Current Password</label>
        <input
          type="password"
          id="currentPassword"
          autocomplete="current-password"
          required
        >

        <label for="newPassword">New Password</label>
        <input
          type="password"
          id="newPassword"
          autocomplete="new-password"
          minlength="8"
          required
        >

        <label for="confirmPassword">Confirm New Password</label>
        <input
          type="password"
          id="confirmPassword"
          autocomplete="new-password"
          minlength="8"
          required
        >

        <p id="passwordMessage" role="status" aria-live="polite"></p>

        <button type="submit" id="updatePasswordButton">
          Update Password
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const form = document.getElementById('changePasswordForm');
  const message = document.getElementById('passwordMessage');
  const submitButton = document.getElementById('updatePasswordButton');

  function closeModal() {
    modal.style.display = 'none';
    form.reset();
    message.textContent = '';
  }

  changePasswordButton.addEventListener('click', event => {
    event.preventDefault();
    message.textContent = '';
    modal.style.display = 'flex';
  });

  document.getElementById('closePasswordModal')
    .addEventListener('click', closeModal);

  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const currentPassword =
      document.getElementById('currentPassword').value;

    const newPassword =
      document.getElementById('newPassword').value;

    const confirmPassword =
      document.getElementById('confirmPassword').value;

    const missing = [];
    if (newPassword.length < 8) missing.push('at least 8 characters');
    if (!/[A-Z]/.test(newPassword)) missing.push('an uppercase letter');
    if (!/[a-z]/.test(newPassword)) missing.push('a lowercase letter');
    if (!/\d/.test(newPassword)) missing.push('a digit');
    if (missing.length) {
      message.textContent = 'The new password needs ' + missing.join(', ') + '.';
      return;
    }

    if (newPassword === currentPassword) {
      message.textContent =
        'Choose a password different from your current password.';
      return;
    }

    if (newPassword !== confirmPassword) {
      message.textContent = 'The new passwords do not match.';
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Updating...';
    message.textContent = '';

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: session.email,
          currentPassword,
          newPassword
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || 'Unable to change your password.'
        );
      }

      message.textContent =
        result.message || 'Password changed successfully.';

      form.reset();

      setTimeout(closeModal, 1800);

    } catch (error) {
      message.textContent =
        error.message || 'Could not connect to the server.';
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Update Password';
    }
  });
});

// =====================================================
// Notification panel
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
  const bell = document.querySelector('.topbar-right .icon-btn[title="Notifications"]');
  if (!bell) return;

  const wrapper = bell.closest('.topbar-right');
  wrapper.style.position = 'relative';

  const panel = document.createElement('div');
  panel.id = 'notificationPanel';
  panel.style.cssText = `
    display: none;
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 320px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    box-shadow: 0 12px 32px rgba(15,23,42,.15);
    z-index: 1000;
    padding: 1rem;
    font-size: .9rem;
  `;

  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:.75rem;">
      <strong>Notifications</strong>
    </div>
    <div id="notificationList" class="notification-scroll"></div>
  `;

  wrapper.appendChild(panel);

  const list = panel.querySelector('#notificationList');

  // Scrolling inside the panel must never move the page behind it
  panel.addEventListener('wheel', (e) => {
    const canScroll = list.scrollHeight > list.clientHeight;
    const atTop = list.scrollTop <= 0 && e.deltaY < 0;
    const atBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 1 && e.deltaY > 0;
    if (!canScroll || atTop || atBottom) e.preventDefault();
  }, { passive: false });

  // Hardcoded demo notifications (replace with a fetch later if you want)
// type → visual style
const NOTIFICATION_STYLES = {
  success: { icon: 'check-circle',         color: '#10b981' },
  warning: { icon: 'exclamation-triangle', color: '#f59e0b' },
  info:    { icon: 'paper-plane',          color: '#3b82f6' },
  danger:  { icon: 'times-circle',         color: '#ef4444' }
};

function styleFor(type) {
  return NOTIFICATION_STYLES[type] || NOTIFICATION_STYLES.info;
}

 function relativeTime(value) {
  if (!value) return '';

  let then;

  if (value instanceof Date) {
    // mysql2 Date objects come pre-shifted by the local offset — un-shift.
    then = value.getTime() - value.getTimezoneOffset() * 60000;
  } else {
    const s = String(value);

    // Bare MySQL timestamp like "2026-10-26 00:30:00" — no timezone, treat as UTC.
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      then = new Date(s.replace(' ', 'T') + 'Z').getTime();
    } else {
      // ISO string from JSON.stringify of a mysql2 Date — also wrong-shifted → un-shift.
      const parsed = new Date(s);
      if (Number.isNaN(parsed.getTime())) return '';
      then = parsed.getTime() - parsed.getTimezoneOffset() * 60000;
    }
  }

  if (Number.isNaN(then)) return '';

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 0)     return 'just now';
  if (seconds < 60)    return 'just now';
  if (seconds < 3600)  return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour(s) ago`;
  return `${Math.floor(seconds / 86400)} day(s) ago`;
}

  // real notifications
  let notifications = [];
  try {
    const res = await fetch('/api/notifications', { credentials: 'include' });
    if (res.ok) notifications = await res.json();
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }

  notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Render — style each item using its `type`
  list.innerHTML = notifications.map(n => {
    const style = styleFor(n.type);
    const readClass = n.status === 'read' ? 'is-read' : 'is-unread';
    return `
      <div class="notification-item ${readClass}">
        <i class="fas fa-${style.icon}" style="color:${style.color}; margin-top:3px;"></i>
        <div>
          <div class="notification-message">${LHAS.esc(n.message)}</div>
          <div class="notification-time">${relativeTime(n.created_at)}</div>
        </div>
      </div>
    `;
  }).join('');

  // Sync badge to the number of unread notifications
  const unreadCount = notifications.filter(n => n.status === 'unread').length;
  let badge = bell.querySelector('.badge');
  if (unreadCount > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'badge';
      bell.appendChild(badge);
    }
    badge.textContent = String(unreadCount);
    badge.style.display = '';
  } else if (badge) {
    badge.style.display = 'none';
  }

  // Toggle panel when bell is clicked
  bell.addEventListener('click', async (e) => {
    e.stopPropagation();
    const opening = panel.style.display !== 'block';
    panel.style.display = opening ? 'block' : 'none';

    if (opening) {

      try {
        await fetch('/api/readnotifications', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (err) {
        console.error('mark-all-read failed:', err);
      }

      // Hide badge and grey out items
      bell.querySelector('.badge')?.remove();
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !bell.contains(e.target)) {
      panel.style.display = 'none';
    }
  });

});