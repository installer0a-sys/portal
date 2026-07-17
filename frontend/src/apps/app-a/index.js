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

const escapeHtml = (value) => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function roles() {
  const access = getAppAccess(contextRef?.session, 'appA');
  return access.roles || (access.role ? [access.role] : []);
}

function canEdit() {
  const current = roles();
  return current.includes('ADMIN') || current.some((role) => ['SPV','PS','PIC ZONA','TEAM ANALIST','TEAM MARKETING','ADVISOR','SUPPORT'].includes(role));
}

function pageTitle() {
  return ({ dashboard: 'Dashboard', 'jadwal-all': 'Jadwal All', 'jadwal-spv': 'Jadwal SPV', 'dop-dos': 'DOP DOS', 'jadwal-lama': 'Jadwal Lama' })[activePage] || 'Jadwal A542';
}

function renderLoading(message = 'Memuat data...') {
  host.innerHTML = `<article class="app-card min-h-[55vh] grid place-items-center"><p class="text-sm font-semibold text-slate-500">${escapeHtml(message)}</p></article>`;
}

function scheduleTable(data) {
  const headers = data.headers || [];
  const rows = data.rows || [];
  if (!headers.length) return '<div class="grid min-h-72 place-items-center text-sm text-slate-500">Sheet jadwal belum memiliki data.</div>';
  return `<div id="jadwal-a542-capture" class="jadwal-table-scroll max-h-[calc(100vh-290px)] overflow-auto rounded-2xl border border-slate-200 bg-white">
    <table class="min-w-max border-separate border-spacing-0 text-xs">
      <thead>${headers.map((header, index) => `<th class="sticky top-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-3 py-2.5 text-left font-bold text-slate-700 ${index < 4 ? `jadwal-sticky-head jadwal-col-${index + 1}` : ''}">${escapeHtml(header)}</th>`).join('')}</thead>
      <tbody>${rows.map((row) => `<tr>${headers.map((_, index) => `<td class="border-b border-r border-slate-200 bg-white px-3 py-2 text-slate-700 ${index < 4 ? `jadwal-sticky-cell jadwal-col-${index + 1}` : ''}">${escapeHtml(row[index] || '')}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function toolbar(data) {
  return `<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
    <div><h2 class="text-2xl font-bold text-slate-900">${escapeHtml(pageTitle())}</h2><p class="mt-1 text-sm text-slate-500">Jadwal A542 · ${escapeHtml((roles().join(', ') || 'ROLE KOSONG'))}</p></div>
    <div class="flex flex-wrap items-center gap-2">
      <select data-sheet-select class="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm">${(data.sheets || []).map((name) => `<option value="${escapeHtml(name)}" ${name === data.sheetName ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select>
      <button data-refresh class="app-button-secondary">Refresh</button>
      <button data-screenshot class="app-button-secondary">Screenshot</button>
      <button data-export class="app-button-secondary">Download XLSX</button>
      ${canEdit() ? '<button data-edit-hint class="app-button-primary">Edit Jadwal</button>' : ''}
    </div>
  </div>`;
}

async function loadScript(src, globalName) {
  if (globalName && window[globalName]) return window[globalName];
  await new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
    const script = document.createElement('script'); script.src = src; script.async = true; script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
  });
  return globalName ? window[globalName] : true;
}

async function screenshot() {
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas');
    const target = host.querySelector('#jadwal-a542-capture');
    const canvas = await window.html2canvas(target, { backgroundColor: '#ffffff', scale: 1.5 });
    const link = document.createElement('a'); link.download = `Jadwal_A542_${scheduleData?.sheetName || 'jadwal'}.png`; link.href = canvas.toDataURL('image/png'); link.click();
  } catch (error) { toast.error(`Screenshot gagal: ${error.message}`); }
}

async function exportXlsx() {
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js', 'XLSX');
    const worksheet = window.XLSX.utils.aoa_to_sheet([scheduleData.headers, ...scheduleData.rows]);
    const workbook = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(workbook, worksheet, String(scheduleData.sheetName || 'Jadwal').slice(0, 31));
    window.XLSX.writeFile(workbook, `Jadwal_A542_${scheduleData.sheetName || 'jadwal'}.xlsx`);
  } catch (error) { toast.error(`Download gagal: ${error.message}`); }
}

