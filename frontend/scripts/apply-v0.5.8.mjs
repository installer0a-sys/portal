import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const indexPath = path.join(root, 'src/apps/app-a/index.js');
const entriesPath = path.join(root, 'src/entries/portal.js');
const marker = 'v0.5.8 schedule editor';

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) {
    throw new Error(`v0.5.8 gagal: pola ${label} tidak ditemukan.`);
  }
  return source.replace(search, replacement);
}

let source = fs.readFileSync(indexPath, 'utf8');

source = replaceRequired(
  source,
  "const CACHE_PREFIX = 'portal.appA.v056.';",
  "const CACHE_PREFIX = 'portal.appA.v058.';",
  'cache prefix'
);

const editorFunctions = String.raw`
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
`;

if (!source.includes(marker)) {
  const anchor = "async function loadScript(src, globalName) {";
  if (!source.includes(anchor)) throw new Error('v0.5.8 gagal: anchor loadScript tidak ditemukan.');
  source = source.replace(anchor, editorFunctions + '\n\n' + anchor);
}

source = replaceRequired(
  source,
  "host.querySelector('[data-edit-hint]')?.addEventListener('click', () => toast.info(scheduleData?.accessScope?.label ? `Hak edit aktif untuk ${scheduleData.accessScope.label}. Editor detail diterapkan pada fase edit berikutnya.` : 'Hak edit mengikuti role aplikasi.'), { signal });",
  "host.querySelector('[data-edit-hint]')?.addEventListener('click', openScheduleEditor, { signal });",
  'edit handler'
);

source = replaceRequired(
  source,
  "context.lifecycle?.addCleanup(()=>{ viewRevision+=1; abortController?.abort(); host=null; contextRef=null; scheduleData=null; });",
  "context.lifecycle?.addCleanup(()=>{ viewRevision+=1; abortController?.abort(); closeScheduleEditor(); host=null; contextRef=null; scheduleData=null; });",
  'cleanup'
);

fs.writeFileSync(indexPath, source);

let entries = fs.readFileSync(entriesPath, 'utf8');
entries = entries.replaceAll('Portal v0.5.7 | Design by Fredi', 'Portal v0.5.8 | Design by Fredi');
entries = entries.replaceAll('Portal v0.5.6 | Design by Fredi', 'Portal v0.5.8 | Design by Fredi');
fs.writeFileSync(entriesPath, entries);

console.log('v0.5.8 schedule editor applied.');
