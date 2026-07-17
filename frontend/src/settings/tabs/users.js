import { callApi } from '../../core/api.js';
import { toast } from '../../core/toast.js';

let containerRef = null;
let users = [];
let apps = [];
let appRoleMaster = {};
let query = '';
let includeInactive = true;
let abortController = null;
const CACHE_KEY = 'portal.settings.users.v2';
let memoryCache = null;
let refreshPromise = null;
function readCache() {
  if (memoryCache) return memoryCache;
  try { memoryCache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { memoryCache = null; }
  return memoryCache;
}
function writeCache(value) {
  memoryCache = value;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch { /* cache optional */ }
}


function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function registeredApps() {
  return apps.filter((app) => app.appId !== 'portal' && app.status !== 'DELETED');
}

function filteredUsers() {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return users;
  return users.filter((user) => {
    const accessText = Object.entries(user.appAccess || {}).map(([appId, entry]) => `${appId} ${(entry.roles || [entry.role]).filter(Boolean).join(' ')} ${entry.status || ''}`).join(' ');
    return [user.username, user.displayName, user.portalRole, user.status, accessText]
      .some((value) => String(value || '').toLowerCase().includes(keyword));
  });
}

function accessBadges(user) {
  const entries = Object.entries(user.appAccess || {});
  if (!entries.length) return '<span class="text-xs text-slate-400">Belum ada akses app</span>';
  const totalApps = registeredApps().length;
  const activeEntries = entries.filter(([, item]) => String(item.status || 'ACTIVE').toUpperCase() === 'ACTIVE');
  const allGranted = totalApps > 0 && entries.length === totalApps;
  const summary = allGranted
    ? '<span class="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-black text-blue-700" title="Akses ke semua aplikasi">*</span>'
    : `<span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">${entries.length}/${totalApps} APP</span>`;
  const badges = entries.map(([appId, item]) => {
    const label = (item.roles || [item.role]).filter(Boolean).join(', ') || 'ROLE KOSONG';
    const status = String(item.status || 'ACTIVE').toUpperCase();
    const tone = !item.role ? 'bg-amber-50 text-amber-700' : status === 'ACTIVE' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500';
    return `<span class="rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}">${escapeHtml(appId)} · ${escapeHtml(label)}${status === 'INACTIVE' ? ' · INACTIVE' : ''}</span>`;
  }).join('');
  return `${summary}${badges}<span class="sr-only">${activeEntries.length} akses aktif</span>`;
}

function render() {
  if (!containerRef) return;
  const records = filteredUsers();
  containerRef.innerHTML = `
    <section class="space-y-4">
      <div class="app-card flex flex-col gap-3 xl:flex-row xl:items-center">
        <label class="relative min-w-0 flex-1"><span class="sr-only">Cari user</span><input data-user-search value="${escapeHtml(query)}" class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Cari user, role, atau aplikasi..."></label>
        <label class="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"><input data-include-inactive type="checkbox" ${includeInactive ? 'checked' : ''}> User nonaktif</label>
        <button type="button" data-user-refresh class="app-button-secondary">Refresh</button>
        <button type="button" data-user-create class="app-button-primary">+ Tambah user</button>
      </div>
      <div class="grid gap-3">
        ${records.map((user) => `<article class="app-card"><div class="flex flex-col gap-4 xl:flex-row xl:items-center"><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-2"><h4 class="truncate font-bold text-slate-900">${escapeHtml(user.displayName || user.username)}</h4><span class="rounded-full px-2.5 py-1 text-[11px] font-bold ${user.portalRole === 'ADMIN' ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-700'}">${escapeHtml(user.portalRole)}</span><span class="rounded-full px-2.5 py-1 text-[11px] font-bold ${user.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">${escapeHtml(user.status)}</span></div><p class="mt-1 text-sm text-slate-500">@${escapeHtml(user.username)} · diperbarui ${escapeHtml(formatDate(user.updatedAt))}</p><div class="mt-3 flex flex-wrap gap-2">${accessBadges(user)}</div></div><div class="flex flex-wrap gap-2 xl:justify-end"><button type="button" data-user-edit="${escapeHtml(user.userId)}" class="app-button-secondary min-h-9 px-3">Edit</button><button type="button" data-user-password="${escapeHtml(user.userId)}" class="app-button-secondary min-h-9 px-3">Reset password</button><button type="button" data-user-revoke="${escapeHtml(user.userId)}" class="app-button-secondary min-h-9 px-3 text-amber-700">Revoke session</button></div></div></article>`).join('') || '<div class="app-card text-sm text-slate-500">User tidak ditemukan.</div>'}
      </div>
    </section>`;
  bind();
}

function roleList(appId) {
  return [...new Set([...(appRoleMaster[appId] || []), 'ADMIN', 'USER'].map((role) => String(role || '').trim().toUpperCase()).filter(Boolean))]
    .sort((a, b) => ({ ADMIN: 0, USER: 1 }[a] ?? 10) - ({ ADMIN: 0, USER: 1 }[b] ?? 10) || a.localeCompare(b));
}

function roleCheckboxDropdown(appId, currentRoles = [], enabled = true) {
  const selected = new Set((Array.isArray(currentRoles) ? currentRoles : [currentRoles]).map((role) => String(role || '').trim().toUpperCase()).filter(Boolean));
  const roles = roleList(appId);
  return `<details class="relative" data-role-dropdown="${escapeHtml(appId)}"><summary class="mt-1 flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 ${enabled ? '' : 'pointer-events-none opacity-45'}"><span data-role-summary>${escapeHtml([...selected].join(', ') || 'Belum terdaftar')}</span><span>⌄</span></summary><div class="absolute z-20 mt-2 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">${roles.map((role) => `<label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-50"><input type="checkbox" name="roles:${escapeHtml(appId)}" value="${escapeHtml(role)}" ${selected.has(role) ? 'checked' : ''} ${enabled ? '' : 'disabled'}><span>${escapeHtml(role)}</span></label>`).join('')}</div></details>`;
}

function appAccessFields(user) {
  return registeredApps().map((app) => {
    const current = user.appAccess?.[app.appId] || { access: false, status: 'ACTIVE', role: '', roles: [] };
    const currentRoles = current.roles || (current.role ? [current.role] : []);
    return `<article data-app-access-card="${escapeHtml(app.appId)}" class="rounded-2xl border border-slate-200 p-4 ${current.access ? 'bg-white' : 'bg-slate-50'}"><label class="flex items-center gap-3"><input data-app-access-checkbox="${escapeHtml(app.appId)}" name="access:${escapeHtml(app.appId)}" type="checkbox" ${current.access ? 'checked' : ''}><span class="font-bold text-slate-900">${escapeHtml(app.appName)}</span></label><div data-app-access-controls="${escapeHtml(app.appId)}" class="mt-3 grid gap-3 sm:grid-cols-2 ${current.access ? '' : 'opacity-45'}"><label class="text-xs font-bold uppercase tracking-wide text-slate-500">Role (bisa lebih dari satu)${roleCheckboxDropdown(app.appId, currentRoles, current.access)}</label><label class="text-xs font-bold uppercase tracking-wide text-slate-500">Status<select name="appStatus:${escapeHtml(app.appId)}" ${current.access ? '' : 'disabled'} class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-normal text-slate-800"><option value="ACTIVE" ${current.status !== 'INACTIVE' ? 'selected' : ''}>ACTIVE</option><option value="INACTIVE" ${current.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option></select></label></div></article>`;
  }).join('');
}

