import { CONFIG } from '../../core/config.js';
import { diagnostics } from '../../core/diagnostics.js';
export async function mount(container) {
  const data = diagnostics.snapshot();
  container.innerHTML = `<section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><article class="app-card"><p class="text-xs font-semibold uppercase text-slate-500">Frontend</p><p class="mt-2 text-xl font-bold">v${CONFIG.version}</p></article><article class="app-card"><p class="text-xs font-semibold uppercase text-slate-500">Route</p><p class="mt-2 truncate font-bold">${data.route || '-'}</p></article><article class="app-card"><p class="text-xs font-semibold uppercase text-slate-500">Network</p><p class="mt-2 font-bold">${data.networkOnline ? 'Online' : 'Offline'}</p></article><article class="app-card"><p class="text-xs font-semibold uppercase text-slate-500">Pending request</p><p class="mt-2 text-xl font-bold">${data.pendingRequests || 0}</p></article></section>`;
}
