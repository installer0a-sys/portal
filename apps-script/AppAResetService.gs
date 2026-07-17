/**
 * Reset data runtime App A pada Spreadsheet Portal.
 *
 * Dipertahankan:
 * - APPS registry / App Management
 * - nama aplikasi
 * - Spreadsheet ID
 * - config sheet
 * - route, status, icon, urutan
 * - user, permission, role, session, audit umum
 *
 * Tidak disentuh:
 * - Spreadsheet mandiri Jadwal A542
 *
 * Dihapus:
 * - APP_CONFIG_CACHE untuk appA
 * - Script Cache runtime App A
 */
function resetAppAWorkspace_() {
  const portal = getPortalSpreadsheet_();
  const cacheSheet = portal.getSheetByName('APP_CONFIG_CACHE');
  let deletedCacheRows = 0;

  if (cacheSheet && cacheSheet.getLastRow() >= 2) {
    const headers = getSheetHeaders_(cacheSheet);
    const appIdIndex = headers.indexOf('APP_ID');

    if (appIdIndex >= 0) {
      const values = cacheSheet
        .getRange(2, 1, cacheSheet.getLastRow() - 1, headers.length)
        .getDisplayValues();

      for (let index = values.length - 1; index >= 0; index -= 1) {
        if (String(values[index][appIdIndex] || '').trim() === 'appA') {
          cacheSheet.deleteRow(index + 2);
          deletedCacheRows += 1;
        }
      }
    }
  }

  const runtimeCache = CacheService.getScriptCache();
  [
    'app-config-runtime:appA',
    'app-config:appA',
    'appA',
    'appA.config',
    'appA.schedule',
    'appA.dashboard'
  ].forEach(function(key) {
    runtimeCache.remove(key);
  });

  return {
    success: true,
    appId: 'appA',
    deletedConfigCacheRows: deletedCacheRows,
    appRegistryPreserved: true,
    standaloneSpreadsheetUntouched: true
  };
}
