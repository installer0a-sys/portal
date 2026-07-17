const groups = [
  ['User Activity', 'Buka app, lihat, tambah, edit, simpan, hapus, dan restore.'],
  ['Authentication', 'Login, logout, gagal login, session expired, dan revoke.'],
  ['Application', 'Aktivitas dan request yang dikelompokkan per aplikasi.'],
  ['Audit', 'Perubahan user, role, registry, config, dan setting.'],
  ['Errors', 'Error frontend dan backend beserta request ID.'],
  ['System', 'Migration, cache, cleanup, deployment, dan health.'],
  ['Developer Diagnostics', 'Data teknis Core Test yang dipindahkan ke area admin.']
];
export async function mount(container) {
  container.innerHTML = `<section class="space-y-4"><div class="app-card"><h4 class="font-bold text-slate-900">Log Center</h4><p class="mt-1 text-sm text-slate-500">Shell kategori sudah disiapkan. API log terfilter dan pagination server-side akan dibuat pada fase berikutnya.</p></div><div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">${groups.map(([title, desc]) => `<article class="app-card"><h5 class="font-bold text-slate-900">${title}</h5><p class="mt-2 text-sm leading-5 text-slate-500">${desc}</p></article>`).join('')}</div></section>`;
}
