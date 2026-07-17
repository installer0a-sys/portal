import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const read = (path) => readFile(resolve(root, path), 'utf8');
const write = (path, content) => writeFile(resolve(root, path), content, 'utf8');

async function update(path, transform) {
  const source = await read(path);
  const output = transform(source);
  if (output !== source) await write(path, output);
}

const COMPACT_MARKER = '/* v0.5.7 global compact density */';
const compactCss = `

${COMPACT_MARKER}
:root {
  --portal-header-h: 56px;
  --portal-sidebar-w: 232px;
  --portal-sidebar-collapsed-w: 60px;
  --portal-control-h: 36px;
}

/* Global typography and spacing */
#app { font-size: 13px; }
#app h1 { line-height: 1.2; }
#app h2 { line-height: 1.25; }
#app .app-card { border-radius: 12px; padding: 14px; }
#app .app-button,
#app .app-button-primary,
#app .app-button-secondary {
  min-height: var(--portal-control-h) !important;
  border-radius: 9px !important;
  padding-left: 13px !important;
  padding-right: 13px !important;
  font-size: 12px !important;
}
#app input:not([type="checkbox"]):not([type="radio"]),
#app select,
#app textarea {
  min-height: var(--portal-control-h) !important;
  border-radius: 9px !important;
  font-size: 12px !important;
}

/* Login compact */
.portal-login-bg { padding: 18px !important; }
.portal-login-bg > div {
  min-height: calc(100vh - 36px) !important;
  max-width: 1180px !important;
  gap: 32px !important;
  grid-template-columns: minmax(0,1.35fr) minmax(340px,.65fr) !important;
}
.portal-login-bg section:first-child h1 { font-size: 40px !important; line-height: 1.2 !important; }
.portal-login-bg section:last-child {
  min-height: 350px !important;
  max-width: 390px;
  justify-self: end;
  border-radius: 18px !important;
  padding: 28px !important;
}
.portal-login-bg section:last-child > h2 { margin-top: 0 !important; font-size: 25px !important; }
.portal-login-bg section:last-child p { font-size: 12px !important; line-height: 1.55 !important; }
.portal-login-bg form { margin-top: 22px !important; gap: 12px !important; }
.portal-login-bg input,
.portal-login-bg button[type="submit"] { min-height: 42px !important; font-size: 12px !important; }

/* Portal and app headers */
#app header > div { min-height: var(--portal-header-h) !important; }
#profile-button { height: 36px !important; border-radius: 9px !important; font-size: 12px !important; }
#profile-button > span:first-child { width: 27px !important; height: 27px !important; font-size: 11px !important; }
#toggle-sidebar,
#all-apps-button { width: 36px !important; height: 36px !important; border-radius: 9px !important; }
#toggle-sidebar svg,
#all-apps-button svg,
#app header button[title="Notifikasi"] svg { width: 17px !important; height: 17px !important; }
#app header button[title="Notifikasi"] { width: 36px !important; height: 36px !important; border-radius: 9px !important; }
#profile-menu { width: min(250px, calc(100vw - 24px)) !important; border-radius: 12px !important; padding: 9px !important; }
#profile-menu > div:first-child { padding: 10px !important; border-radius: 9px !important; }

/* Sidebar compact */
.app-sidebar { width: var(--portal-sidebar-w); padding: 12px !important; }
.app-sidebar.is-collapsed { width: var(--portal-sidebar-collapsed-w); }
.app-sidebar .sidebar-brand-text { padding-bottom: 11px !important; }
.app-sidebar .sidebar-brand-text > p:first-child { font-size: 14px !important; }
.app-sidebar .sidebar-brand-text > p:last-child { margin-top: 3px !important; font-size: 10px !important; }
.app-sidebar nav { margin-top: 11px !important; gap: 2px !important; }
.app-sidebar .sidebar-link {
  min-height: 36px !important;
  gap: 9px !important;
  border-radius: 9px !important;
  padding: 7px 10px !important;
  font-size: 12px !important;
}
.app-sidebar .sidebar-link svg { width: 17px !important; height: 17px !important; }
#app-admin-submenu { margin-top: 2px !important; padding-left: 8px !important; }
#app-admin-submenu .sidebar-link { min-height: 32px !important; font-size: 11px !important; }
.app-sidebar .sidebar-section-label { margin-top: 9px !important; font-size: 9px !important; }

/* Content and launcher compact */
#portal-content { padding: 14px !important; }
.launcher-layout { gap: 14px !important; }
.launcher-layout h1 { font-size: 22px !important; }
.launcher-layout h2 { font-size: 16px !important; }
.launcher-layout p { font-size: 12px; }
.launcher-scroll-area { padding-top: 12px !important; }
.launcher-scroll-area .app-card { min-height: 0 !important; }

/* Settings compact */
#portal-settings-root [data-settings-backdrop] > section { border-radius: 18px !important; }
#portal-settings-root header { min-height: 54px !important; padding: 10px 16px !important; }
#portal-settings-root aside { width: 220px !important; padding: 10px !important; }
#portal-settings-root aside button { min-height: 36px !important; padding: 8px 10px !important; font-size: 12px !important; }
#settings-content { padding: 16px !important; font-size: 12px !important; }
#settings-content h1, #settings-content h2 { font-size: 18px !important; }
#settings-content h3 { font-size: 15px !important; }
#settings-content th { padding: 8px 10px !important; font-size: 10px !important; }
#settings-content td { padding: 8px 10px !important; font-size: 11px !important; }

/* Jadwal A542 table density */
.app-workspace table th { font-size: 10px !important; }
.app-workspace table td { font-size: 10px !important; }
.app-workspace table th,
.app-workspace table td { padding-top: 6px !important; padding-bottom: 6px !important; }
.jadwal-col-1 { left: 0; min-width: 42px !important; }
.jadwal-col-2 { left: 42px; min-width: 68px !important; }
.jadwal-col-3 { left: 110px; min-width: 145px !important; }
.jadwal-col-4 { left: 255px; min-width: 120px !important; }

/* Smaller loading state, preserving cached content when available */
[data-loading-view], .app-loading-view { min-height: 220px !important; font-size: 12px !important; }

@media (max-width: 1023px) {
  .app-sidebar { width: 232px !important; }
  #portal-content { padding: 12px !important; }
  .portal-login-bg > div { display: flex !important; justify-content: center; }
  .portal-login-bg section:last-child { justify-self: auto; max-width: 390px; }
}

@media (max-width: 639px) {
  #app { font-size: 12px; }
  #app header > div { min-height: 54px !important; padding-left: 12px !important; padding-right: 12px !important; }
  #portal-content { padding: 10px !important; }
  .portal-login-bg { padding: 12px !important; }
  .portal-login-bg section:last-child { min-height: 330px !important; padding: 22px !important; }
  .portal-login-bg section:last-child .lg\\:hidden h1 { font-size: 25px !important; }
  #portal-settings-root aside { width: 100% !important; }
}
`;

