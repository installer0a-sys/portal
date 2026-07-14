import '../styles/app.css';
import { CONFIG } from '../core/config.js';
import { callApi } from '../core/api.js';
import { registerPwa } from '../core/pwa.js';
import { toast } from '../core/toast.js';
import { modal } from '../core/modal.js';
import { diagnostics } from '../core/diagnostics.js';

const app = document.querySelector('#app');
document.title = CONFIG.appName;

app.innerHTML = `
  <div class="min-h-screen bg-slate-100">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Portal V3</p>
          <h1 class="text-xl font-bold text-slate-900">${CONFIG.appName}</h1>
        </div>

        <div class="flex items-center gap-2">
          <span id="online-status" class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Online</span>
          <button id="check-update" class="app-button-secondary" type="button">Cek update</button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <section class="grid gap-4 lg:grid-cols-3">
        <article class="app-card lg:col-span-2">
          <p class="text-sm font-semibold text-blue-600">Foundation aktif</p>
          <h2 class="mt-2 text-2xl font-bold text-slate-900">Portal Core V3</h2>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Frontend berjalan dari GitHub Pages, sedangkan data dan proses server berjalan dari Google Apps Script.
          </p>

          <div class="mt-6 flex flex-wrap gap-3">
            <button id="test-api" type="button" class="app-button-primary">Tes koneksi API</button>
            <a href="${CONFIG.basePath}app-a/" class="app-button-secondary">Buka App A langsung</a>
            <button id="open-core-test" type="button" class="app-button-secondary">Buka Core Test</button>
          </div>
        </article>

        <aside class="app-card">
          <h3 class="text-sm font-bold text-slate-900">Build information</h3>
          <dl class="mt-4 space-y-3 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Frontend</dt>
              <dd class="font-semibold text-slate-900">${CONFIG.version}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">Base path</dt>
              <dd class="font-mono text-xs text-slate-700">${CONFIG.basePath}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-slate-500">PWA</dt>
              <dd id="pwa-status" class="font-semibold text-slate-900">Memeriksa</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section class="mt-4 grid gap-4 md:grid-cols-2">
        <article class="app-card">
          <h3 class="text-lg font-bold text-slate-900">API diagnostics</h3>
          <pre id="api-result" class="mt-4 min-h-40 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">Belum diuji.</pre>
        </article>

        <article class="app-card">
          <h3 class="text-lg font-bold text-slate-900">Core status</h3>
          <div class="mt-4 space-y-3">
            <div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span class="text-sm text-slate-600">GitHub Pages</span><strong class="text-sm text-emerald-600">Aktif</strong></div>
            <div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span class="text-sm text-slate-600">Tailwind CSS</span><strong class="text-sm text-emerald-600">Aktif</strong></div>
            <div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span class="text-sm text-slate-600">Vite build</span><strong class="text-sm text-emerald-600">Aktif</strong></div>
            <div class="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span class="text-sm text-slate-600">Apps Script API</span><strong id="api-status" class="text-sm text-slate-500">Belum diuji</strong></div>
          </div>
        </article>
      </section>
    </main>
  </div>
`;

const resultElement = document.querySelector('#api-result');
const statusElement = document.querySelector('#api-status');
const onlineStatusElement = document.querySelector('#online-status');
const pwaStatusElement = document.querySelector('#pwa-status');

function updateOnlineStatus() {
  const online = navigator.onLine;
  onlineStatusElement.textContent = online ? 'Online' : 'Offline';
  onlineStatusElement.className = online
    ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700'
    : 'rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700';
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();

document.querySelector('#test-api').addEventListener('click', async () => {
  resultElement.textContent = 'Menghubungi Apps Script...';
  statusElement.textContent = 'Memeriksa';
  statusElement.className = 'text-sm font-semibold text-amber-600';

  const startedAt = performance.now();

  try {
    const result = await callApi('system.ping');
    const duration = Math.round(performance.now() - startedAt);

    resultElement.textContent = JSON.stringify({ durationMs: duration, response: result }, null, 2);
    statusElement.textContent = `${duration} ms`;
    statusElement.className = 'text-sm font-semibold text-emerald-600';
    toast.success('Koneksi Apps Script berhasil.');
  } catch (error) {
    resultElement.textContent = JSON.stringify({ error: error.message }, null, 2);
    statusElement.textContent = 'Gagal';
    statusElement.className = 'text-sm font-semibold text-red-600';
    toast.error(error.message);
  }
});

document.querySelector('#open-core-test').addEventListener('click', () => {
  modal.open({
    title: 'Core Diagnostics',
    content: `<pre class="max-h-[60vh] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">${JSON.stringify(diagnostics.snapshot(), null, 2)}</pre>`,
    confirmText: 'Tutup'
  });
});

const pwa = await registerPwa();
pwaStatusElement.textContent = pwa.registered
  ? 'Aktif'
  : pwa.supported
    ? 'Gagal registrasi'
    : 'Tidak didukung';

document.querySelector('#check-update').addEventListener('click', async () => {
  if (!pwa.registration) {
    toast.warning('Service worker belum aktif.');
    return;
  }

  await pwa.registration.update();
  toast.info('Pemeriksaan update selesai.');
});
