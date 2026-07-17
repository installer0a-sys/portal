import { defineApp } from '../../sdk/portal-sdk.js';
import { callApi } from '../../core/api.js';
import { toast } from '../../core/toast.js';
import { getAppAccess } from '../../core/access.js';

let host = null;
let contextRef = null;
let activePage = 'dashboard';
let selectedSheet = '';
let scheduleData = null;
let abortController = null;

const CACHE_PREFIX = 'portal.appA.v055.';
const escapeHtml = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const readCache = (key) => { try { return JSON.parse(localStorage.getItem(CACHE_PREFIX + key) || 'null'); } catch { return null; } };
const writeCache = (key, value) => { try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ value, savedAt: Date.now() })); } catch {} };

function roles() {
  const access = getAppAccess(contextRef?.session, 'appA');
  return access.roles || (access.role ? [access.role] : []);
}
function isAdmin() { return roles().includes('ADMIN'); }
function canEdit() { return isAdmin() || roles().some((role) => ['SPV','PS','PIC ZONA','TEAM ANALIST','TEAM MARKETING','ADVISOR','SUPPORT'].includes(role)); }
function pageTitle() {
  return ({ dashboard:'Dashboard','jadwal-all':'Jadwal All','jadwal-spv':'Jadwal SPV','dop-dos':'DOP DOS','jadwal-lama':'Jadwal Lama','admin-jadwal':'Pengaturan Jadwal','admin-karyawan':'Data Karyawan','admin-roster':'Pengaturan Roster','admin-libur':'Data Libur','admin-generate':'Generate Jadwal','admin-download':'Download Workschedule' })[activePage] || 'Jadwal A542';
}
function renderLoading(message = 'Memuat data...') { host.innerHTML = `<article class="app-card min-h-[55vh] grid place-items-center"><p class="text-sm font-semibold text-slate-500">${escapeHtml(message)}</p></article>`; }
function renderError(error) { host.innerHTML = `<article class="app-card border-red-200 bg-red-50 text-sm text-red-700">${escapeHtml(error.message || error)}</article>`; }

