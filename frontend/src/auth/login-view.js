import { login } from './auth.js';
import { logger } from '../core/logger.js';

export function renderLoginView(container, options = {}) {
  if (!container) {
    throw new Error('Container halaman login tidak ditemukan.');
  }

  const title =
    options.title ||
    options.appName ||
    'Masuk ke Portal';

  const subtitle =
    options.subtitle ||
    options.description ||
    'Gunakan username dan password Anda.';

  const submitText =
    options.submitText ||
    'Masuk';

  const onSuccess =
    options.onSuccess ||
    options.onAuthenticated ||
    options.onLoginSuccess ||
    null;

  container.innerHTML = `
    <div class="portal-login-bg min-h-screen p-5 sm:p-8">
      <div class="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-7xl items-center gap-10 lg:grid-cols-[1.25fr_0.75fr]">
        <section class="hidden lg:block">
          <div class="flex items-center gap-5 text-white">
            <div class="grid h-16 w-16 place-items-center rounded-2xl border border-white/20 bg-white/10 text-2xl font-black backdrop-blur">AZ</div>
            <div class="h-16 w-px bg-white/35"></div>
            <div>
              <p class="text-sm font-medium tracking-[0.28em] text-slate-300">AZKO KUDUS SUDIRMAN</p>
              <h1 class="mt-2 text-5xl font-bold leading-tight">Portal Web<br><span class="font-light">Azko Kudus Sudirman</span></h1>
              <p class="mt-4 max-w-xl text-base leading-7 text-slate-300">Satu pintu untuk mengakses seluruh aplikasi kerja dengan cepat, aman, dan ringan.</p>
            </div>
          </div>
        </section>

        <section class="w-full rounded-[24px] border border-white/10 bg-slate-800/90 p-6 shadow-2xl backdrop-blur sm:p-9">
          <div class="lg:hidden">
            <p class="text-xs font-semibold tracking-[0.24em] text-blue-300">AZKO KUDUS SUDIRMAN</p>
            <h1 class="mt-2 text-3xl font-bold text-white">Portal Web<br><span class="font-light">Azko Kudus Sudirman</span></h1>
          </div>
          <h2 class="mt-8 text-3xl font-bold text-white lg:mt-0">${escapeHtml(title)}</h2>
          <p class="mt-2 text-sm leading-6 text-slate-300">${escapeHtml(subtitle)}</p>
          <form id="portal-login-form" data-login-form class="mt-7 space-y-4" autocomplete="on">
            <input id="portal-login-username" name="username" data-login-username type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required class="min-h-12 w-full rounded-lg border border-slate-500 bg-slate-600 px-4 text-white placeholder:text-slate-200 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20" placeholder="Username / NIP">
            <input id="portal-login-password" name="password" data-login-password type="password" autocomplete="current-password" required class="min-h-12 w-full rounded-lg border border-slate-500 bg-slate-600 px-4 text-white placeholder:text-slate-200 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/20" placeholder="Kata Sandi Anda">
            <div id="portal-login-error" data-login-error class="hidden rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert" aria-live="polite"></div>
            <button id="portal-login-submit" data-login-submit type="submit" class="mt-2 min-h-12 w-full rounded-lg bg-white px-4 text-sm font-bold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">${escapeHtml(submitText)}</button>
          </form>
        </section>
      </div>
    </div>
  `;

  const form =
    container.querySelector('[data-login-form]');

  const usernameInput =
    container.querySelector('[data-login-username]');

  const passwordInput =
    container.querySelector('[data-login-password]');

  const submitButton =
    container.querySelector('[data-login-submit]');

  const errorElement =
    container.querySelector('[data-login-error]');

  usernameInput?.focus();

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username =
      String(usernameInput?.value || '').trim();

    const password =
      String(passwordInput?.value || '');

    hideError(errorElement);

    if (!username || !password) {
      showError(
        errorElement,
        'Username dan password wajib diisi.'
      );
      return;
    }

    setLoading(
      submitButton,
      true,
      submitText
    );

    try {
      const session =
        await login(username, password);

      logger.info('Login view completed', {
        username
      });

      if (typeof onSuccess === 'function') {
        await onSuccess(session);
      }
    } catch (error) {
      logger.warn('Login view failed', {
        username,
        message: error.message
      });

      showError(
        errorElement,
        error.message ||
        'Login gagal.'
      );

      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
    } finally {
      setLoading(
        submitButton,
        false,
        submitText
      );
    }
  });
}

function setLoading(button, loading, defaultText) {
  if (!button) {
    return;
  }

  button.disabled = loading;

  button.textContent =
    loading
      ? 'Memeriksa...'
      : defaultText;
}

function showError(element, message) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.remove('hidden');
}

function hideError(element) {
  if (!element) {
    return;
  }

  element.textContent = '';
  element.classList.add('hidden');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