function userFormTemplate(user = null) {
  return `<form data-user-form class="space-y-5"><div class="grid gap-4 sm:grid-cols-2"><label class="text-sm font-semibold text-slate-700">Username<input name="username" ${user ? 'readonly' : ''} value="${escapeHtml(user?.username || '')}" required class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"></label><label class="text-sm font-semibold text-slate-700">Nama tampilan<input name="displayName" value="${escapeHtml(user?.displayName || '')}" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"></label>${user ? '' : '<label class="text-sm font-semibold text-slate-700 sm:col-span-2">Password awal<input name="password" type="password" minlength="8" required class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal" autocomplete="new-password"></label>'}<label class="text-sm font-semibold text-slate-700">Portal role<select name="portalRole" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"><option value="USER" ${user?.portalRole !== 'ADMIN' ? 'selected' : ''}>USER</option><option value="ADMIN" ${user?.portalRole === 'ADMIN' ? 'selected' : ''}>ADMIN</option></select></label><label class="text-sm font-semibold text-slate-700">Status<select name="status" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"><option value="ACTIVE" ${user?.status !== 'INACTIVE' ? 'selected' : ''}>ACTIVE</option><option value="INACTIVE" ${user?.status === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option></select></label></div><div><div class="flex flex-wrap items-end justify-between gap-3"><div><h4 class="font-bold text-slate-900">Akses aplikasi</h4><p class="mt-1 text-xs text-slate-500">Centang app yang muncul di portal. Role kosong tetap menampilkan app, tetapi app tidak dapat dibuka.</p></div><div class="flex gap-2"><button type="button" data-select-all-apps class="app-button-secondary min-h-9 px-3">Pilih semua</button><button type="button" data-clear-all-apps class="app-button-secondary min-h-9 px-3">Kosongkan</button></div></div><div class="mt-3 grid gap-3 xl:grid-cols-2">${appAccessFields(user || {}) || '<p class="text-sm text-slate-500">Belum ada app terdaftar.</p>'}</div></div><div class="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white/95 py-4 backdrop-blur"><button type="button" data-form-cancel class="app-button-secondary">Batal</button><button type="submit" class="app-button-primary">Simpan</button></div></form>`;
}