await update('src/styles/app.css', (source) =>
  source.includes(COMPACT_MARKER) ? source : `${source.trimEnd()}${compactCss}\n`
);

await update('src/core/config.js', (source) =>
  source.replace(/version:\s*'[^']+'/u, "version: '0.5.7'")
);

await update('src/entries/portal.js', (source) =>
  source.replace(/Portal v0\.5\.6 \| Design by Fredi/g, 'Portal v0.5.7 | Design by Fredi')
);

await update('src/auth/auth.js', (source) => {
  const oldBlock = `  } catch (error) {\n    sessionStore.clearRuntimeSession();\n    clearSessionState();\n\n    logger.warn(\n      'Session restore failed',\n      {\n        message:\n          error.message\n      }\n    );\n\n    return {\n      authenticated: false,\n      source: 'server',\n      error:\n        error.message\n    };\n  }`;

  const newBlock = `  } catch (error) {\n    const message = String(error?.message || '');\n    const explicitlyInvalid = /(?:session|token).*(?:tidak valid|invalid|expired|kedaluwarsa)|(?:tidak valid|invalid|expired|kedaluwarsa).*(?:session|token)|unauthorized|silakan login|login kembali/i.test(message);\n\n    /*\n     * Timeout, koneksi lambat, atau error data aplikasi tidak boleh\n     * menghapus sesi Portal yang masih tersimpan. Gunakan snapshot cache\n     * sebagai mode offline/stale dan validasi kembali pada request berikutnya.\n     */\n    if (cached && !explicitlyInvalid) {\n      applySession(cached);\n      logger.warn('Session validation deferred; cached session retained', { message });\n      return {\n        authenticated: true,\n        source: 'stale-cache',\n        stale: true,\n        validationError: message,\n        ...cached\n      };\n    }\n\n    sessionStore.clearRuntimeSession();\n    clearSessionState();\n\n    logger.warn('Session restore failed', { message });\n\n    return {\n      authenticated: false,\n      source: 'server',\n      error: message\n    };\n  }`;

  if (source.includes('Session validation deferred; cached session retained')) return source;
  if (!source.includes(oldBlock)) {
    throw new Error('Blok restoreSession tidak ditemukan; patch dihentikan agar source tidak rusak.');
  }
  return source.replace(oldBlock, newBlock);
});

console.log('Portal v0.5.7 compact UI and session stability patch applied.');