function bind() {
  abortController?.abort(); abortController = new AbortController(); const { signal } = abortController;
  host.querySelector('[data-sheet-select]')?.addEventListener('change', (event) => { selectedSheet = event.target.value; void loadSchedule(); }, { signal });
  host.querySelector('[data-refresh]')?.addEventListener('click', () => loadSchedule(true), { signal });
  host.querySelector('[data-screenshot]')?.addEventListener('click', screenshot, { signal });
  host.querySelector('[data-export]')?.addEventListener('click', exportXlsx, { signal });
  host.querySelector('[data-edit-hint]')?.addEventListener('click', () => toast.info('Editor jadwal bertahap akan aktif pada v0.5.5. Hak role terbatas tetap mengikuti NIP dan zona.'), { signal });
}

async function loadDashboard() {
  renderLoading('Memuat Dashboard Jadwal A542...');
  try {
    const result = await callApi('appA.dashboard', { sheetName: selectedSheet }, { deduplicate: false });
    const data = result.data || {};
    host.innerHTML = `<section class="space-y-4"><div class="flex items-center justify-between gap-3"><div><h2 class="text-2xl font-bold text-slate-900">Dashboard</h2><p class="mt-1 text-sm text-slate-500">Ringkasan jadwal ${escapeHtml(data.sheetName || '')}</p></div><button data-refresh class="app-button-secondary">Refresh</button></div><div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><article class="app-card"><p class="text-sm text-slate-500">Total karyawan</p><strong class="mt-2 block text-3xl text-slate-900">${Number(data.totalEmployees || 0)}</strong></article>${Object.entries(data.summary || {}).slice(0,7).map(([key,value]) => `<article class="app-card"><p class="truncate text-sm text-slate-500">${escapeHtml(key)}</p><strong class="mt-2 block text-3xl text-slate-900">${Number(value || 0)}</strong></article>`).join('')}</div></section>`;
    host.querySelector('[data-refresh]')?.addEventListener('click', loadDashboard);
  } catch (error) { host.innerHTML = `<article class="app-card border-red-200 bg-red-50 text-sm text-red-700">${escapeHtml(error.message)}</article>`; }
}

async function loadSchedule(force = false) {
  renderLoading();
  try {
    const result = await callApi('appA.schedule.list', { sheetName: selectedSheet, limit: 500 }, { deduplicate: !force });
    scheduleData = result.data || {}; selectedSheet = scheduleData.sheetName || selectedSheet;
    host.innerHTML = `<section class="space-y-4">${toolbar(scheduleData)}${scheduleTable(scheduleData)}</section>`;
    bind();
  } catch (error) { host.innerHTML = `<article class="app-card border-red-200 bg-red-50 text-sm text-red-700">${escapeHtml(error.message)}</article>`; }
}

async function renderPage() {
  if (activePage === 'dashboard') return loadDashboard();
  if (['jadwal-all','jadwal-spv','dop-dos','jadwal-lama'].includes(activePage)) return loadSchedule();
  host.innerHTML = `<article class="app-card"><h2 class="text-xl font-bold text-slate-900">${escapeHtml(pageTitle())}</h2><p class="mt-2 text-sm text-slate-500">Fondasi menu sudah tersedia. Form administrasi akan dimigrasikan bertahap tanpa mengubah web mandiri lama.</p></article>`;
}

const app = defineApp({
  id: 'appA',
  async mount(container, context = {}) {
    host = container; contextRef = context;
    activePage = context.internalMenu?.find((item) => item.default)?.route || 'dashboard';
    document.querySelectorAll('[data-internal-route]').forEach((button) => context.lifecycle?.listen(button, 'click', () => { activePage = button.dataset.internalRoute || 'dashboard'; void renderPage(); }));
    await renderPage();
    context.lifecycle?.addCleanup(() => { abortController?.abort(); host = null; contextRef = null; scheduleData = null; });
  },
  async refresh() { await renderPage(); }, async pause() {}, async resume() {}, async unmount() { abortController?.abort(); if (host) host.innerHTML = ''; host = null; contextRef = null; }
});

export const { mount, refresh, pause, resume, unmount } = app;