function setAppCardEnabled(host, checkbox) {
  const appId = checkbox.dataset.appAccessCheckbox;
  const controls = host.querySelector(`[data-app-access-controls="${CSS.escape(appId)}"]`);
  const card = host.querySelector(`[data-app-access-card="${CSS.escape(appId)}"]`);
  controls?.classList.toggle('opacity-45', !checkbox.checked);
  controls?.querySelectorAll('select, input[type=checkbox]').forEach((control) => { control.disabled = !checkbox.checked; });
  controls?.querySelector('details')?.classList.toggle('pointer-events-none', !checkbox.checked);
  card?.classList.toggle('bg-slate-50', !checkbox.checked);
  card?.classList.toggle('bg-white', checkbox.checked);
}

function openDialog(title, body) {
  const host = document.createElement('div');
  host.className = 'fixed inset-0 z-[150] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm';
  host.innerHTML = `<section class="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6"><div class="mb-5"><p class="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Management User</p><h3 class="mt-1 text-xl font-bold text-slate-900">${escapeHtml(title)}</h3></div>${body}</section>`;
  document.body.appendChild(host);
  host.addEventListener('click', (event) => { if (event.target === host) host.remove(); });
  host.querySelector('[data-form-cancel]')?.addEventListener('click', () => host.remove());
  host.querySelectorAll('[data-app-access-checkbox]').forEach((checkbox) => checkbox.addEventListener('change', () => setAppCardEnabled(host, checkbox)));
  host.querySelectorAll('[data-role-dropdown]').forEach((details) => details.addEventListener('change', () => { const roles = [...details.querySelectorAll('input:checked')].map((input) => input.value); const summary = details.querySelector('[data-role-summary]'); if (summary) summary.textContent = roles.join(', ') || 'Belum terdaftar'; }));
  host.querySelector('[data-select-all-apps]')?.addEventListener('click', () => host.querySelectorAll('[data-app-access-checkbox]').forEach((checkbox) => { checkbox.checked = true; setAppCardEnabled(host, checkbox); }));
  host.querySelector('[data-clear-all-apps]')?.addEventListener('click', () => host.querySelectorAll('[data-app-access-checkbox]').forEach((checkbox) => { checkbox.checked = false; setAppCardEnabled(host, checkbox); }));
  return host;
}

async function openUserForm(user = null) {
  const host = openDialog(user ? 'Edit user' : 'Tambah user', userFormTemplate(user));
  host.querySelector('[data-user-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = event.currentTarget.querySelector('[type="submit"]');
    submitButton.disabled = true;
    const formData = new FormData(event.currentTarget);
    const appAccess = {};
    registeredApps().forEach((app) => {
      if (!formData.has(`access:${app.appId}`)) return;
      appAccess[app.appId] = { access: true, status: String(formData.get(`appStatus:${app.appId}`) || 'ACTIVE').trim().toUpperCase(), roles: formData.getAll(`roles:${app.appId}`).map((role) => String(role || '').trim().toUpperCase()).filter(Boolean) };
    });
    const values = { displayName: formData.get('displayName'), portalRole: String(formData.get('portalRole') || 'USER').toUpperCase(), status: String(formData.get('status') || 'ACTIVE').toUpperCase(), appAccess };
    try {
      if (user) await callApi('users.update', { userId: user.userId, values }, { deduplicate: false });
      else await callApi('users.create', { username: formData.get('username'), displayName: formData.get('displayName'), password: formData.get('password'), portalRole: values.portalRole, status: values.status, appAccess }, { deduplicate: false });
      toast.success(user ? 'User diperbarui.' : 'User ditambahkan.');
      host.remove();
      await load();
    } catch (error) {
      toast.error(error.message);
      submitButton.disabled = false;
    }
  });
}

