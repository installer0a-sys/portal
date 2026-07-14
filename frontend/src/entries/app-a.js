import '../styles/app.css';
import { callApi } from '../core/api.js';
import { registerPwa } from '../core/pwa.js';

document.querySelector('#app').innerHTML = `
  <main class="mx-auto flex min-h-screen max-w-xl items-center p-4">
    <section class="app-card w-full">
      <p class="text-sm font-semibold text-brand-600">Direct App Launch</p>
      <h1 class="mt-1 text-2xl font-bold">App A</h1>
      <p class="mt-2 text-sm leading-6 text-slate-600">Entry ini berdiri sendiri dan tidak memuat Dashboard atau sidebar Portal.</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <button id="test" class="app-button-primary">Tes API App A</button>
        <a href="../" class="app-button-secondary">Kembali ke Portal</a>
      </div>
      <pre id="result" class="mt-4 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">Belum diuji.</pre>
    </section>
  </main>`;

document.querySelector('#test').addEventListener('click', async () => {
  const result = document.querySelector('#result');
  result.textContent = 'Menghubungkan...';
  try { result.textContent = JSON.stringify(await callApi('appA.ping'), null, 2); }
  catch (error) { result.textContent = `ERROR: ${error.message}`; }
});
registerPwa();
