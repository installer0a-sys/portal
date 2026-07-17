import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'src/apps/app-a/index.js');
const entriesPath = path.join(root, 'src/entries/portal.js');

if (!fs.existsSync(indexPath)) {
  throw new Error('App A index.js tidak ditemukan.');
}

let source = fs.readFileSync(indexPath, 'utf8');
source = source
  .replaceAll("portal.appA.v0510.", "portal.appA.v060.")
  .replaceAll("portal.appA.v059.", "portal.appA.v060.");

const marker = 'v0.6.0 generate schedule';
if (!source.includes(marker)) {
  const anchor = "function renderPlaceholder(){";
  if (!source.includes(anchor)) {
    throw new Error('Anchor renderPlaceholder tidak ditemukan.');
  }

  const block = String.raw`
/* v0.6.0 generate schedule */
let generateState = null;

function generateRosterCheckboxes(options, selected = []) {
  return (options || []).map((option) => {
    const value = String(option.value || '');
    return '<label class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs">' +
      '<input type="checkbox" data-generate-roster value="' + escapeHtml(value) + '" ' + (selected.includes(value) ? 'checked' : '') + '>' +
      '<span class="font-semibold">' + escapeHtml(option.label || value) + '</span>' +
    '</label>';
  }).join('');
}

function generateDayCheckboxes(columns) {
  return (columns || []).map((column) =>
    '<label class="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]">' +
      '<input type="checkbox" data-generate-day value="' + escapeHtml(column.day) + '" checked>' +
      '<span>' + escapeHtml(column.day) + (column.weekday ? ' · ' + escapeHtml(column.weekday) : '') + '</span>' +
    '</label>'
  ).join('');
}

function renderGeneratePage(data) {
  generateState = { options: data, preview: null };
  const zones = [...new Set((data.employees || []).map((item) => item.zone).filter(Boolean))].sort();
  const defaults = data.defaults || {};

  host.innerHTML = '<section class="space-y-4">' +
    '<div><h2 class="text-xl font-bold text-slate-900">Generate Jadwal</h2>' +
    '<p class="mt-1 text-sm text-slate-500">Buat preview terlebih dahulu. Spreadsheet tidak berubah sampai tombol Terapkan ditekan.</p></div>' +
    '<article class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">' +
      '<div class="grid gap-4 lg:grid-cols-3">' +
        '<label><span class="mb-1 block text-xs font-semibold text-slate-600">Sheet Bulan</span>' +
          '<select data-generate-sheet class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">' +
          (data.sheets || []).map((name) => '<option value="' + escapeHtml(name) + '" ' + (name === data.sheetName ? 'selected' : '') + '>' + escapeHtml(name) + '</option>').join('') +
          '</select></label>' +
        '<label><span class="mb-1 block text-xs font-semibold text-slate-600">Zona</span>' +
          '<select data-generate-zone class="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"><option value="">Semua Zona</option>' +
          zones.map((zone) => '<option value="' + escapeHtml(zone) + '">' + escapeHtml(zone) + '</option>').join('') +
          '</select></label>' +
        '<label class="flex items-end gap-2 rounded-xl border border-slate-200 px-3 py-2">' +
          '<input type="checkbox" data-generate-overwrite><span class="text-xs font-semibold text-slate-700">Timpa sel yang sudah terisi</span></label>' +
      '</div>' +
      '<div class="mt-4"><p class="mb-2 text-xs font-semibold text-slate-600">Pola Roster</p>' +
        '<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">' + generateRosterCheckboxes(data.rosterOptions, defaults.sequence || []) + '</div></div>' +
      '<div class="mt-4"><div class="mb-2 flex items-center justify-between"><p class="text-xs font-semibold text-slate-600">Tanggal</p>' +
        '<div class="flex gap-2"><button data-days-all class="app-button-secondary">Semua</button><button data-days-none class="app-button-secondary">Kosongkan</button></div></div>' +
        '<div class="flex flex-wrap gap-2">' + generateDayCheckboxes(data.dateColumns) + '</div></div>' +
      '<div class="mt-5 flex justify-end gap-2"><button data-generate-refresh class="app-button-secondary">Refresh</button>' +
        '<button data-generate-preview class="app-button-primary">Buat Preview</button></div>' +
    '</article>' +
    '<div data-generate-result></div>' +
  '</section>';

  host.querySelector('[data-days-all]')?.addEventListener('click', () => host.querySelectorAll('[data-generate-day]').forEach((el) => { el.checked = true; }));
  host.querySelector('[data-days-none]')?.addEventListener('click', () => host.querySelectorAll('[data-generate-day]').forEach((el) => { el.checked = false; }));
  host.querySelector('[data-generate-refresh]')?.addEventListener('click', () => loadGenerateOptions(true));
  host.querySelector('[data-generate-sheet]')?.addEventListener('change', (event) => loadGenerateOptions(true, event.target.value));
  host.querySelector('[data-generate-preview]')?.addEventListener('click', generatePreview);
}

function collectGeneratePayload() {
  return {
    sheetName: host.querySelector('[data-generate-sheet]')?.value || '',
    zone: host.querySelector('[data-generate-zone]')?.value || '',
    overwrite: Boolean(host.querySelector('[data-generate-overwrite]')?.checked),
    sequence: [...host.querySelectorAll('[data-generate-roster]:checked')].map((el) => el.value),
    days: [...host.querySelectorAll('[data-generate-day]:checked')].map((el) => el.value)
  };
}

function renderGeneratePreview(data) {
  const target = host.querySelector('[data-generate-result]');
  if (!target) return;
  generateState.preview = data;

  const days = data.days || [];
  target.innerHTML = '<article class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">' +
    '<div class="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4">' +
      '<div><h3 class="font-bold text-slate-900">Preview Generate</h3>' +
      '<p class="text-xs text-slate-500">' + escapeHtml(data.sheetName || '') + ' · Hash ' + escapeHtml(String(data.planHash || '').slice(0, 12)) + '</p></div>' +
      '<div class="ml-auto grid grid-cols-3 gap-2 text-center text-xs">' +
        '<div class="rounded-lg bg-slate-100 px-3 py-2"><b>' + Number(data.summary?.cells || 0) + '</b><br>Sel</div>' +
        '<div class="rounded-lg bg-slate-100 px-3 py-2"><b>' + Number(data.summary?.employees || 0) + '</b><br>Karyawan</div>' +
        '<div class="rounded-lg bg-slate-100 px-3 py-2"><b>' + Number(data.skippedFilled || 0) + '</b><br>Dilewati</div>' +
      '</div>' +
      '<button data-generate-apply class="app-button-primary" ' + (!(data.changes || []).length ? 'disabled' : '') + '>Terapkan ke Spreadsheet</button>' +
    '</div>' +
    '<div class="max-h-[55vh] overflow-auto"><table class="min-w-max text-[10px]"><thead><tr>' +
      '<th class="sticky left-0 top-0 z-30 bg-slate-100 px-3 py-2 text-left">NIP</th>' +
      '<th class="sticky left-[80px] top-0 z-30 bg-slate-100 px-3 py-2 text-left">Nama</th>' +
      '<th class="sticky left-[230px] top-0 z-30 bg-slate-100 px-3 py-2 text-left">Zona</th>' +
      days.map((day) => '<th class="sticky top-0 bg-slate-100 px-3 py-2">' + escapeHtml(day) + '</th>').join('') +
    '</tr></thead><tbody>' +
      (data.previewRows || []).map((row) => '<tr>' +
        '<td class="sticky left-0 border-t bg-white px-3 py-2">' + escapeHtml(row.nip) + '</td>' +
        '<td class="sticky left-[80px] border-t bg-white px-3 py-2">' + escapeHtml(row.name) + '</td>' +
        '<td class="sticky left-[230px] border-t bg-white px-3 py-2">' + escapeHtml(row.zone) + '</td>' +
        days.map((day) => '<td class="border-t px-3 py-2 text-center font-semibold">' + escapeHtml(row.values?.[day] || '') + '</td>').join('') +
      '</tr>').join('') +
    '</tbody></table></div>' +
  '</article>';

  target.querySelector('[data-generate-apply]')?.addEventListener('click', applyGeneratePreview);
}

async function loadGenerateOptions(force = false, sheetName = '') {
  if (!isAdmin()) return renderError(new Error('Hanya Admin App yang dapat membuka Generate Jadwal.'));
  renderLoading('Memuat opsi Generate Jadwal...');
  try {
    const result = await callApi('appA.schedule.generate.options', { sheetName }, { deduplicate: !force, timeoutMs: 30000 });
    renderGeneratePage(result.data || {});
  } catch (error) {
    renderError(error);
  }
}

async function generatePreview() {
  const button = host.querySelector('[data-generate-preview]');
  const payload = collectGeneratePayload();
  const original = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Membuat Preview...'; }
  try {
    const result = await callApi('appA.schedule.generate.preview', payload, { deduplicate: false, timeoutMs: 45000 });
    renderGeneratePreview(result.data || {});
    toast.success('Preview berhasil dibuat. Belum ada data yang ditulis.');
  } catch (error) {
    toast.error(error.message);
  } finally {
    if (button) { button.disabled = false; button.textContent = original; }
  }
}

async function applyGeneratePreview() {
  if (!generateState?.preview) return;
  const confirmed = window.confirm('Terapkan hasil preview ke spreadsheet? Perubahan akan dicatat di Audit Log.');
  if (!confirmed) return;

  const button = host.querySelector('[data-generate-apply]');
  const original = button?.textContent;
  if (button) { button.disabled = true; button.textContent = 'Menerapkan...'; }

  try {
    const payload = {
      ...collectGeneratePayload(),
      planHash: generateState.preview.planHash
    };
    const result = await callApi('appA.schedule.generate.apply', payload, { deduplicate: false, timeoutMs: 60000 });
    toast.success(result.message || 'Generate jadwal berhasil.');
    Object.keys(localStorage).filter((key) => key.includes('schedule.') || key.includes('dashboard.')).forEach((key) => localStorage.removeItem(key));
    await loadGenerateOptions(true, payload.sheetName);
  } catch (error) {
    toast.error(error.message);
  } finally {
    if (button) { button.disabled = false; button.textContent = original; }
  }
}
`;

  source = source.replace(anchor, block + '\n\n' + anchor);
}

source = source.replace(
  "if (page === 'admin-jadwal') return loadConfiguration(force, revision, page);",
  "if (page === 'admin-jadwal') return loadConfiguration(force, revision, page);\n  if (page === 'admin-generate') return loadGenerateOptions(force);"
);

fs.writeFileSync(indexPath, source);

if (fs.existsSync(entriesPath)) {
  let entries = fs.readFileSync(entriesPath, 'utf8');
  entries = entries
    .replaceAll('Portal v0.5.10 | Design by Fredi', 'Portal v0.6.0 | Design by Fredi')
    .replaceAll('Portal v0.5.9 | Design by Fredi', 'Portal v0.6.0 | Design by Fredi');
  fs.writeFileSync(entriesPath, entries);
}

console.log('v0.6.0 generate schedule frontend applied.');
