export async function mount(container) {
  container.innerHTML = `
    <section class="grid gap-4 lg:grid-cols-3">
      <article class="app-card lg:col-span-2"><div class="flex items-center justify-between"><div><h4 class="font-bold text-slate-900">Management User</h4><p class="mt-1 text-sm text-slate-500">Daftar user, portal role, status, reset password, dan revoke session akan tersedia pada fase 4.9.</p></div><span class="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">Next phase</span></div></article>
      <article class="app-card"><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Role utama</p><p class="mt-2 text-lg font-bold text-slate-900">Portal Role</p><p class="mt-1 text-sm text-slate-500">Akses Settings tidak menggunakan role App A–E.</p></article>
    </section>`;
}