function openPasswordDialog(user) {
  const host = openDialog(`Reset password · ${user.displayName || user.username}`, `<form data-password-form class="space-y-4"><label class="text-sm font-semibold text-slate-700">Password baru<input name="password" type="password" minlength="8" required autocomplete="new-password" class="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 font-normal"></label><p class="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Reset password juga mencabut seluruh sesi lama user.</p><div class="flex justify-end gap-2"><button type="button" data-form-cancel class="app-button-secondary">Batal</button><button type="submit" class="app-button-primary">Reset password</button></div></form>`);
  host.querySelector('[data-password-form]').addEventListener('submit', async (event) => { event.preventDefault(); try { await callApi('users.resetPassword', { userId: user.userId, password: new FormData(event.currentTarget).get('password') }, { deduplicate: false }); toast.success('Password direset.'); host.remove(); await load(); } catch (error) { toast.error(error.message); } });
}

async function load({ background = false, force = false } = {}) {
  if (!containerRef) return;
  if (refreshPromise && !force) return refreshPromise;
  const hasVisibleData = users.length > 0 || apps.length > 0;
  if (!background && !hasVisibleData) {
    containerRef.innerHTML = '<div class="app-card animate-pulse text-sm text-slate-500">Memuat user dan akses aplikasi...</div>';
  }
  refreshPromise = (async () => {
    try {
      const [userResult, appResult] = await Promise.all([
        callApi('users.list', { includeInactive }, { deduplicate: false }),
        callApi('apps.list', { includeInactive: true, includeDeleted: false }, { deduplicate: false })
      ]);
      users = userResult.data?.users || [];
      appRoleMaster = userResult.data?.appRoleMaster || {};
      apps = appResult.data?.apps || [];
      writeCache({ users, appRoleMaster, apps, savedAt: Date.now() });
      if (containerRef) render();
    } catch (error) {
      if (!hasVisibleData && containerRef) {
        containerRef.innerHTML = `<div class="app-card border-red-200 bg-red-50 text-sm text-red-700">${escapeHtml(error.message)}</div>`;
      }
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function bind() {
  abortController?.abort();
  abortController = new AbortController();
  const { signal } = abortController;
  containerRef.querySelector('[data-user-search]')?.addEventListener('input', (event) => { const cursor = event.target.selectionStart; query = event.target.value; render(); const input = containerRef?.querySelector('[data-user-search]'); input?.focus(); input?.setSelectionRange(cursor, cursor); }, { signal });
  containerRef.querySelector('[data-include-inactive]')?.addEventListener('change', async (event) => { includeInactive = event.target.checked; await load(); }, { signal });
  containerRef.querySelector('[data-user-refresh]')?.addEventListener('click', () => load({ force: true }), { signal });
  containerRef.querySelector('[data-user-create]')?.addEventListener('click', () => openUserForm(), { signal });
  containerRef.querySelectorAll('[data-user-edit]').forEach((button) => button.addEventListener('click', () => openUserForm(users.find((user) => user.userId === button.dataset.userEdit)), { signal }));
  containerRef.querySelectorAll('[data-user-password]').forEach((button) => button.addEventListener('click', () => openPasswordDialog(users.find((user) => user.userId === button.dataset.userPassword)), { signal }));
  containerRef.querySelectorAll('[data-user-revoke]').forEach((button) => button.addEventListener('click', async () => { const user = users.find((item) => item.userId === button.dataset.userRevoke); if (!user || !confirm(`Cabut seluruh sesi ${user.displayName || user.username}?`)) return; try { await callApi('users.revokeSessions', { userId: user.userId }, { deduplicate: false }); toast.success('Seluruh sesi user dicabut.'); await load(); } catch (error) { toast.error(error.message); } }, { signal }));
}

export async function mount(container) {
  containerRef = container;
  const cached = readCache();
  if (cached?.users && cached?.apps) {
    users = cached.users;
    appRoleMaster = cached.appRoleMaster || {};
    apps = cached.apps;
    render();
    void load({ background: true });
    return;
  }
  await load();
}
