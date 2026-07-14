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
    <div class="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          Portal V3
        </p>

        <h1 class="mt-2 text-2xl font-bold text-slate-900">
          ${escapeHtml(title)}
        </h1>

        <p class="mt-2 text-sm leading-6 text-slate-600">
          ${escapeHtml(subtitle)}
        </p>

        <form
          id="portal-login-form"
          data-login-form
          class="mt-6 space-y-4"
          autocomplete="on"
        >
          <div>
            <label
              for="portal-login-username"
              class="mb-2 block text-sm font-semibold text-slate-700"
            >
              Username
            </label>

            <input
              id="portal-login-username"
              name="username"
              data-login-username
              type="text"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              required
              class="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
          </div>

          <div>
            <label
              for="portal-login-password"
              class="mb-2 block text-sm font-semibold text-slate-700"
            >
              Password
            </label>

            <input
              id="portal-login-password"
              name="password"
              data-login-password
              type="password"
              autocomplete="current-password"
              required
              class="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            >
          </div>

          <div
            id="portal-login-error"
            data-login-error
            class="hidden rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
            aria-live="polite"
          ></div>

          <button
            id="portal-login-submit"
            data-login-submit
            type="submit"
            class="app-button-primary w-full"
          >
            ${escapeHtml(submitText)}
          </button>
        </form>
      </section>
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
