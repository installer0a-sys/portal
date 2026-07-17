import { callApi } from '../../core/api.js';
import { toast } from '../../core/toast.js';

let containerRef = null;
let users = [];
let apps = [];
let query = '';
let includeInactive = true;
let abortController = null;

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function filteredUsers() {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return users;
  return users.filter((user) => [user.username, user.displayName, user.portalRole, user.status]
    .some((value) => String(value || '').toLowerCase().includes(keyword)));
}

function roleBadges(user) {
  const entries = Object.entries(user.appRoles || {});
  if (!entries.length) return '<span class="text-xs text-slate-400">Belum ada akses app</span>';
  return entries.map(([appId, role]) => `<span class="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">${escapeHtml(appId)} · ${escapeHtml(role)}</span>`).join('');
}

function render() {
  if (!containerRef) return;
  const records = filteredUsers();
  containerRef.innerHTML = `
    <section class="space-y-4">
      <div class="app-card flex flex-col gap-3 xl:flex-row xl:items-center">
        <label class="relative min-w-0 flex-1">
          <span class="sr-only">Cari user</span>
          <input data-user-search value="${escapeHtml(query)}" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Cari username, nama, portal role...">
        </label>
        <label class="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"><input data-include-inactive type="checkbox" ${includeInactive ? 'checked' : ''}> User nonaktif</label>
        <button type="button" data-user-refresh class="app-button-secondary">Refresh</button>
        <button type="button" data-user-create class="app-button-primary">+ Tambah user</button>
      </div>

      <div class="grid gap-3">
        ${records.map((user) => `
          <article class="app-card">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-center">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h4 class="truncate font-bold text-slate-900">${escapeHtml(user.displayName || user.username)}</h4>
                  <span class="rounded-full px-2.5 py-1 text-[11px] font-bold ${user.portalRole === 'ADMIN' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'}">${escapeHtml(user.portalRole)}</span>
                  <span class="rounded-full px-2.5 py-1 text-[11px] font-bold ${user.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${escapeHtml(user.status)}</span>
                </div>
                <p class="mt-1 text-sm text-slate-500">@${escapeHtml(user.username)} · diperbarui ${escapeHtml(formatDate(user.updatedAt))}</p>
                <div class="mt-3 flex flex-wrap gap-2">${roleBadges(user)}</div>
              </div>
              <div class="flex flex-wrap gap-2 xl:justify-end">
                <button type="button" data-user-edit="${escapeHtml(user.userId)}" class="app-button-secondary min-h-9 px-3">Edit</button>
                <button type="button" data-user-password="${escapeHtml(user.userId)}" class="app-button-secondary min-h-9 px-3">Reset password</button>
                <button type="button" data-user-revoke="${escapeHtml(user.userId)}" class="app-button-secondary min-h-9 px-3 text-amber-700">Revoke session</button>
              </div>
            </div>
          </article>`).join('') || '<div class="app-card text-sm text-slate-500">User tidak ditemukan.</div>'}
      </div>
    </section>`;
  bind();
}

function appRoleFields(user = {}) {
  return apps.filter((app) => app.appId !== 'portal' && app.status !== 'DELETED').map((app) => {
    const value = user.appRoles?.[app.appId] || '';
    return `<label class="text-sm font-semibold text-slate-700">${escapeHtml(app.appName || app.appId)}
      <select name="role:${escapeHtml(app.appId)}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500">
        <option value="" ${!value ? 'selected' : ''}>Tidak ada akses</option>
        <option value="VIEWER" ${value === 'VIEWER' ? 'selected' : ''}>VIEWER</option>
        <option value="MANAGER" ${value === 'MANAGER' ? 'selected' : ''}>MANAGER</option>
      </select>
    </label>`;
  }).join('');
}

function userFormTemplate(user = null) {
  return `<form data-user-form class="space-y-5">
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="text-sm font-semibold text-slate-700">Username<input name="username" ${user ? 'readonly' : ''} value="${escapeHtml(user?.username || '')}" required class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"></label>
      <label class="text-sm font-semibold text-slate-700">Nama tampilan<input name="displayName" value="${escapeHtml(user?.displayName || '')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"></label>
      ${user ? '' : '<label class="text-sm font-semibold text-slate-700 sm:col-span-2">Password awal<input name="password" type="password" minlength="8" required class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500" autocomplete="new-password"></label>'}
      <label class="text-sm font-semibold text-slate-700">Portal role<select name="portalRole" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"><option value="USER" ${user?.portalRole !== 'ADMIN' ? 'selected' : ''}>USER</option><option value="ADMIN" ${user?.portalRole === 'ADMIN' ? 'selected' : ''}>ADMIN</option></select></label>
      <label class="text-sm font-semibold text-slate-700">Status<select name="status" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"><option value="ACTIVE" ${user?.status !== 'INACTIVE' ? 'selected' : ''}>ACTIVE</option><option value="INACTIVE" ${user?.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option></select></label>
    </div>
    <div><h4 class="font-bold text-slate-900">Role per aplikasi</h4><p class="mt-1 text-xs text-slate-500">Role aplikasi tidak mengubah portal role dan tidak menentukan akses menu Settings.</p><div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">${appRoleFields(user || {}) || '<p class="text-sm text-slate-500">Belum ada app terdaftar.</p>'}</div></div>
    <div class="flex justify-end gap-2"><button type="button" data-form-cancel class="app-button-secondary">Batal</button><button type="submit" class="app-button-primary">Simpan</button></div>
  </form>`;
}