function scheduleTable(data) {
  const headers = data.headers || []; const rows = data.rows || [];
  if (!headers.length) return '<div class="grid min-h-72 place-items-center text-sm text-slate-500">Sheet jadwal belum memiliki data.</div>';
  return `<div id="jadwal-a542-capture" class="jadwal-table-scroll max-h-[calc(100vh-290px)] overflow-auto rounded-2xl border border-slate-200 bg-white"><table class="min-w-max border-separate border-spacing-0 text-xs"><thead><tr>${headers.map((header,index)=>`<th class="sticky top-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-3 py-2.5 text-left font-bold text-slate-700 ${index<4?`jadwal-sticky-head jadwal-col-${index+1}`:''}">${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row)=>`<tr>${headers.map((_,index)=>`<td class="border-b border-r border-slate-200 bg-white px-3 py-2 text-slate-700 ${index<4?`jadwal-sticky-cell jadwal-col-${index+1}`:''}">${escapeHtml(row[index]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function toolbar(data) {
  return `<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 class="text-2xl font-bold text-slate-900">${escapeHtml(pageTitle())}</h2><p class="mt-1 text-sm text-slate-500">${escapeHtml(data.sheetName || 'Jadwal A542')}</p></div><div class="flex flex-wrap items-center gap-2"><select data-sheet-select class="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">${(data.sheets||[]).map((name)=>`<option value="${escapeHtml(name)}" ${name===data.sheetName?'selected':''}>${escapeHtml(name)}</option>`).join('')}</select><button data-refresh class="app-button-secondary">Refresh</button><button data-screenshot class="app-button-secondary">Screenshot</button><button data-export class="app-button-secondary">Download XLSX</button>${canEdit()?'<button data-edit-hint class="app-button-primary">Edit Jadwal</button>':''}</div></div>`;
}
async function loadScript(src, globalName) {
  if (globalName && window[globalName]) return window[globalName];
  await new Promise((resolve,reject)=>{ const existing=document.querySelector(`script[src="${src}"]`); if(existing){ if(globalName&&window[globalName]) return resolve(); existing.addEventListener('load',resolve,{once:true}); existing.addEventListener('error',reject,{once:true}); return; } const script=document.createElement('script'); script.src=src; script.async=true; script.onload=resolve; script.onerror=reject; document.head.appendChild(script); });
  return globalName ? window[globalName] : true;
}
async function screenshot() { try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','html2canvas'); const target=host.querySelector('#jadwal-a542-capture'); if(!target) throw new Error('Tabel belum tersedia.'); const canvas=await window.html2canvas(target,{backgroundColor:'#ffffff',scale:1.5}); const link=document.createElement('a'); link.download=`Jadwal_A542_${scheduleData?.sheetName||'jadwal'}.png`; link.href=canvas.toDataURL('image/png'); link.click(); } catch(error){ toast.error(`Screenshot gagal: ${error.message}`); } }
async function exportXlsx() { try { await loadScript('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js','XLSX'); const worksheet=window.XLSX.utils.aoa_to_sheet([scheduleData.headers,...scheduleData.rows]); const workbook=window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(workbook,worksheet,String(scheduleData.sheetName||'Jadwal').slice(0,31)); window.XLSX.writeFile(workbook,`Jadwal_A542_${scheduleData.sheetName||'jadwal'}.xlsx`); } catch(error){ toast.error(`Download gagal: ${error.message}`); } }
function bindSchedule() { abortController?.abort(); abortController=new AbortController(); const {signal}=abortController; host.querySelector('[data-sheet-select]')?.addEventListener('change',(event)=>{selectedSheet=event.target.value; void loadSchedule(true);},{signal}); host.querySelector('[data-refresh]')?.addEventListener('click',()=>loadSchedule(true),{signal}); host.querySelector('[data-screenshot]')?.addEventListener('click',screenshot,{signal}); host.querySelector('[data-export]')?.addEventListener('click',exportXlsx,{signal}); host.querySelector('[data-edit-hint]')?.addEventListener('click',()=>toast.info('Editor jadwal bertahap akan memakai pembatasan NIP, zona, dan role pada fase berikutnya.'),{signal}); }

async function loadDashboard() {
  const cached=readCache('dashboard'); if(cached?.value){ renderDashboard(cached.value); }
  else renderLoading('Memuat Dashboard Jadwal A542...');
  try { const result=await callApi('appA.dashboard',{sheetName:selectedSheet},{deduplicate:false}); writeCache('dashboard',result.data||{}); renderDashboard(result.data||{}); } catch(error){ if(!cached?.value) renderError(error); }
}
function renderDashboard(data) { host.innerHTML=`<section class="space-y-4"><div class="flex items-center justify-between gap-3"><div><h2 class="text-2xl font-bold text-slate-900">Dashboard</h2><p class="mt-1 text-sm text-slate-500">Ringkasan jadwal ${escapeHtml(data.sheetName||'')}</p></div><button data-refresh class="app-button-secondary">Refresh</button></div><div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><article class="app-card"><p class="text-sm text-slate-500">Total karyawan</p><strong class="mt-2 block text-3xl text-slate-900">${Number(data.totalEmployees||0)}</strong></article>${Object.entries(data.summary||{}).slice(0,7).map(([key,value])=>`<article class="app-card"><p class="truncate text-sm text-slate-500">${escapeHtml(key)}</p><strong class="mt-2 block text-3xl text-slate-900">${Number(value||0)}</strong></article>`).join('')}</div></section>`; host.querySelector('[data-refresh]')?.addEventListener('click',()=>loadDashboard()); }
async function loadSchedule(force=false) { const key=`schedule.${selectedSheet||'active'}`; const cached=readCache(key); if(cached?.value){ scheduleData=cached.value; renderSchedule(scheduleData); } else renderLoading(); try { const result=await callApi('appA.schedule.list',{sheetName:selectedSheet,limit:500},{deduplicate:!force}); scheduleData=result.data||{}; selectedSheet=scheduleData.sheetName||selectedSheet; writeCache(`schedule.${selectedSheet||'active'}`,scheduleData); renderSchedule(scheduleData); } catch(error){ if(!cached?.value) renderError(error); } }
function renderSchedule(data){ host.innerHTML=`<section class="space-y-4">${toolbar(data)}${scheduleTable(data)}</section>`; bindSchedule(); }

function employeeTable(data) {
  const headers=data.headers||[]; const rows=data.rows||[];
  if(!headers.length) return '<div class="grid min-h-72 place-items-center text-sm text-slate-500">Konfigurasi sheet Data Karyawan belum lengkap.</div>';
  return `<div class="max-h-[calc(100vh-300px)] overflow-auto rounded-2xl border border-slate-200 bg-white"><table class="min-w-full text-xs"><thead><tr>${headers.map((h)=>`<th class="sticky top-0 bg-slate-100 px-3 py-2 text-left font-bold text-slate-700">${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row)=>`<tr>${headers.map((_,i)=>`<td class="border-t border-slate-200 px-3 py-2 text-slate-700">${escapeHtml(row[i]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
async function loadEmployees(force=false) {
  const cached=readCache('employees'); if(cached?.value) renderEmployees(cached.value); else renderLoading('Memuat Data Karyawan...');
  try { const query=host?.querySelector('[data-employee-search]')?.value||''; const result=await callApi('appA.employees.list',{query,limit:500},{deduplicate:!force}); writeCache('employees',result.data||{}); renderEmployees(result.data||{}); } catch(error){ if(!cached?.value) renderError(error); }
}
function renderEmployees(data){ host.innerHTML=`<section class="space-y-4"><div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><h2 class="text-2xl font-bold text-slate-900">Data Karyawan</h2><p class="mt-1 text-sm text-slate-500">${escapeHtml(data.sheetName||'Sheet belum dipilih')} · ${Number(data.total||0)} data</p></div><div class="flex gap-2"><input data-employee-search class="min-w-64 rounded-xl border border-slate-300 px-3 py-2.5 text-sm" placeholder="Cari NIP, nama, zona..."><button data-search class="app-button-secondary">Cari</button><button data-refresh class="app-button-secondary">Refresh</button></div></div>${employeeTable(data)}</section>`; host.querySelector('[data-search]')?.addEventListener('click',()=>loadEmployees(true)); host.querySelector('[data-refresh]')?.addEventListener('click',()=>loadEmployees(true)); host.querySelector('[data-employee-search]')?.addEventListener('keydown',(e)=>{if(e.key==='Enter') loadEmployees(true);}); }

const CONFIG_FIELDS = [
 ['CONF_JADWAL_SHEET','Sheet Jadwal','sheet'],['CONF_JADWAL_REFRESH','Refresh otomatis (menit)','text'],
 ['CONF_KAR_SHEET','Sheet Data Karyawan','sheet'],['CONF_KAR_NIP','Kolom NIP','CONF_KAR_SHEET'],['CONF_KAR_NAMA','Kolom Nama','CONF_KAR_SHEET'],['CONF_KAR_DEPT','Kolom Departemen','CONF_KAR_SHEET'],['CONF_KAR_ZONA','Kolom Zona','CONF_KAR_SHEET'],['CONF_KAR_JABATAN','Kolom Jabatan','CONF_KAR_SHEET'],['CONF_KAR_RO','Kolom RO','CONF_KAR_SHEET'],
 ['CONF_ROSTER_SHEET','Sheet Roster','sheet'],['CONF_ROSTER_DROP','Kolom kode roster','CONF_ROSTER_SHEET'],['CONF_ROSTER_DISP','Kolom nama roster','CONF_ROSTER_SHEET'],
 ['CONF_SPV_SHEET','Sheet SPV','sheet'],['CONF_SPV_HEADER','Kolom identitas SPV','CONF_SPV_SHEET'],
 ['CONF_DOP_SHEET','Sheet DOP DOS','sheet'],['CONF_DOP_HEADER','Kolom DOP DOS','CONF_DOP_SHEET']
];
function configInput(key,label,source,data){
  const config=data.config||{};
  if(source==='text') return `<label class="block"><span class="mb-1.5 block text-xs font-semibold text-slate-600">${escapeHtml(label)}</span><input data-config-key="${key}" value="${escapeHtml(config[key]||'')}" class="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"></label>`;
  const options=source==='sheet'?(data.sheets||[]):((data.headers||{})[config[source]]||[]);
  return `<label class="block"><span class="mb-1.5 block text-xs font-semibold text-slate-600">${escapeHtml(label)}</span><select data-config-key="${key}" data-config-source="${source}" class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"><option value="">-- Pilih --</option>${options.map((v)=>`<option value="${escapeHtml(v)}" ${String(config[key]||'')===String(v)?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></label>`;
}
async function loadConfiguration(force=false) { if(!isAdmin()) return renderError(new Error('Hanya Admin App yang dapat membuka pengaturan.')); const cached=readCache('config'); if(cached?.value) renderConfiguration(cached.value); else renderLoading('Memuat konfigurasi Jadwal A542...'); try { const result=await callApi('appA.config.get',{}, {deduplicate:!force}); writeCache('config',result.data||{}); renderConfiguration(result.data||{}); } catch(error){ if(!cached?.value) renderError(error); } }
function renderConfiguration(data){ host.innerHTML=`<section class="space-y-4"><div><h2 class="text-2xl font-bold text-slate-900">Pengaturan Jadwal</h2><p class="mt-1 text-sm text-slate-500">Membaca dan memperbarui key terpilih di CONFIG_WEB tanpa mengganti konfigurasi lain.</p></div><article class="app-card"><div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">${CONFIG_FIELDS.map(([key,label,source])=>configInput(key,label,source,data)).join('')}</div><div class="mt-5 flex justify-end gap-2"><button data-refresh class="app-button-secondary">Refresh</button><button data-save class="app-button-primary">Simpan</button></div></article></section>`; host.querySelectorAll('select[data-config-source="sheet"]').forEach((select)=>select.addEventListener('change',()=>loadConfiguration(true))); host.querySelector('[data-refresh]')?.addEventListener('click',()=>loadConfiguration(true)); host.querySelector('[data-save]')?.addEventListener('click',saveConfiguration); }
async function saveConfiguration(){ const config={}; host.querySelectorAll('[data-config-key]').forEach((el)=>{config[el.dataset.configKey]=el.value;}); const button=host.querySelector('[data-save]'); button.disabled=true; button.textContent='Menyimpan...'; try { await callApi('appA.config.save',{config},{deduplicate:false}); localStorage.removeItem(CACHE_PREFIX+'config'); toast.success('Pengaturan Jadwal berhasil disimpan.'); await loadConfiguration(true); } catch(error){ toast.error(error.message); button.disabled=false; button.textContent='Simpan'; } }
function renderPlaceholder(){ host.innerHTML=`<article class="app-card"><h2 class="text-xl font-bold text-slate-900">${escapeHtml(pageTitle())}</h2><p class="mt-2 text-sm text-slate-500">Fondasi menu tersedia. Fungsi bisnis berikutnya akan dipindahkan bertahap tanpa mengubah web mandiri lama.</p></article>`; }
async function renderPage(){ if(activePage==='dashboard') return loadDashboard(); if(['jadwal-all','jadwal-spv','dop-dos','jadwal-lama'].includes(activePage)) return loadSchedule(); if(activePage==='admin-karyawan') return loadEmployees(); if(activePage==='admin-jadwal') return loadConfiguration(); return renderPlaceholder(); }

const app=defineApp({ id:'appA', async mount(container,context={}){ host=container; contextRef=context; activePage=context.internalMenu?.find((item)=>item.default)?.route||'dashboard'; document.querySelectorAll('[data-internal-route]').forEach((button)=>context.lifecycle?.listen(button,'click',()=>{ activePage=button.dataset.internalRoute||'dashboard'; void renderPage(); })); await renderPage(); context.lifecycle?.addCleanup(()=>{abortController?.abort(); host=null; contextRef=null; scheduleData=null;}); }, async refresh(){await renderPage();}, async pause(){}, async resume(){}, async unmount(){abortController?.abort(); if(host)host.innerHTML=''; host=null; contextRef=null;} });
export const { mount,refresh,pause,resume,unmount }=app;
