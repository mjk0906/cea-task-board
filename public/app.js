(() => {
  const $ = (id) => document.getElementById(id);

  const state = { mode: 'login', tasks: [], filter: '', editingId: null };

  const STATUS_LABELS = { 'todo': 'To do', 'in-progress': 'In progress', 'done': 'Done' };

  /* ---------- helpers ---------- */

  // Small wrapper around fetch: sends/receives JSON and turns error responses into exceptions.
    // Small wrapper around fetch: sends/receives JSON and turns error responses into exceptions.

  async function api(path, method = 'GET', body) {
    let res;
    try {
      res = await fetch('/api' + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'same-origin',
      });
    } catch (_) {
      const netErr = new Error('Cannot reach the server. Check your connection and try again');
      netErr.network = true;
      throw netErr;
    }

    let data = {};
    try { data = await res.json(); } catch (_) { /* empty or non-JSON body */ }

    if (!res.ok) {
      const err = new Error(data.error || `Server error (${res.status}). Please try again`);
      err.status = res.status;
      err.details = data.details || [];
      throw err;
    }
    return data;
  }

  function showError(el, err) {
    el.replaceChildren();
    if (err.details && err.details.length) {
      const ul = document.createElement('ul');
      err.details.forEach((d) => {
        const li = document.createElement('li');
        li.textContent = d;
        ul.appendChild(li);
      });
      el.appendChild(ul);
    } else {
      el.textContent = err.message; // network errors already carry their own message
    }
    el.hidden = false;
  }

  function hideError(el) {
    el.hidden = true;
    el.replaceChildren();
  }

  function todayLocal() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  /* ---------- views ---------- */

  function showAuth() {
    $('app-view').hidden = true;
    $('userbar').hidden = true;
    $('auth-view').hidden = false;
  }

  async function enterApp(user) {
    $('user-name').textContent = user.name;
    $('userbar').hidden = false;
    $('auth-view').hidden = true;
    $('app-view').hidden = false;
    resetTaskForm();
    await loadTasks();
  }

  function setMode(mode) {
    state.mode = mode;
    const signup = mode === 'signup';
    $('tab-login').classList.toggle('is-active', !signup);
    $('tab-signup').classList.toggle('is-active', signup);
    $('name-field').hidden = !signup;
    $('password-hint').hidden = !signup;
    $('auth-submit').textContent = signup ? 'Create account' : 'Log in';
    $('auth-password').autocomplete = signup ? 'new-password' : 'current-password';
    hideError($('auth-error'));
  }

  /* ---------- auth ---------- */

  $('tab-login').addEventListener('click', () => setMode('login'));
  $('tab-signup').addEventListener('click', () => setMode('signup'));

  $('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = $('auth-error');
    hideError(errBox);

    const name = $('auth-name').value.trim();
    const email = $('auth-email').value.trim();
    const password = $('auth-password').value;

    if (!email || !password || (state.mode === 'signup' && !name)) {
      showError(errBox, new Error('Fill in all fields'));
      return;
    }

    const btn = $('auth-submit');
    btn.disabled = true;
    try {
      const isLogin = state.mode === 'login';
      const payload = isLogin ? { email, password } : { name, email, password };
      const { user } = await api(isLogin ? '/auth/login' : '/auth/signup', 'POST', payload);
      $('auth-form').reset();
      await enterApp(user);
    } catch (err) {
      showError(errBox, err);
    } finally {
      btn.disabled = false;
    }
  });

  $('logout-btn').addEventListener('click', async () => {
    try { await api('/auth/logout', 'POST'); } catch (_) { /* cookie is cleared server-side; ignore */ }
    state.tasks = [];
    setMode('login');
    showAuth();
  });

  /* ---------- tasks ---------- */

  async function loadTasks() {
    try {
      const query = state.filter ? `?status=${encodeURIComponent(state.filter)}` : '';
      const { tasks } = await api('/tasks' + query);
      state.tasks = tasks;
      renderTasks();
    } catch (err) {
      if (err.status === 401) return showAuth();
      showError($('task-error'), err);
    }
  }

  function renderTasks() {
    const list = $('task-list');
    list.replaceChildren();

    const empty = $('empty');
    empty.hidden = state.tasks.length > 0;
    empty.textContent = state.filter
      ? 'No tasks with this status.'
      : 'No tasks yet. Add your first task using the form.';

    const today = todayLocal();

    state.tasks.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'task';
      li.dataset.status = t.status;

      const title = document.createElement('h3');
      title.className = 'task-title';
      title.textContent = t.title; // textContent, never innerHTML, so user text can't inject HTML
      li.appendChild(title);

      if (t.description) {
        const desc = document.createElement('p');
        desc.className = 'task-desc';
        desc.textContent = t.description;
        li.appendChild(desc);
      }

      const meta = document.createElement('div');
      meta.className = 'task-meta';

      const select = document.createElement('select');
      select.setAttribute('aria-label', `Status of ${t.title}`);
      Object.entries(STATUS_LABELS).forEach(([value, label]) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        opt.selected = value === t.status;
        select.appendChild(opt);
      });
      select.addEventListener('change', () => updateStatus(t._id, select.value));
      meta.appendChild(select);

      if (t.dueDate) {
        const due = document.createElement('span');
        const dueStr = t.dueDate.slice(0, 10);
        const overdue = dueStr < today && t.status !== 'done';
        due.className = 'due' + (overdue ? ' overdue' : '');
        const pretty = new Date(t.dueDate).toLocaleDateString(undefined, {
          day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
        });
        due.textContent = (overdue ? 'Overdue: ' : 'Due ') + pretty;
        meta.appendChild(due);
      }

      const actions = document.createElement('div');
      actions.className = 'task-actions';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'btn btn-quiet';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => startEdit(t));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn btn-quiet btn-danger';
      del.textContent = 'Delete';
      del.addEventListener('click', () => deleteTask(t));

      actions.append(edit, del);
      meta.appendChild(actions);
      li.appendChild(meta);
      list.appendChild(li);
    });
  }

  function resetTaskForm() {
    state.editingId = null;
    $('task-form').reset();
    $('form-title').textContent = 'New task';
    $('task-save').textContent = 'Add task';
    $('task-cancel').hidden = true;
    hideError($('task-error'));
  }

  function startEdit(task) {
    state.editingId = task._id;
    $('task-title').value = task.title;
    $('task-desc').value = task.description || '';
    $('task-status').value = task.status;
    $('task-due').value = task.dueDate ? task.dueDate.slice(0, 10) : '';
    $('form-title').textContent = 'Edit task';
    $('task-save').textContent = 'Save changes';
    $('task-cancel').hidden = false;
    hideError($('task-error'));
    $('task-title').focus();
  }

  $('task-cancel').addEventListener('click', resetTaskForm);

  $('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = $('task-error');
    hideError(errBox);

    const body = {
      title: $('task-title').value.trim(),
      description: $('task-desc').value.trim(),
      status: $('task-status').value,
      dueDate: $('task-due').value || null,
    };

    if (!body.title) {
      showError(errBox, new Error('Title is required'));
      return;
    }

    const btn = $('task-save');
    btn.disabled = true;
    try {
      if (state.editingId) {
        await api(`/tasks/${state.editingId}`, 'PUT', body);
      } else {
        await api('/tasks', 'POST', body);
      }
      resetTaskForm();
      await loadTasks();
    } catch (err) {
      if (err.status === 401) return showAuth();
      showError(errBox, err);
    } finally {
      btn.disabled = false;
    }
  });

  async function updateStatus(id, status) {
    try {
      await api(`/tasks/${id}`, 'PUT', { status });
      await loadTasks();
    } catch (err) {
      if (err.status === 401) return showAuth();
      showError($('task-error'), err);
      await loadTasks(); // put the dropdown back to the real value
    }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete "${task.title}"?`)) return;
    try {
      await api(`/tasks/${task._id}`, 'DELETE');
      if (state.editingId === task._id) resetTaskForm();
      await loadTasks();
    } catch (err) {
      if (err.status === 401) return showAuth();
      showError($('task-error'), err);
    }
  }

  $('filters').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    state.filter = chip.dataset.filter;
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c === chip));
    loadTasks();
  });

  /* ---------- start ---------- */

  (async function init() {
    setMode('login');
    try {
      const { user } = await api('/auth/me');
      await enterApp(user);
    } catch (_) {
      showAuth();
    }
  })();
})();
