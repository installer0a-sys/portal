import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'src/apps/app-a/index.js');
const entriesPath = path.join(root, 'src/entries/portal.js');

if (!fs.existsSync(indexPath)) throw new Error('App A index.js tidak ditemukan.');
let source = fs.readFileSync(indexPath, 'utf8');

source = source
  .replaceAll("portal.appA.v060.", "portal.appA.v061.")
  .replaceAll("portal.appA.v0510.", "portal.appA.v061.");

const oldScheduleTable = /function scheduleTable\(data\) \{[\s\S]*?\n\}\nfunction scheduleRow\(row, count\) \{[\s\S]*?\n\}/;
const newScheduleTable = String.raw`function scheduleTable(data) {
  const head1 = data.head1 || [];
  const head2 = data.head2 || [];
  const meta = data.tableMeta || {};
  const dateStart = Number(meta.dateStart ?? data.dateStart ?? 5);
  const groups = data.groupedRows || {};
  const groupKeys = data.groupKeys || Object.keys(groups);
  const dateHeaders = head1.slice(dateStart);
  const dateSubHeaders = head2.slice(dateStart);

  if (!head1.length) {
    return '<div class="grid min-h-80 place-items-center text-sm text-slate-500">Sheet jadwal belum memiliki data.</div>';
  }

  const fixedHeaders = meta.fixedHeaders || ['NO','NIP','NAMA','DEPARTEMEN'];
  const headerTop = fixedHeaders.map((header, index) =>
    '<th rowspan="2" class="sticky top-0 z-40 border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-center font-extrabold text-slate-700 ' +
    (index < 4 ? 'a542-stick-head a542-col-' + (index + 1) : '') + '">' + escapeHtml(header) + '</th>'
  ).join('') + dateHeaders.map((header) =>
    '<th class="sticky top-0 z-30 min-w-[38px] border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-center font-extrabold text-slate-700">' +
    escapeHtml(header) + '</th>'
  ).join('');

  const headerBottom = dateSubHeaders.map((header) =>
    '<th class="sticky top-[33px] z-30 border-b border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-center font-bold text-slate-500">' +
    escapeHtml(header) + '</th>'
  ).join('');

  let grandDop = new Array(dateHeaders.length).fill(0);
  let grandDos = new Array(dateHeaders.length).fill(0);
  let rowNumber = 1;

  const body = groupKeys.map((groupKey) => {
    const rows = groups[groupKey] || [];
    const colspan = fixedHeaders.length + dateHeaders.length;
    const groupHeader = '<tr class="a542-zone"><td colspan="' + colspan +
      '" class="border-b border-slate-200 bg-emerald-100 px-3 py-2 font-extrabold text-emerald-900">' +
      escapeHtml(groupKey) + '</td></tr>';

    const groupRows = rows.map((item) => {
      const values = item.raw || [];
      const fixed = [
        rowNumber++,
        item.nip,
        item.name,
        item.department
      ];

      if (meta.showSisaRo) fixed.push(item.sisaRo || '-');

      if (meta.type === 'DOP_DOS') {
        let dop = 0;
        let dos = 0;
        dateHeaders.forEach((_, offset) => {
          const raw = String(values[dateStart + offset] || '').toUpperCase();
          if (raw.includes('|DOP')) {
            dop += 1;
            grandDop[offset] += 1;
          }
          if (raw.includes('|DOS')) {
            dos += 1;
            grandDos[offset] += 1;
          }
        });
        fixed.push(dop, dos);
      }

      const fixedCells = fixed.map((value, index) =>
        '<td class="border-b border-r border-slate-200 bg-white px-2 py-2 text-center text-slate-700 ' +
        (index < 4 ? 'a542-stick a542-col-' + (index + 1) : '') + '">' + escapeHtml(value) + '</td>'
      ).join('');

      const dateCells = dateHeaders.map((_, offset) =>
        '<td class="border-b border-r border-slate-200 bg-white px-2 py-2 text-center text-slate-700">' +
        escapeHtml(values[dateStart + offset] || '') + '</td>'
      ).join('');

      return '<tr>' + fixedCells + dateCells + '</tr>';
    }).join('');

    return groupHeader + groupRows;
  }).join('');

  let summary = '';
  if (meta.showDopDosTotals && dateHeaders.length) {
    const span = fixedHeaders.length + dateHeaders.length;
    summary += '<tr><td colspan="' + span + '" class="bg-slate-200 px-3 py-2 font-extrabold">TOTAL HARIAN DOP & DOS</td></tr>';
    summary += '<tr>' +
      '<td colspan="4" class="border-b border-r bg-emerald-50 px-2 py-2 text-right font-bold text-emerald-700">TOTAL</td>' +
      '<td colspan="2" class="border-b border-r bg-emerald-100 px-2 py-2 text-center font-bold text-emerald-700">DOP</td>' +
      grandDop.map((value) => '<td class="border-b border-r bg-emerald-50 px-2 py-2 text-center font-bold">' + value + '</td>').join('') +
      '</tr>';
    summary += '<tr>' +
      '<td colspan="4" class="border-b border-r bg-red-50 px-2 py-2 text-right font-bold text-red-700">TOTAL</td>' +
      '<td colspan="2" class="border-b border-r bg-red-100 px-2 py-2 text-center font-bold text-red-700">DOS</td>' +
      grandDos.map((value) => '<td class="border-b border-r bg-red-50 px-2 py-2 text-center font-bold">' + value + '</td>').join('') +
      '</tr>';
  }

  return '<div id="jadwal-a542-capture" class="overflow-auto bg-white" style="max-height:calc(100vh - 285px)">' +
    '<table class="min-w-max border-separate border-spacing-0 text-[10px]"><thead><tr>' +
    headerTop + '</tr><tr>' + headerBottom + '</tr></thead><tbody>' +
    body + summary + '</tbody></table></div>';
}`;

