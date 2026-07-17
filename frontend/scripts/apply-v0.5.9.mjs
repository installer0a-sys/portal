import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'src/apps/app-a/index.js');
const entriesPath = path.join(root, 'src/entries/portal.js');

let source = fs.readFileSync(indexPath, 'utf8');

source = source.replace(
  "const CACHE_PREFIX = 'portal.appA.v058.';",
  "const CACHE_PREFIX = 'portal.appA.v059.';"
);

const marker = 'v0.5.9 smart validation helpers';
if (!source.includes(marker)) {
  const anchor = "async function saveScheduleEditor() {";
  if (!source.includes(anchor)) {
    throw new Error('v0.5.9 gagal: fungsi saveScheduleEditor tidak ditemukan.');
  }

  const helpers = String.raw`
/* v0.5.9 smart validation helpers */
function applyBulkEditorValue(value, mode = 'all') {
  const modal = document.querySelector('#app-a-editor-modal');
  if (!modal) return;

  const day = modal.querySelector('[data-editor-bulk-day]')?.value || '';
  modal.querySelectorAll('[data-editor-cell]').forEach((select) => {
    if (mode === 'day' && String(select.dataset.columnIndex) !== String(day)) return;
    select.value = value;
    markEditorCell(select);
  });
}

function markEditorCell(select) {
  if (!select) return;
  const changed = String(select.value || '') !== String(select.dataset.original || '');
  select.classList.toggle('border-emerald-500', changed);
  select.classList.toggle('bg-emerald-50', changed);
  select.classList.toggle('border-slate-300', !changed);
  select.classList.toggle('bg-white', !changed);
}

function collectEditorChanges(modal) {
  return [...modal.querySelectorAll('[data-editor-cell]')].map((select) => ({
    rowIndex: Number(select.dataset.rowIndex),
    columnIndex: Number(select.dataset.columnIndex),
    originalValue: String(select.dataset.original || ''),
    value: String(select.value || '')
  })).filter((change) => change.value !== change.originalValue);
}

async function validateEditorChanges(changes) {
  return callApi('appA.schedule.editor.validate', {
    sheetName: editorState?.sheetName,
    view: activePage,
    changes
  }, { deduplicate: false, timeoutMs: 30000 });
}

function renderValidationSummary(data) {
  const summary = data.summary || {};
  const warnings = data.warnings || [];
  const blocked = data.blocked || [];

  return '<div class="space-y-3 text-sm">' +
    '<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">' +
      '<div class="rounded-lg bg-slate-100 p-3"><p class="text-[11px] text-slate-500">Sel</p><p class="font-bold">' + Number(summary.cells || 0) + '</p></div>' +
      '<div class="rounded-lg bg-slate-100 p-3"><p class="text-[11px] text-slate-500">Karyawan</p><p class="font-bold">' + Number(summary.employees || 0) + '</p></div>' +
      '<div class="rounded-lg bg-slate-100 p-3"><p class="text-[11px] text-slate-500">Tanggal</p><p class="font-bold">' + Number((summary.dates || []).length) + '</p></div>' +
      '<div class="rounded-lg bg-slate-100 p-3"><p class="text-[11px] text-slate-500">Zona</p><p class="font-bold">' + Number((summary.zones || []).length) + '</p></div>' +
    '</div>' +
    (warnings.length ? '<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800"><p class="font-semibold">Peringatan</p><ul class="mt-1 list-disc pl-5 text-xs">' + warnings.slice(0, 10).map((item) => '<li>' + escapeHtml(item.message) + '</li>').join('') + '</ul></div>' : '') +
    (blocked.length ? '<div class="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700"><p class="font-semibold">Tidak dapat disimpan</p><ul class="mt-1 list-disc pl-5 text-xs">' + blocked.slice(0, 10).map((item) => '<li>' + escapeHtml(item.message) + '</li>').join('') + '</ul></div>' : '') +
    '<div class="text-xs text-slate-500"><p><b>Tanggal:</b> ' + escapeHtml((summary.dates || []).join(', ') || '-') + '</p><p class="mt-1"><b>Zona:</b> ' + escapeHtml((summary.zones || []).join(', ') || '-') + '</p></div>' +
  '</div>';
}
`;

  source = source.replace(anchor, helpers + '\n\n' + anchor);
}

source = source.replace(
  "modal.querySelector('[data-editor-save]')?.addEventListener('click', saveScheduleEditor);",
  `modal.querySelectorAll('[data-editor-cell]').forEach((select) => select.addEventListener('change', () => markEditorCell(select)));
  modal.querySelector('[data-editor-save]')?.addEventListener('click', saveScheduleEditor);`
);

