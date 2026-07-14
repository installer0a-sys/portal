import { login } from '../auth/auth.js';
import { logger } from '../core/logger.js';

export function renderLoginView(container, options = {}) {
  if (!container) {
    throw new Error('Container halaman login tidak ditemukan.');
  }

  /*
   * Mendukung beberapa nama parameter agar Portal dan standalone App
   * tetap kompatibel dengan patch sebelumnya.
   */
  const title =
    options.title ||
    options.appName ||
    options.heading ||
    'Masuk ke Portal';

  const subtitle =
    options.subtitle ||
    options.description ||
    options.message ||
    'Gunakan username dan password Anda.';

  const submitText =
    options.submitText ||
    options.buttonText ||
    'Masuk';

  const onSuccess =
    options.onSuccess ||
    options.onAuthenticated ||
    options.onLoginSuccess ||
    null;

  container.innerHTML = `
    <div
      class="flex min-h-screen items-center justify-center
             bg-slate-100 p-4"
    >
      <section
        class="w-full max-w-md rounded-2xl border
               border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <p
            class="text-xs font-semibold uppercase
                   tracking-[0.2em] text-blue-600"
          >
            Portal V3
          </p>

          <h1
            class="mt-2 text-2xl font-bold text-slate-900"
          >
            ${escapeHtml(title)}
          </h1>

          <p
            class="mt-2 text-sm leading-6 text-slate-600"
          >
            ${escapeHtml(subtitle)}
          </p>
        </div>

        <form
          id="portal-login-form"
          class="mt-6 space-y-4"
          autocomplete="on"
        >
          <div>
            <label
              for="portal-login-username"
              class="mb-2 block text-sm font-semibold
                     text-slate-700"
            >
              Username
            </label>

            <input
              id="portal-login-username"
              name="username"
              type="text"
              autocomplete="username"
              autocapitalize="none"
              spellcheck="false"
              required
              class="min-h-12 w-full rounded-xl border
                     border-slate-300 bg-white px-4
                     text-slate-900 outline-none transition
                     focus:border-blue-500
                     focus:ring-4 focus:ring-blue-100"
            >
          </div>

          <div>
            <label
              for="portal-login-password"
              class="mb-2 block text-sm font-semibold
                     text-slate-700"
            >
              Password
            </label>

            <input
              id="portal-login-password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              class="min-h-12 w-full rounded-xl border
                     border-slate-300 bg-white px-4
                     text-slate-900 outline-none transition
                     focus:border-blue-500
                     focus:ring-4 focus:ring-blue-100"
            >
          </div>

          <div
            id="portal-login-error"
            class="hidden rounded-xl border border-red-200
                   bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          ></div>

          <button
            id="portal-login-submit"
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
    container.querySelector('#portal-login-form');

  const usernameInput =
    container.querySelector('#portal-login-username');

  const passwordInput =
    container.querySelector('#portal-login-password');

  const submitButton =
    container.querySelector('#portal-login-submit');

  const errorElement =
    container.querySelector('#portal-login-error');

  if (
    !form ||
    !usernameInput ||
    !passwordInput ||
    !submitButton ||
    !errorElement
  ) {
    throw new Error(
      'Elemen halaman login tidak berhasil dibuat.'
    );
  }

  usernameInput.focus();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username =
      String(usernameInput.value || '').trim();

    const password =
      String(passwordInput.value || '');

    hideError(errorElement);

    if (!username || !password) {
      showError(
        errorElement,
        'Username dan password wajib diisi.'
      );

      return;
    }

    setLoading(submitButton, true, submitText);

    try {
      const session = await login(
        username,
        password
      );

      logger.info('Login view completed', {
        username
      });

      /*
       * Callback bersifat opsional.
       * Hanya dipanggil jika benar-benar sebuah fungsi.
       */
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
        'Login gagal. Periksa username dan password.'
      );

      passwordInput.value = '';
      passwordInput.focus();
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
  button.disabled = loading;

  button.textContent = loading
    ? 'Memeriksa...'
    : defaultText;
}

function showError(element, message) {
  element.textContent = message;
  element.classList.remove('hidden');
}

function hideError(element) {
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
