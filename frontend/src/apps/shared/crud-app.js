import { defineApp } from '../../sdk/portal-sdk.js';
import { permissionEngine } from '../../core/permission.js';
import { toast } from '../../core/toast.js';
import { dataClient } from './data-client.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('id-ID');
}

export function createCrudApp({ id, title, dataset }) {
  let root = null;
  let lifecycle = null;
  let session = null;
  let state = { page: 1, pageSize: 20, query: '', status: '', includeDeleted: false, records: [], pagination: null, loading: false };
  let searchTimer = null;

  const can = (permission) => permissionEngine.can(session, `${id}.${permission}`);

  function renderShell(context) {
    root.innerHTML = `
      <section class="space-y-4">
        <article class="app-card">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-blue-600">${escapeHtml(title)}</p>
              <h2 class="mt-1 text-2xl font-bold text-slate-900">Data ${escapeHtml(title)}</h2>
              <p class="mt-1 text-sm text-slate-600">Pencarian, tambah, edit, hapus, dan pemulihan data tanpa reload halaman.</p>
            </div>
            <div class="flex flex-wrap gap-2">
              ${can('data.create') ? '<button data-create class="app-button-primary">Tambah Data</button>' : ''}
              ${context.mode === 'portal' ? '<button data-back class="app-button-secondary">Dashboard</button>' : ''}
            </div>
          </div>

          <div class="mt-4 grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <input data-search class="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" placeholder="Cari judul atau deskripsi..." autocomplete="off">
            <select data-status class="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm">
              <option value="">Semua status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Tidak aktif</option>
              <option value="DRAFT">Draft</option>
            </select>
            <label class="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm ${can('data.delete') ? '' : 'hidden'}">
              <input data-deleted type="checkbox"> Tampilkan terhapus
            </label>
          </div>
        </article>

        <article class="app-card overflow-hidden p-0">
          <div data-list class="min-h-48"></div>
          <div data-pagination class="border-t border-slate-200 p-3"></div>
        </article>

        <div data-form-modal class="fixed inset-0 z-[120] hidden items-center justify-center bg-slate-950/40 p-4">
          <form data-form class="w-full max-w-xl rounded-2xl bg-white p-5 shadow-xl">
            <div class="flex items-center justify-between gap-3">
              <h3 data-form-title class="text-lg font-bold">Tambah Data</h3>
              <button data-close type="button" class="app-button-secondary min-h-9 px-3">Tutup</button>
            </div>
            <input data-record-id type="hidden"><input data-row-version type="hidden">
            <label class="mt-4 block text-sm font-semibold">Judul
              <input data-title required maxlength="200" class="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 font-normal">
            </label>
            <label class="mt-3 block text-sm font-semibold">Deskripsi
              <textarea data-description maxlength="5000" rows="5" class="mt-1 w-full rounded-xl border border-slate-300 p-3 font-normal"></textarea>
            </label>
            <label class="mt-3 block text-sm font-semibold">Status
              <select data-form-status class="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal">
                <option value="ACTIVE">Aktif</option><option value="INACTIVE">Tidak aktif</option><option value="DRAFT">Draft</option>
              </select>
            </label>
            <div class="mt-5 flex justify-end gap-2">
              <button data-cancel type="button" class="app-button-secondary">Batal</button>
              <button data-save type="submit" class="app-button-primary">Simpan</button>
            </div>
          </form>
        </div>
      </section>`;
  }

  function renderList() {
    const target = root?.querySelector('[data-list]');
    if (!target) return;
    if (state.loading) {
      target.innerHTML = '<div class="p-6 text-center text-sm text-slate-500">Memuat data...</div>';
      return;
    }
    if (!state.records.length) {
      target.innerHTML = '<div class="p-8 text-center"><p class="font-semibold text-slate-700">Belum ada data</p><p class="mt-1 text-sm text-slate-500">Gunakan tombol Tambah Data untuk membuat data pertama.</p></div>';
      return;
    }
    target.innerHTML = `<div class="divide-y divide-slate-200">${state.records.map((record) => `
      <div class="p-4 ${record.deletedAt ? 'bg-slate-50 opacity-70' : ''}">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-bold text-slate-900">${escapeHtml(record.title)}</h3>
              <span class="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold">${escapeHtml(record.status)}</span>
              ${record.deletedAt ? '<span class="rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">Terhapus</span>' : ''}
            </div>
            <p class="mt-1 whitespace-pre-wrap text-sm text-slate-600">${escapeHtml(record.description || '-')}</p>
            <p class="mt-2 text-xs text-slate-400">Diperbarui ${escapeHtml(formatDate(record.updatedAt))} · v${escapeHtml(record.rowVersion)}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            ${!record.deletedAt && can('data.edit') ? `<button data-edit="${escapeHtml(record.recordId)}" class="app-button-secondary min-h-9 px-3">Edit</button>` : ''}
            ${!record.deletedAt && can('data.delete') ? `<button data-delete="${escapeHtml(record.recordId)}" class="app-button-secondary min-h-9 px-3 text-red-700">Hapus</button>` : ''}
            ${record.deletedAt && can('data.delete') ? `<button data-restore="${escapeHtml(record.recordId)}" class="app-button-secondary min-h-9 px-3">Pulihkan</button>` : ''}
          </div>
        </div>
      </div>`).join('')}</div>`;
  }

  function renderPagination() {
    const target = root?.querySelector('[data-pagination]');
    const page = state.pagination?.page || 1;
    const totalPages = state.pagination?.totalPages || 1;
    const total = state.pagination?.total || 0;
    target.innerHTML = `<div class="flex items-center justify-between gap-3 text-sm">
      <span class="text-slate-500">${total} data · Halaman ${page}/${totalPages}</span>
      <div class="flex gap-2"><button data-prev class="app-button-secondary min-h-9 px-3" ${page <= 1 ? 'disabled' : ''}>Sebelumnya</button><button data-next class="app-button-secondary min-h-9 px-3" ${page >= totalPages ? 'disabled' : ''}>Berikutnya</button></div>
    </div>`;
  }

  async function load() {
    state.loading = true; renderList();
    try {
      const result = await dataClient.list(dataset, state);
      state.records = result.data?.records || [];
      state.pagination = result.data?.pagination || null;
    } catch (error) {
      state.records = [];
      toast.error(error.message || 'Data gagal dimuat.');
    } finally {
      state.loading = false; renderList(); renderPagination();
    }
  }

  function recordById(recordId) {
    return state.records.find((item) => item.recordId === recordId);
  }

  function openForm(record = null) {
    const modal = root.querySelector('[data-form-modal]');
    root.querySelector('[data-form-title]').textContent = record ? 'Edit Data' : 'Tambah Data';
    root.querySelector('[data-record-id]').value = record?.recordId || '';
    root.querySelector('[data-row-version]').value = record?.rowVersion || '';
    root.querySelector('[data-title]').value = record?.title || '';
    root.querySelector('[data-description]').value = record?.description || '';
    root.querySelector('[data-form-status]').value = record?.status || 'ACTIVE';
    modal.classList.remove('hidden'); modal.classList.add('flex');
    root.querySelector('[data-title]').focus();
  }

  function closeForm() {
    const modal = root?.querySelector('[data-form-modal]');
    modal?.classList.add('hidden'); modal?.classList.remove('flex');
  }

  async function submitForm(event) {
    event.preventDefault();
    const save = root.querySelector('[data-save]');
    const recordId = root.querySelector('[data-record-id]').value;
    const rowVersion = Number(root.querySelector('[data-row-version]').value || 0);
    const values = {
      TITLE: root.querySelector('[data-title]').value.trim(),
      DESCRIPTION: root.querySelector('[data-description]').value.trim(),
      STATUS: root.querySelector('[data-form-status]').value
    };
    save.disabled = true; save.textContent = 'Menyimpan...';
    try {
      if (recordId) await dataClient.update(dataset, recordId, rowVersion, values);
      else await dataClient.create(dataset, values);
      closeForm(); toast.success(recordId ? 'Data diperbarui.' : 'Data disimpan.'); await load();
    } catch (error) {
      toast.error(error.code === 'VERSION_CONFLICT' ? 'Data berubah di server. Muat ulang lalu coba lagi.' : error.message);
      if (error.code === 'VERSION_CONFLICT') await load();
    } finally {
      save.disabled = false; save.textContent = 'Simpan';
    }
  }

  async function removeRecord(record) {
    if (!confirm(`Hapus "${record.title}"? Data masih dapat dipulihkan.`)) return;
    try { await dataClient.remove(dataset, record.recordId, Number(record.rowVersion)); toast.success('Data dihapus.'); await load(); }
    catch (error) { toast.error(error.message); if (error.code === 'VERSION_CONFLICT') await load(); }
  }

  async function restoreRecord(record) {
    try { await dataClient.restore(dataset, record.recordId, Number(record.rowVersion)); toast.success('Data dipulihkan.'); await load(); }
    catch (error) { toast.error(error.message); if (error.code === 'VERSION_CONFLICT') await load(); }
  }

  return defineApp({
    id,
    async mount(container, context = {}) {
      root = container; lifecycle = context.lifecycle; session = context.session;
      state = { page: 1, pageSize: 20, query: '', status: '', includeDeleted: false, records: [], pagination: null, loading: false };
      renderShell(context);
      lifecycle?.listen(root, 'click', (event) => {
        const editId = event.target.closest('[data-edit]')?.dataset.edit;
        const deleteId = event.target.closest('[data-delete]')?.dataset.delete;
        const restoreId = event.target.closest('[data-restore]')?.dataset.restore;
        if (event.target.closest('[data-create]')) openForm();
        if (event.target.closest('[data-close], [data-cancel]')) closeForm();
        if (event.target.closest('[data-back]')) context.navigate?.('dashboard', { historyMode: 'push' });
        if (editId) openForm(recordById(editId));
        if (deleteId) removeRecord(recordById(deleteId));
        if (restoreId) restoreRecord(recordById(restoreId));
        if (event.target.closest('[data-prev]') && state.page > 1) { state.page -= 1; load(); }
        if (event.target.closest('[data-next]') && state.page < (state.pagination?.totalPages || 1)) { state.page += 1; load(); }
      });
      lifecycle?.listen(root.querySelector('[data-form]'), 'submit', submitForm);
      lifecycle?.listen(root.querySelector('[data-search]'), 'input', (event) => {
        clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.query = event.target.value.trim(); state.page = 1; load(); }, 300);
      });
      lifecycle?.listen(root.querySelector('[data-status]'), 'change', (event) => { state.status = event.target.value; state.page = 1; load(); });
      const deleted = root.querySelector('[data-deleted]');
      if (deleted) lifecycle?.listen(deleted, 'change', (event) => { state.includeDeleted = event.target.checked; state.page = 1; load(); });
      lifecycle?.addCleanup(() => { clearTimeout(searchTimer); root = null; lifecycle = null; session = null; });
      await load();
    },
    async refresh() { if (root) await load(); },
    async unmount() { if (root) root.innerHTML = ''; root = null; }
  });
}