source = source.replace(
  "'<div class=\"ml-auto flex gap-2\"><button data-editor-cancel class=\"app-button-secondary\">Batal</button><button data-editor-save class=\"app-button-primary\">Simpan Perubahan</button></div>' +",
  `'<div class="ml-auto flex flex-wrap items-center gap-2">' +
      '<select data-editor-bulk-day class="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs">' +
        '<option value="">Semua tanggal</option>' +
        columns.map((column) => '<option value="' + column.index + '">Tanggal ' + escapeHtml(column.day) + '</option>').join('') +
      '</select>' +
      '<button type="button" data-bulk-off class="app-button-secondary">Bulk OFF</button>' +
      '<button type="button" data-bulk-ro class="app-button-secondary">Bulk RO</button>' +
      '<button type="button" data-editor-cancel class="app-button-secondary">Batal</button>' +
      '<button type="button" data-editor-save class="app-button-primary">Simpan Perubahan</button>' +
    '</div>' +`
);

source = source.replace(
  "modal.querySelector('[data-editor-cancel]')?.addEventListener('click', closeScheduleEditor);",
  `modal.querySelector('[data-editor-cancel]')?.addEventListener('click', closeScheduleEditor);
  modal.querySelector('[data-bulk-off]')?.addEventListener('click', () => {
    const mode = modal.querySelector('[data-editor-bulk-day]')?.value ? 'day' : 'all';
    applyBulkEditorValue('OFF', mode);
  });
  modal.querySelector('[data-bulk-ro]')?.addEventListener('click', () => {
    const mode = modal.querySelector('[data-editor-bulk-day]')?.value ? 'day' : 'all';
    applyBulkEditorValue('RO', mode);
  });`
);

const oldSave = /async function saveScheduleEditor\(\) \{[\s\S]*?\n\}\n\nasync function loadScript/;
const newSave = String.raw`async function saveScheduleEditor() {
  const modal = document.querySelector('#app-a-editor-modal');
  const button = modal?.querySelector('[data-editor-save]');
  if (!modal || !editorState || !button) return;

  const changes = collectEditorChanges(modal);
  if (!changes.length) {
    toast.info('Tidak ada perubahan.');
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Memvalidasi...';

  try {
    const validationResult = await validateEditorChanges(changes);
    const validation = validationResult.data || {};

    const confirmModal = document.createElement('div');
    confirmModal.className = 'fixed inset-0 z-[170] grid place-items-center bg-slate-950/50 p-4';
    confirmModal.innerHTML = '<section class="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl">' +
      '<h3 class="text-base font-bold text-slate-900">Konfirmasi Perubahan</h3>' +
      '<div class="mt-4">' + renderValidationSummary(validation) + '</div>' +
      '<div class="mt-5 flex justify-end gap-2"><button data-cancel class="app-button-secondary">Kembali</button><button data-confirm class="app-button-primary" ' + ((validation.blocked || []).length || validation.locked ? 'disabled' : '') + '>Simpan</button></div>' +
    '</section>';
    document.body.appendChild(confirmModal);

    const confirmed = await new Promise((resolve) => {
      confirmModal.querySelector('[data-cancel]')?.addEventListener('click', () => resolve(false), { once: true });
      confirmModal.querySelector('[data-confirm]')?.addEventListener('click', () => resolve(true), { once: true });
    });

    confirmModal.remove();
    if (!confirmed) return;

    button.textContent = 'Menyimpan...';
    const result = await callApi('appA.schedule.editor.save', {
      sheetName: editorState.sheetName,
      view: activePage,
      changes
    }, { deduplicate: false, timeoutMs: 45000 });

    toast.success(result.message || changes.length + ' perubahan berhasil disimpan.');
    closeScheduleEditor();

    Object.keys(localStorage)
      .filter((key) => key.startsWith(CACHE_PREFIX + 'schedule.'))
      .forEach((key) => localStorage.removeItem(key));

    await renderPage({ force: true, keepPage: true });
  } catch (error) {
    toast.error(error.message || 'Penyimpanan gagal.');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function loadScript`;

if (!oldSave.test(source)) {
  throw new Error('v0.5.9 gagal: blok saveScheduleEditor tidak ditemukan.');
}
source = source.replace(oldSave, newSave);

fs.writeFileSync(indexPath, source);

let entries = fs.readFileSync(entriesPath, 'utf8');
entries = entries.replaceAll('Portal v0.5.8 | Design by Fredi', 'Portal v0.5.9 | Design by Fredi');
entries = entries.replaceAll('Portal v0.5.7 | Design by Fredi', 'Portal v0.5.9 | Design by Fredi');
fs.writeFileSync(entriesPath, entries);

console.log('v0.5.9 smart validation applied.');