function openDialog(title, body) {
  const host = document.createElement('div');
  host.className = 'fixed inset-0 z-[150] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm';
  host.innerHTML = `<section class="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"><div class="mb-5"><p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Management User</p><h3 class="mt-1 text-xl font-bold text-slate-900">${escapeHtml(title)}</h3></div>${body}</section>`;
  document.body.appendChild(host);
  host.addEventListener('click', (event) => { if (event.target === host) host.remove(); });
  host.querySelector('[data-form-cancel]')?.addEventListener('click', () => host.remove());
  return host;
}

async function openUserForm(user = null) {
  const host = openDialog(user ? 'Edit user' : 'Tambah user', userFormTemplate(user));
  host.querySelector('[data-user-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const appRoles = {};
    Object.entries(data).forEach(([key, value]) => {
      if (key.startsWith('role:') && value) appRoles[key.slice(5)] = value;
    });
    const values = { displayName: data.displayName, portalRole: data.portalRole, status: data.status, appRoles };
    try {
      if (user) await callApi('users.update', { userId: user.userId, values }, { deduplicate: false });
      else await callApi('users.create', { username: data.username, displayName: data.displayName, password: data.password, portalRole: data.portalRole, status: data.status, appRoles }, { deduplicate: false });
      toast.success(user ? 'User diperbarui.' : 'User ditambahkan.');
      host.remove();
      await load();
    } catch (error) { toast.error(error.message); }
  });
}

function openPasswordDialog(user) {
  const host = openDialog(`Reset password · ${user.displayName || user.username}`, `<form data-password-form class="space-y-4"><label class="text-sm font-semibold text-slate-700">Password baru<input name="password" type="password" minlength="8" required autocomplete="new-password" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-500"></label><p class="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Reset password juga mencabut seluruh sesi lama user.</p><div class="flex justify-end gap-2"><button type="button" data-form-cancel class="app-button-secondary">Batal</button><button type="submit" class="app-button-primary">Reset password</button></div></form>`);
  host.querySelector('[data-password-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('password');
    try { await callApi('users.resetPassword', { userId: user.userId, password }, { deduplicate: false }); toast.success('Password direset.'); host.remove(); await load(); }
    catch (error) { toast.error(error.message); }
  });
}

async function load() {
  if (!containerRef) return;
  containerRef.innerHTML = '<div class="app-card animate-pulse text-sm text-slate-500">Memuat user dan role aplikasi...</div>';
  try {
    const [userResult, appResult] = await Promise.all([
      callApi('users.list', { includeInactive }, { deduplicate: false }),
      callApi('apps.list', { includeInactive: true, includeDeleted: false }, { deduplicate: false })
    ]);
    users = userResult.data?.users || [];
    apps = appResult.data?.apps || [];
    render();
  } catch (error) {
    containerRef.innerHTML = `<div class="app-card border-red-200 bg-red-50 text-sm text-red-700">${escapeHtml(error.message)}</div>`;
  }
}

function bind() {
  abortController?.abort();
  abortController = new AbortController();
  const { signal } = abortController;
  containerRef.querySelector('[data-user-search]')?.addEventListener('input', (event) => { const cursor = event.target.selectionStart; query = event.target.value; render(); const input = containerRef?.querySelector('[data-user-search]'); input?.focus(); input?.setSelectionRange(cursor, cursor); }, { signal });
  containerRef.querySelector('[data-include-inactive]')?.addEventListener('change', async (event) => { includeInactive = event.target.checked; await load(); }, { signal });
  containerRef.querySelector('[data-user-refresh]')?.addEventListener('click', load, { signal });
  containerRef.querySelector('[data-user-create]')?.addEventListener('click', () => openUserForm(), { signal });
  containerRef.querySelectorAll('[data-user-edit]').forEach((button) => button.addEventListener('click', () => openUserForm(users.find((user) => user.userId === button.dataset.userEdit)), { signal }));
  containerRef.querySelectorAll('[data-user-password]').forEach((button) => button.addEventListener('click', () => openPasswordDialog(users.find((user) => user.userId === button.dataset.userPassword)), { signal }));
  containerRef.querySelectorAll('[data-user-revoke]').forEach((button) => button.addEventListener('click', async () => {
    const user = users.find((item) => item.userId === button.dataset.userRevoke);
    if (!user || !confirm(`Cabut seluruh sesi ${user.displayName || user.username}?`)) return;
    try { await callApi('users.revokeSessions', { userId: user.userId }, { deduplicate: false }); toast.success('Seluruh sesi user dicabut.'); await load(); }
    catch (error) { toast.error(error.message); }
  }, { signal }));
}

export async function mount(container) {
  containerRef = container;
  await load();
}