if (!oldScheduleTable.test(source)) {
  throw new Error('Blok scheduleTable lama tidak ditemukan.');
}
source = source.replace(oldScheduleTable, newScheduleTable);

const oldConfig = /function renderConfiguration\(data\)\{[\s\S]*?\n\}/;
const newConfig = String.raw`function renderConfiguration(data){
  const cfg = data.config || {};
  const sheets = data.sheets || [];
  const headers = data.headers || {};

  const sheetOptionsFor = (selected) =>
    '<option value="">-- Pilih Sheet --</option>' +
    sheets.map((name) => '<option value="' + escapeHtml(name) + '" ' +
      (String(selected || '') === String(name) ? 'selected' : '') + '>' +
      escapeHtml(name) + '</option>').join('');

  const headerOptionsFor = (sheetName, selected) =>
    '<option value="">-- Pilih Header --</option>' +
    (headers[sheetName] || []).map((name) => '<option value="' + escapeHtml(name) + '" ' +
      (String(selected || '').toUpperCase() === String(name).toUpperCase() ? 'selected' : '') + '>' +
      escapeHtml(name) + '</option>').join('');

  const multiRoles = (sheetName, headerName, selected, cls) => {
    const roleValues = String(selected || '').split(',').map((v) => v.trim()).filter(Boolean);
    return '<div data-role-container="' + cls + '" class="flex flex-wrap gap-2 text-xs">' +
      roleValues.map((role) => '<label class="rounded-lg border border-slate-200 px-2 py-1.5">' +
        '<input type="checkbox" class="' + cls + '" value="' + escapeHtml(role) + '" checked> ' +
        escapeHtml(role) + '</label>').join('') +
      '<span class="text-slate-400">Simpan untuk mempertahankan role yang sudah dipilih. Muat role baru melalui header sumber.</span></div>';
  };

  host.innerHTML = '<section class="space-y-4">' +
    '<div><h2 class="text-xl font-bold text-slate-900">Pengaturan Jadwal</h2>' +
    '<p class="mt-1 text-sm text-slate-500">Jadwal All, SPV, dan DOP DOS memakai satu sheet jadwal utama. Sheet SPV/DOP di bawah adalah sumber filter karyawan dan jabatan.</p></div>' +

    '<article class="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">' +
      '<div class="grid gap-4 md:grid-cols-2">' +
        '<label><span class="mb-1 block text-xs font-semibold text-slate-600">Sheet Jadwal Utama</span>' +
          '<select data-config-key="CONF_JADWAL_SHEET" class="w-full rounded-xl border px-3 py-2">' +
          sheetOptionsFor(cfg.CONF_JADWAL_SHEET) + '</select></label>' +
        '<label><span class="mb-1 block text-xs font-semibold text-slate-600">Refresh Jadwal</span>' +
          '<input data-config-key="CONF_JADWAL_REFRESH" value="' + escapeHtml(cfg.CONF_JADWAL_REFRESH || '0') + '" class="w-full rounded-xl border px-3 py-2"></label>' +
      '</div>' +

      '<div class="border-t pt-4"><h3 class="mb-3 text-sm font-bold">Roster</h3><div class="grid gap-4 md:grid-cols-2">' +
        '<label><span class="mb-1 block text-xs font-semibold">Sheet Roster</span><select data-config-key="CONF_ROSTER_SHEET" data-header-source="roster" class="w-full rounded-xl border px-3 py-2">' +
          sheetOptionsFor(cfg.CONF_ROSTER_SHEET) + '</select></label>' +
        '<label><span class="mb-1 block text-xs font-semibold">Header Dropdown</span><select data-config-key="CONF_ROSTER_DROP" data-header-target="roster" class="w-full rounded-xl border px-3 py-2">' +
          headerOptionsFor(cfg.CONF_ROSTER_SHEET, cfg.CONF_ROSTER_DROP) + '</select></label>' +
        '<label><span class="mb-1 block text-xs font-semibold">Header Display</span><select data-config-key="CONF_ROSTER_DISP" data-header-target="roster" class="w-full rounded-xl border px-3 py-2">' +
          headerOptionsFor(cfg.CONF_ROSTER_SHEET, cfg.CONF_ROSTER_DISP) + '</select></label>' +
        '<label><span class="mb-1 block text-xs font-semibold">Header Code</span><select data-config-key="CONF_ROSTER_CODE" data-header-target="roster" class="w-full rounded-xl border px-3 py-2">' +
          headerOptionsFor(cfg.CONF_ROSTER_SHEET, cfg.CONF_ROSTER_CODE) + '</select></label>' +
        '<label><span class="mb-1 block text-xs font-semibold">Header Total</span><select data-config-key="CONF_ROSTER_TOTAL" data-header-target="roster" class="w-full rounded-xl border px-3 py-2">' +
          headerOptionsFor(cfg.CONF_ROSTER_SHEET, cfg.CONF_ROSTER_TOTAL) + '</select></label>' +
      '</div></div>' +

      '<div class="border-t pt-4"><h3 class="mb-2 text-sm font-bold">Filter Jadwal SPV</h3>' +
        '<p class="mb-3 text-xs text-slate-500">Bukan sheet jadwal terpisah. Digunakan untuk memilih sumber header jabatan dan role yang tampil pada view SPV.</p>' +
        '<div class="grid gap-4 md:grid-cols-2">' +
          '<label><span class="mb-1 block text-xs font-semibold">Sheet Sumber Karyawan SPV</span><select data-config-key="CONF_SPV_SHEET" data-header-source="spv" class="w-full rounded-xl border px-3 py-2">' +
            sheetOptionsFor(cfg.CONF_SPV_SHEET) + '</select></label>' +
          '<label><span class="mb-1 block text-xs font-semibold">Header Filter SPV</span><select data-config-key="CONF_SPV_HEADER" data-header-target="spv" class="w-full rounded-xl border px-3 py-2">' +
            headerOptionsFor(cfg.CONF_SPV_SHEET, cfg.CONF_SPV_HEADER) + '</select></label>' +
        '</div><div class="mt-3">' + multiRoles(cfg.CONF_SPV_SHEET, cfg.CONF_SPV_HEADER, cfg.CONF_SPV_ROLES, 'spv-role-cb') + '</div></div>' +

      '<div class="border-t pt-4"><h3 class="mb-2 text-sm font-bold">Filter DOP DOS</h3>' +
        '<p class="mb-3 text-xs text-slate-500">Tetap memakai sheet jadwal utama; konfigurasi ini hanya menentukan karyawan/posisi yang ditampilkan.</p>' +
        '<div class="grid gap-4 md:grid-cols-2">' +
          '<label><span class="mb-1 block text-xs font-semibold">Sheet Sumber Karyawan DOP DOS</span><select data-config-key="CONF_DOP_SHEET" data-header-source="dop" class="w-full rounded-xl border px-3 py-2">' +
            sheetOptionsFor(cfg.CONF_DOP_SHEET) + '</select></label>' +
          '<label><span class="mb-1 block text-xs font-semibold">Header Filter DOP DOS</span><select data-config-key="CONF_DOP_HEADER" data-header-target="dop" class="w-full rounded-xl border px-3 py-2">' +
            headerOptionsFor(cfg.CONF_DOP_SHEET, cfg.CONF_DOP_HEADER) + '</select></label>' +
        '</div><div class="mt-3">' + multiRoles(cfg.CONF_DOP_SHEET, cfg.CONF_DOP_HEADER, cfg.CONF_DOP_ROLES, 'dop-role-cb') + '</div></div>' +

      '<div class="border-t pt-4"><h3 class="mb-3 text-sm font-bold">Kunci Edit</h3><div class="grid gap-4 md:grid-cols-2">' +
        '<label><span class="mb-1 block text-xs font-semibold">Lock Jadwal All</span><select data-config-key="CONF_EDIT_ALL_LOCK" class="w-full rounded-xl border px-3 py-2"><option>Buka</option><option ' + (String(cfg.CONF_EDIT_ALL_LOCK).toUpperCase() !== 'BUKA' ? 'selected' : '') + '>Kunci</option></select></label>' +
        '<label><span class="mb-1 block text-xs font-semibold">Lock Jadwal SPV</span><select data-config-key="CONF_EDIT_SPV_LOCK" class="w-full rounded-xl border px-3 py-2"><option>Buka</option><option ' + (String(cfg.CONF_EDIT_SPV_LOCK).toUpperCase() !== 'BUKA' ? 'selected' : '') + '>Kunci</option></select></label>' +
        '<label><span class="mb-1 block text-xs font-semibold">Judul Lock All</span><input data-config-key="CONF_EDIT_ALL_LOCK_TITLE" value="' + escapeHtml(cfg.CONF_EDIT_ALL_LOCK_TITLE || '') + '" class="w-full rounded-xl border px-3 py-2"></label>' +
        '<label><span class="mb-1 block text-xs font-semibold">Judul Lock SPV</span><input data-config-key="CONF_EDIT_SPV_LOCK_TITLE" value="' + escapeHtml(cfg.CONF_EDIT_SPV_LOCK_TITLE || '') + '" class="w-full rounded-xl border px-3 py-2"></label>' +
        '<label><span class="mb-1 block text-xs font-semibold">Isi Lock All</span><textarea data-config-key="CONF_EDIT_ALL_LOCK_BODY" class="w-full rounded-xl border px-3 py-2">' + escapeHtml(cfg.CONF_EDIT_ALL_LOCK_BODY || '') + '</textarea></label>' +
        '<label><span class="mb-1 block text-xs font-semibold">Isi Lock SPV</span><textarea data-config-key="CONF_EDIT_SPV_LOCK_BODY" class="w-full rounded-xl border px-3 py-2">' + escapeHtml(cfg.CONF_EDIT_SPV_LOCK_BODY || '') + '</textarea></label>' +
      '</div></div>' +

      '<div class="flex justify-end gap-2 border-t pt-4"><button data-refresh class="app-button-secondary">Refresh</button><button data-save class="app-button-primary">Simpan</button></div>' +
    '</article></section>';

  const rebuildHeaders = (key) => {
    const sourceEl = host.querySelector('[data-header-source="' + key + '"]');
    const sheetName = sourceEl?.value || '';
    host.querySelectorAll('[data-header-target="' + key + '"]').forEach((target) => {
      const current = target.value;
      target.innerHTML = headerOptionsFor(sheetName, current);
    });
  };

  host.querySelectorAll('[data-header-source]').forEach((el) => {
    el.addEventListener('change', () => rebuildHeaders(el.dataset.headerSource));
  });

  host.querySelector('[data-refresh]')?.addEventListener('click',()=>loadConfiguration(true));
  host.querySelector('[data-save]')?.addEventListener('click',saveConfiguration);
}`;

