import { defineApp } from '../../sdk/portal-sdk.js';
import { callApi } from '../../core/api.js';
import { toast } from '../../core/toast.js';
import { getAppAccess } from '../../core/access.js';

let host = null;
let contextRef = null;
let activePage = 'dashboard';
let selectedSheet = '';
let dayOffset = 0;
let scheduleData = null;
let abortController = null;
let viewRevision = 0;

const CACHE_PREFIX = 'portal.appA.v058.';
const escapeHtml = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const readCache = (key) => { try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || 'null'); } catch { return null; } };
const writeCache = (key, value) => { try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, savedAt: Date.now() })); } catch {} };

function beginView(page = activePage) {
  activePage = page;
  viewRevision += 1;
  abortController?.abort();
  abortController = null;
  return viewRevision;
}
function isCurrentView(revision, page = activePage) {
  return Boolean(host) && revision === viewRevision && page === activePage;
}
function safeRender(revision, page, renderer) {
  if (!isCurrentView(revision, page)) return false;
  renderer();
  return true;
}

function roles() {
  const access = getAppAccess(contextRef?.session, 'appA');
  return (access.roles || (access.role ? [access.role] : [])).map((role) => String(role || '').trim().toUpperCase());
}
function isAdmin() { return roles().includes('ADMIN'); }
function canEdit() { return isAdmin() || roles().some((role) => ['SPV','PS','PIC ZONA','TEAM ANALIST','TEAM MARKETING','ADVISOR','SUPPORT'].includes(role)); }
function pageTitle() {
  return ({ dashboard:'Dashboard','jadwal-all':'Jadwal All','jadwal-spv':'Jadwal SPV','dop-dos':'DOP DOS','jadwal-lama':'Jadwal Lama','admin-jadwal':'Pengaturan Jadwal','admin-karyawan':'Data Karyawan','admin-roster':'Pengaturan Roster','admin-libur':'Data Libur','admin-generate':'Generate Jadwal','admin-download':'Download Workschedule' })[activePage] || 'Jadwal A542';
}
function renderLoading(message = 'Memuat data...') {
  host.innerHTML = `<article class="min-h-[55vh] rounded-2xl border border-slate-200 bg-white grid place-items-center"><div class="text-center"><div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"></div><p class="text-sm font-semibold text-slate-500">${escapeHtml(message)}</p></div></article>`;
}
function renderError(error) {
  host.innerHTML = `<article class="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">${escapeHtml(error.message || error)}</article>`;
}
function sheetOptions(data) {
  return (data.sheets || []).map((name) => `<option value="${escapeHtml(name)}" ${name === data.sheetName ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
}
function pageHeader(title, subtitle, actions = '') {
  return `<div class="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"><div><h2 class="text-lg font-bold text-slate-900">${escapeHtml(title)}</h2>${subtitle ? `<p class="mt-1 text-xs text-slate-500">${escapeHtml(subtitle)}</p>` : ''}</div><div class="flex flex-wrap items-center gap-2">${actions}</div></div>`;
}

function dashboardTable(data) {
  const groups = data.groups || {};
  const zones = data.zones || Object.keys(groups);
  if (!zones.length) return `<div class="grid min-h-80 place-items-center text-sm text-slate-500">Data dashboard belum tersedia.</div>`;
  return `<div id="jadwal-dashboard-capture" class="overflow-auto bg-white" style="max-height:calc(100vh - 285px)"><table class="w-full min-w-[850px] border-separate border-spacing-0 text-[11px]"><thead><tr>${['NO','NIP','NAMA','DEPARTEMEN','JABATAN','ROSTER'].map((h, i) => `<th class="sticky top-0 z-30 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left font-extrabold text-slate-700 ${i < 4 ? `a542-stick a542-col-${i+1}` : ''}">${h}</th>`).join('')}</tr></thead><tbody>${zones.map((zone) => `<tr><td colspan="6" class="border-b border-slate-200 bg-emerald-100 px-3 py-2 font-extrabold text-emerald-900">${escapeHtml(zone)}</td></tr>${(groups[zone] || []).map((item, index) => `<tr>${[
    index + 1, item.nip, item.name, item.department, item.position, item.roster || '-'
  ].map((value, i) => `<td class="border-b border-r border-slate-200 bg-white px-3 py-2 text-slate-700 ${i < 4 ? `a542-stick a542-col-${i+1}` : ''}">${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}`).join('')}</tbody></table></div>`;
}
function renderDashboard(data) {
  const actions = `<label class="flex items-center gap-2 text-sm font-semibold text-slate-600"><span>Pilih Hari</span><select data-day-offset class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="0" ${Number(data.dayOffset)===0?'selected':''}>Hari Ini</option><option value="1" ${Number(data.dayOffset)===1?'selected':''}>Besok</option><option value="2" ${Number(data.dayOffset)===2?'selected':''}>Lusa</option></select></label><button data-dashboard-shot class="app-button-secondary">Screenshot</button><button data-refresh class="app-button-secondary">Refresh</button>`;
  host.innerHTML = `<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">${pageHeader('Dashboard', `${data.dateLabel || ''} · ${data.sheetName || ''}`, actions)}${dashboardTable(data)}</section>`;
  host.querySelector('[data-day-offset]')?.addEventListener('change', (event) => { dayOffset = Number(event.target.value || 0); void renderPage({ force: true, keepPage: true }); });
  host.querySelector('[data-refresh]')?.addEventListener('click', () => renderPage({ force: true, keepPage: true }));
  host.querySelector('[data-dashboard-shot]')?.addEventListener('click', () => screenshotTarget('#jadwal-dashboard-capture', `Dashboard_Jadwal_A542_${data.dateLabel || 'hari'}`));
}
async function loadDashboard(force = false, revision = viewRevision, page = activePage) {
  const key = `dashboard.${selectedSheet || 'active'}.${dayOffset}`;
  const cached = readCache(key);
  if (cached?.value) safeRender(revision, page, () => renderDashboard(cached.value));
  else safeRender(revision, page, () => renderLoading('Memuat Dashboard Jadwal A542...'));
  try {
    const result = await callApi('appA.dashboard', { sheetName: selectedSheet, dayOffset }, { deduplicate: !force });
    const data = result.data || {};
    if (!isCurrentView(revision, page)) return;
    selectedSheet = data.sheetName || selectedSheet;
    writeCache(key, data);
    renderDashboard(data);
  } catch (error) {
    if (!cached?.value) safeRender(revision, page, () => renderError(error));
  }
}

function scheduleTable(data) {
  const head1 = data.head1 || data.headers || [];
  const head2 = data.head2 || [];
  const grouped = data.groupedRows || {};
  const zones = data.zones || Object.keys(grouped);
  const rows = data.rows || [];
  if (!head1.length) return `<div class="grid min-h-80 place-items-center text-sm text-slate-500">Sheet jadwal belum memiliki data.</div>`;
  const body = zones.length ? zones.map((zone) => `<tr class="a542-zone"><td colspan="${head1.length}" class="border-b border-slate-200 bg-emerald-100 px-3 py-2 font-extrabold text-emerald-900">${escapeHtml(zone)}</td></tr>${(grouped[zone] || []).map((row) => scheduleRow(row, head1.length)).join('')}`).join('') : rows.map((row) => scheduleRow(row, head1.length)).join('');
  return `<div id="jadwal-a542-capture" class="overflow-auto bg-white" style="max-height:calc(100vh - 285px)"><table class="min-w-max border-separate border-spacing-0 text-[10px]"><thead><tr>${head1.map((header,index)=>`<th class="sticky top-0 z-30 min-w-[38px] border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-center font-extrabold text-slate-700 ${index<4?`a542-stick-head a542-col-${index+1}`:''}">${escapeHtml(header)}</th>`).join('')}</tr>${head2.some(Boolean) ? `<tr>${head2.map((header,index)=>`<th class="sticky top-[33px] z-30 border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-center font-bold text-slate-500 ${index<4?`a542-stick-head a542-col-${index+1}`:''}">${escapeHtml(header)}</th>`).join('')}</tr>` : ''}</thead><tbody>${body}</tbody></table></div>`;
}
function scheduleRow(row, count) {
  return `<tr>${Array.from({length:count},(_,index)=>`<td class="border-b border-r border-slate-200 bg-white px-2 py-2 text-center text-slate-700 ${index<4?`a542-stick a542-col-${index+1}`:''}">${escapeHtml(row[index] || '')}</td>`).join('')}</tr>`;
}
function scopeBadge(data) {
  const scope = data?.accessScope;
  if (!scope?.label || scope.mode === 'ALL') return '';
  return `<span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">${escapeHtml(scope.label)}</span>`;
}
function renderSchedule(data) {
  const actions = `<span class="text-sm font-semibold text-slate-500">Bulan:</span><select data-sheet-select class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold">${sheetOptions(data)}</select><button data-screenshot class="app-button-secondary">Screenshot</button><button data-refresh class="app-button-secondary">Refresh</button>${data.canEdit ? '<button data-edit-hint class="app-button-primary">Edit Jadwal</button>' : ''}`;
  host.innerHTML = `<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">${pageHeader(pageTitle(), `${data.sheetName || 'Jadwal A542'}${data.accessScope?.label ? ' · ' + data.accessScope.label : ''}`, actions)}${scheduleTable(data)}</section>`;
  bindSchedule();
}
async function loadSchedule(force = false, revision = viewRevision, page = activePage) {
  const key = `schedule.${page}.${selectedSheet || 'active'}`;
  const cached = readCache(key);
  if (cached?.value) {
    safeRender(revision, page, () => { scheduleData = cached.value; renderSchedule(scheduleData); });
  } else {
    safeRender(revision, page, () => renderLoading(`Memuat ${pageTitle()}...`));
  }
  try {
    const result = await callApi('appA.schedule.list', { sheetName: selectedSheet, limit: 1500, view: page }, { deduplicate: !force });
    const data = result.data || {};
    if (!isCurrentView(revision, page)) return;
    scheduleData = data;
    selectedSheet = data.sheetName || selectedSheet;
    writeCache(`schedule.${page}.${selectedSheet || 'active'}`, data);
    renderSchedule(data);
  } catch (error) {
    if (!cached?.value) safeRender(revision, page, () => renderError(error));
  }
}
function bindSchedule() {
  abortController?.abort();
  abortController = new AbortController();
  const { signal } = abortController;
  host.querySelector('[data-sheet-select]')?.addEventListener('change', (event) => { selectedSheet = event.target.value; void renderPage({ force: true, keepPage: true }); }, { signal });
  host.querySelector('[data-refresh]')?.addEventListener('click', () => renderPage({ force: true, keepPage: true }), { signal });
  host.querySelector('[data-screenshot]')?.addEventListener('click', () => screenshotTarget('#jadwal-a542-capture', `Jadwal_A542_${scheduleData?.sheetName || 'jadwal'}`), { signal });
  host.querySelector('[data-edit-hint]')?.addEventListener('click', openScheduleEditor, { signal });
}


/* v0.5.8 schedule editor */
let editorState = null;

function editorOptionHtml(options, selected) {
  const values = [{ value: '', label: '-- Kosong --' }, ...(options || [])];
  return values.map((option) => {
    const value = String(option.value ?? '');
    const label = String(option.label ?? value);
    return '<option value="' + escapeHtml(value) + '" ' + (value === String(selected ?? '') ? 'selected' : '') + '>' + escapeHtml(label) + '</option>';
  }).join('');
}

function closeScheduleEditor() {
  document.querySelector('#app-a-editor-modal')?.remove();
  editorState = null;
}

function renderScheduleEditor(data) {
  closeScheduleEditor();
  const columns = data.dateColumns || [];
  const rows = data.rows || [];
  const options = data.rosterOptions || [];
  const modal = document.createElement('div');
  modal.id = 'app-a-editor-modal';
  modal.className = 'fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/45 p-3';
  modal.innerHTML = '<section class="flex max-h-[94dvh] w-full max-w-[1500px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">' +
    '<header class="flex items-center gap-3 border-b border-slate-200 px-4 py-3">' +
      '<div class="min-w-0"><h2 class="text-base font-bold text-slate-900">Edit ' + escapeHtml(pageTitle()) + '</h2>' +
      '<p class="truncate text-[11px] text-slate-500">' + escapeHtml(data.sheetName || '') + (data.accessScope?.label ? ' · ' + escapeHtml(data.accessScope.label) : '') + '</p></div>' +
      '<div class="ml-auto flex gap-2"><button data-editor-cancel class="app-button-secondary">Batal</button><button data-editor-save class="app-button-primary">Simpan Perubahan</button></div>' +
    '</header>' +
    '<div class="overflow-auto">' +
      '<table class="min-w-max border-separate border-spacing-0 text-[10px]"><thead><tr>' +
      '<th class="sticky left-0 top-0 z-40 min-w-[70px] border-b border-r border-slate-200 bg-slate-100 px-2 py-2">NIP</th>' +
      '<th class="sticky left-[70px] top-0 z-40 min-w-[150px] border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-left">Nama</th>' +
      '<th class="sticky left-[220px] top-0 z-40 min-w-[120px] border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-left">Zona</th>' +
      columns.map((column) => '<th class="sticky top-0 z-30 min-w-[62px] border-b border-r border-slate-200 bg-slate-100 px-1 py-2 text-center">' + escapeHtml(column.day) + '<br><span class="font-normal text-slate-500">' + escapeHtml(column.weekday || '') + '</span></th>').join('') +
      '</tr></thead><tbody>' +
      rows.map((row) => '<tr>' +
        '<td class="sticky left-0 z-20 border-b border-r border-slate-200 bg-white px-2 py-1.5 text-center">' + escapeHtml(row.nip) + '</td>' +
        '<td class="sticky left-[70px] z-20 border-b border-r border-slate-200 bg-white px-2 py-1.5 font-medium">' + escapeHtml(row.name) + '</td>' +
        '<td class="sticky left-[220px] z-20 border-b border-r border-slate-200 bg-white px-2 py-1.5">' + escapeHtml(row.zone) + '</td>' +
        columns.map((column) => {
          const current = String(row.values?.[column.index] ?? '');
          return '<td class="border-b border-r border-slate-200 bg-white p-1">' +
            '<select data-editor-cell data-row-index="' + row.rowIndex + '" data-column-index="' + column.index + '" data-original="' + escapeHtml(current) + '" class="h-7 w-[58px] rounded-md border border-slate-300 bg-white px-1 text-[10px] outline-none focus:border-slate-500">' +
            editorOptionHtml(options, current) + '</select></td>';
        }).join('') +
      '</tr>').join('') +
      '</tbody></table>' +
    '</div>' +
    '<footer class="border-t border-slate-200 px-4 py-2 text-[11px] text-slate-500">Hanya nilai yang berubah yang dikirim ke server. Penyimpanan memakai validasi scope, optimistic locking, dan Audit Log.</footer>' +
  '</section>';
  document.body.appendChild(modal);
  editorState = data;
  modal.querySelector('[data-editor-cancel]')?.addEventListener('click', closeScheduleEditor);
  modal.addEventListener('click', (event) => { if (event.target === modal) closeScheduleEditor(); });
  modal.querySelector('[data-editor-save]')?.addEventListener('click', saveScheduleEditor);
}

async function openScheduleEditor() {
  try {
    toast.info('Memuat editor jadwal...');
    const result = await callApi('appA.schedule.editor.get', {
      sheetName: scheduleData?.sheetName || selectedSheet,
      view: activePage
    }, { deduplicate: false, timeoutMs: 30000 });
    renderScheduleEditor(result.data || {});
  } catch (error) {
    toast.error(error.message || 'Editor gagal dimuat.');
  }
}

async function saveScheduleEditor() {
  const modal = document.querySelector('#app-a-editor-modal');
  const button = modal?.querySelector('[data-editor-save]');
  if (!modal || !editorState || !button) return;
  const changes = [...modal.querySelectorAll('[data-editor-cell]')].map((select) => ({
    rowIndex: Number(select.dataset.rowIndex),
    columnIndex: Number(select.dataset.columnIndex),
    originalValue: String(select.dataset.original || ''),
    value: String(select.value || '')
  })).filter((change) => change.value !== change.originalValue);

  if (!changes.length) {
    toast.info('Tidak ada perubahan.');
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Menyimpan...';
  try {
    const result = await callApi('appA.schedule.editor.save', {
      sheetName: editorState.sheetName,
      view: activePage,
      changes
    }, { deduplicate: false, timeoutMs: 45000 });
    toast.success(result.message || changes.length + ' perubahan berhasil disimpan.');
    closeScheduleEditor();
    Object.keys(localStorage).filter((key) => key.startsWith(CACHE_PREFIX + 'schedule.')).forEach((key) => localStorage.removeItem(key));
    await renderPage({ force: true, keepPage: true });
  } catch (error) {
    toast.error(error.message || 'Penyimpanan gagal.');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}


async function loadScript(src, globalName) {
  if (globalName && window[globalName]) return window[globalName];
  await new Promise((resolve,reject)=>{ const existing=document.querySelector(`script[src="${src}"]`); if(existing){ if(globalName&&window[globalName]) return resolve(); existing.addEventListener('load',resolve,{once:true}); existing.addEventListener('error',reject,{once:true}); return; } const script=document.createElement('script'); script.src=src; script.async=true; script.onload=resolve; script.onerror=reject; document.head.appendChild(script); });
  return globalName ? window[globalName] : true;
}
async function screenshotTarget(selector, filename) {
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','html2canvas');
    const target = host.querySelector(selector); if (!target) throw new Error('Area belum tersedia.');
    const canvas = await window.html2canvas(target,{backgroundColor:'#ffffff',scale:1.5});
    const link = document.createElement('a'); link.download = `${filename}.png`; link.href = canvas.toDataURL('image/png'); link.click();
  } catch (error) { toast.error(`Screenshot gagal: ${error.message}`); }
}

function employeeTable(data) {
  const headers=data.headers||[]; const rows=data.rows||[];
  if(!headers.length) return '<div class="grid min-h-72 place-items-center text-sm text-slate-500">Konfigurasi Data Karyawan belum lengkap.</div>';
  return `<div class="max-h-[calc(100vh-300px)] overflow-auto"><table class="min-w-full text-xs"><thead><tr>${headers.map((h)=>`<th class="sticky top-0 bg-slate-100 px-3 py-2 text-left font-bold text-slate-700">${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row)=>`<tr>${headers.map((_,i)=>`<td class="border-t border-slate-200 px-3 py-2 text-slate-700">${escapeHtml(row[i]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
async function loadEmployees(force=false, revision=viewRevision, page=activePage) {
  const cached=readCache('employees');
  if(cached?.value) safeRender(revision,page,()=>renderEmployees(cached.value)); else safeRender(revision,page,()=>renderLoading('Memuat Data Karyawan...'));
  try { const result=await callApi('appA.employees.list',{query:'',limit:1000},{deduplicate:!force}); if(!isCurrentView(revision,page)) return; writeCache('employees',result.data||{}); renderEmployees(result.data||{}); } catch(error){ if(!cached?.value) safeRender(revision,page,()=>renderError(error)); }
}
function renderEmployees(data){ host.innerHTML=`<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">${pageHeader('Data Karyawan', `${data.sheetName||'Sheet belum dipilih'} · ${Number(data.total||0)} data`, '<button data-refresh class="app-button-secondary">Refresh</button>')}${employeeTable(data)}</section>`; host.querySelector('[data-refresh]')?.addEventListener('click',()=>loadEmployees(true)); }

async function loadConfiguration(force=false, revision=viewRevision, page=activePage) {
  if(!isAdmin()) return safeRender(revision,page,()=>renderError(new Error('Hanya Admin App yang dapat membuka pengaturan.')));
  const cached=readCache('config'); if(cached?.value) safeRender(revision,page,()=>renderConfiguration(cached.value)); else safeRender(revision,page,()=>renderLoading('Memuat konfigurasi Jadwal A542...'));
  try { const result=await callApi('appA.config.get',{}, {deduplicate:!force}); if(!isCurrentView(revision,page)) return; writeCache('config',result.data||{}); renderConfiguration(result.data||{}); } catch(error){ if(!cached?.value) safeRender(revision,page,()=>renderError(error)); }
}
function renderConfiguration(data){
  const cfg=data.config||{};
  const fields=[['CONF_JADWAL_SHEET','Sheet Jadwal'],['CONF_KAR_SHEET','Sheet Data Karyawan'],['CONF_ROSTER_SHEET','Sheet Roster'],['CONF_SPV_SHEET','Sheet SPV'],['CONF_DOP_SHEET','Sheet DOP DOS']];
  host.innerHTML=`<section class="space-y-4"><div><h2 class="text-xl font-bold text-slate-900">Pengaturan Jadwal</h2><p class="mt-1 text-sm text-slate-500">Fondasi konfigurasi. CONFIG_WEB lama tetap menjadi sumber data dan tidak diganti.</p></div><article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div class="grid gap-4 md:grid-cols-2">${fields.map(([key,label])=>`<label><span class="mb-1.5 block text-xs font-semibold text-slate-600">${label}</span><select data-config-key="${key}" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">-- Pilih --</option>${(data.sheets||[]).map((v)=>`<option value="${escapeHtml(v)}" ${String(cfg[key]||'')===String(v)?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></label>`).join('')}</div><div class="mt-5 flex justify-end gap-2"><button data-refresh class="app-button-secondary">Refresh</button><button data-save class="app-button-primary">Simpan</button></div></article></section>`;
  host.querySelector('[data-refresh]')?.addEventListener('click',()=>loadConfiguration(true));
  host.querySelector('[data-save]')?.addEventListener('click',saveConfiguration);
}
async function saveConfiguration(){ const config={}; host.querySelectorAll('[data-config-key]').forEach((el)=>{config[el.dataset.configKey]=el.value;}); try { await callApi('appA.config.save',{config},{deduplicate:false}); localStorage.removeItem(CACHE_PREFIX+'config'); toast.success('Pengaturan berhasil disimpan.'); await loadConfiguration(true); } catch(error){ toast.error(error.message); } }
function renderPlaceholder(){ host.innerHTML=`<article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 class="text-xl font-bold text-slate-900">${escapeHtml(pageTitle())}</h2><p class="mt-2 text-sm text-slate-500">Menu sudah ditempatkan sesuai struktur web lama. Fungsi bisnis akan dipindahkan bertahap tanpa mengubah web mandiri.</p></article>`; }
async function renderPage({ force = false, keepPage = false } = {}) {
  const page = activePage;
  const revision = keepPage ? ++viewRevision : beginView(page);
  if (page === 'dashboard') return loadDashboard(force, revision, page);
  if (['jadwal-all','jadwal-spv','dop-dos','jadwal-lama'].includes(page)) return loadSchedule(force, revision, page);
  if (page === 'admin-karyawan') return loadEmployees(force, revision, page);
  if (page === 'admin-jadwal') return loadConfiguration(force, revision, page);
  safeRender(revision, page, renderPlaceholder);
}


const styleId = 'jadwal-a542-r2-style';
function ensureStyle(){ if(document.getElementById(styleId)) return; const style=document.createElement('style'); style.id=styleId; style.textContent=`
.a542-stick,.a542-stick-head{position:sticky;z-index:20;background:#fff}.a542-stick-head{z-index:40;background:#f1f5f9}.a542-col-1{left:0;min-width:42px;max-width:42px}.a542-col-2{left:42px;min-width:72px;max-width:72px}.a542-col-3{left:114px;min-width:150px;max-width:150px}.a542-col-4{left:264px;min-width:125px;max-width:125px;box-shadow:4px 0 7px -5px rgba(15,23,42,.35)}
@media(max-width:767px){.a542-stick,.a542-stick-head{position:static}.a542-col-1,.a542-col-2,.a542-col-3,.a542-col-4{min-width:auto;max-width:none;box-shadow:none}}
`; document.head.appendChild(style); }

const app=defineApp({
  id:'appA',
  async mount(container,context={}){
    host=container;
    contextRef=context;
    ensureStyle();
    activePage=context.internalMenu?.find((item)=>item.default)?.route||'dashboard';
    viewRevision=0;
    document.querySelectorAll('[data-internal-route]').forEach((button)=>context.lifecycle?.listen(button,'click',()=>{
      const nextPage=button.dataset.internalRoute||'dashboard';
      if(nextPage===activePage && host?.childElementCount) return;
      activePage=nextPage;
      void renderPage();
    }));
    await renderPage();
    context.lifecycle?.addCleanup(()=>{ viewRevision+=1; abortController?.abort(); closeScheduleEditor(); host=null; contextRef=null; scheduleData=null; });
  },
  async refresh(){await renderPage({force:true,keepPage:true});},
  async pause(){},
  async resume(){},
  async unmount(){viewRevision+=1; abortController?.abort(); if(host)host.innerHTML=''; host=null; contextRef=null;}
});
export const { mount,refresh,pause,resume,unmount }=app;
