export function renderLoginView({ title, subtitle, onSubmit }) {
  const app = document.querySelector('#app');
  app.innerHTML = `
    <main class="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section class="app-card w-full max-w-md p-6 sm:p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">Portal V3</p>
        <h1 class="mt-2 text-2xl font-bold text-slate-900">${title}</h1>
        <p class="mt-2 text-sm leading-6 text-slate-600">${subtitle}</p>

        <form id="login-form" class="mt-6 space-y-4" autocomplete="on">
          <label class="block">
            <span class="text-sm font-semibold text-slate-700">Username</span>
            <input id="login-username" name="username" type="text" autocomplete="username" required minlength="3"
              class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
          </label>

          <label class="block">
            <span class="text-sm font-semibold text-slate-700">Password</span>
            <input id="login-password" name="password" type="password" autocomplete="current-password" required minlength="8"
              class="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
          </label>

          <p id="login-error" class="hidden rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"></p>

          <button id="login-submit" type="submit" class="app-button-primary w-full">Masuk</button>
        </form>
      </section>
    </main>`;

  const form = document.querySelector('#login-form');
  const button = document.querySelector('#login-submit');
  const errorBox = document.querySelector('#login-error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.classList.add('hidden');
    button.disabled = true;
    button.textContent = 'Memeriksa...';

    try {
      await onSubmit({
        username: document.querySelector('#login-username').value,
        password: document.querySelector('#login-password').value
      });
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.classList.remove('hidden');
      button.disabled = false;
      button.textContent = 'Masuk';
    }
  });
}