if (!oldConfig.test(source)) {
  throw new Error('renderConfiguration lama tidak ditemukan.');
}
source = source.replace(oldConfig, newConfig);

source = source.replace(
  "async function saveConfiguration(){ const config={}; host.querySelectorAll('[data-config-key]').forEach((el)=>{config[el.dataset.configKey]=el.value;});",
  "async function saveConfiguration(){ const config={}; host.querySelectorAll('[data-config-key]').forEach((el)=>{config[el.dataset.configKey]=el.value;}); config.CONF_SPV_ROLES=[...host.querySelectorAll('.spv-role-cb:checked')].map((el)=>el.value).join(','); config.CONF_DOP_ROLES=[...host.querySelectorAll('.dop-role-cb:checked')].map((el)=>el.value).join(',');"
);

fs.writeFileSync(indexPath, source);

if (fs.existsSync(entriesPath)) {
  let entries = fs.readFileSync(entriesPath, 'utf8');
  entries = entries
    .replaceAll('Portal v0.6.0 | Design by Fredi', 'Portal v0.6.1 | Design by Fredi')
    .replaceAll('Portal v0.5.10 | Design by Fredi', 'Portal v0.6.1 | Design by Fredi');
  fs.writeFileSync(entriesPath, entries);
}

console.log('v0.6.1 position and view parity applied.');
