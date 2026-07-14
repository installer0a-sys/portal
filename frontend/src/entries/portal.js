import '../styles/app.css';
import { CONFIG } from '../core/config.js';
import { callApi } from '../core/api.js';
import { registerPwa } from '../core/pwa.js';

const app = document.querySelector('#app');

app.innerHTML = `
  <div class="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
    <aside id="sidebar" class="fixed inset-y-0 left-0 z-40 w-72 -translate-x-full border-r border-slate-200 bg-white p-4 transition-transform lg:static lg:w-auto lg:translate-x-0">
      <div class="mb-6 flex items-center justify-between">
        <div><p class="text-xs font-semibold uppercase tracking-wider text-brand-600">Portal V3</p><h1 class="font-bold">AZKO Kudus</h1></div>
        <button id="close-sidebar" class="app-button-secondary px-3 lg:hidden" aria-label="Tutup menu">×</button>
      </div>
      <nav class="space-y-2">
        <button class="app-button-primary w-full justify-start">Dashboard</button>
        <button class="app-button-secondary w-full justify-start" disabled>App A — fase berikutnya</button>
      </nav>
    </aside>
    <div>
      <header class="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
        <button id="open-sidebar" class="app-button-secondary px-3 lg:hidden" aria-label="Buka menu">☰</button>
        <div class="min-w-0 flex-1"><p class="truncate font-semibold">${CONFIG.appName}</p><p class="text-xs text-slate-500">Fondasi ringan dan responsif</p></div>
        <span id="network" class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Online</span>
      </header>
      <main class="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <section class="app-card">
          <p class="text-sm font-semibold text-brand-600">Fase 1</p>
          <h2 class="mt-1 text-2xl font-bold">Fondasi Portal berhasil dimuat</h2>
          <p class="mt-2 text-sm leading-6 text-slate-600">Frontend ini tidak memuat kode aplikasi lain. Login, role, dan App A akan ditambahkan setelah koneksi produksi lulus pengujian.</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button id="test-api" class="app-button-primary">Tes koneksi Apps Script</button>
            <a href="./app-a/" class="app-button-secondary">Tes entry App A</a>
          </div>
          <pre id="result" class="mt-4 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">Belum diuji.</pre>
        </section>
        <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article class="app-card"><p class="text-sm text-slate-500">Frontend</p><p class="mt-1 font-bold">Vite + Tailwind CSS</p></article>
          <article class="app-card"><p class="text-sm text-slate-500">PWA</p><p class="mt-1 font-bold">Portal + App tunggal</p></article>
          <article class="app-card"><p class="text-sm text-slate-500">Versi</p><p class="mt-1 font-bold">${CONFIG.version}</p></article>
        </section>
      </main>
    </div>
  </div>`;

const sidebar = document.querySelector('#sidebar');
document.querySelector('#open-sidebar').addEventListener('click', () => sidebar.classList.remove('-translate-x-full'));
document.querySelector('#close-sidebar').addEventListener('click', () => sidebar.classList.add('-translate-x-full'));
document.querySelector('#test-api').addEventListener('click', async () => {
  const result = document.querySelector('#result');
  result.textContent = 'Menghubungkan...';
  try { result.textContent = JSON.stringify(await callApi('system.ping'), null, 2); }
  catch (error) { result.textContent = `ERROR: ${error.message}`; }
});

function updateNetwork() {
  const el = document.querySelector('#network');
  const online = navigator.onLine;
  el.textContent = online ? 'Online' : 'Offline';
  el.className = online
    ? 'rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700'
    : 'rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700';
}
window.addEventListener('online', updateNetwork);
window.addEventListener('offline', updateNetwork);
updateNetwork();
registerPwa();
