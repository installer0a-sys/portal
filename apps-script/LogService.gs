function listCentralLogs_(context, payload) {
  requirePermission_(context, 'portal.logs.view');

  const input = payload || {};
  const page = Math.max(1, Number(input.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(input.pageSize || 25)));
  const category = String(input.category || 'ALL').toUpperCase();
  const status = String(input.status || 'ALL').toUpperCase();
  const query = String(input.query || '').trim().toLowerCase();
  const appId = String(input.appId || '').trim().toLowerCase();
  const userId = String(input.userId || '').trim().toLowerCase();

  const records = [];
  readAuditLogs_(records);
  readSystemLogs_(records);

  const filtered = records.filter(function(item) {
    if (category !== 'ALL' && item.category !== category) return false;
    if (status !== 'ALL' && String(item.status || '').toUpperCase() !== status) return false;
    if (appId && String(item.appId || '').toLowerCase() !== appId) return false;
    if (userId && String(item.userId || '').toLowerCase().indexOf(userId) < 0) return false;
    if (!query) return true;
    return [item.action, item.message, item.userId, item.appId, item.requestId, item.details]
      .some(function(value) { return String(value || '').toLowerCase().indexOf(query) >= 0; });
  });

  filtered.sort(function(a, b) {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * pageSize;

  return success_({
    items: filtered.slice(start, start + pageSize),
    pagination: { page: safePage, pageSize: pageSize, total: total, pages: pages },
    generatedAt: new Date().toISOString()
  }, 'Log berhasil dimuat.');
}

function readAuditLogs_(target) {
  const sheet = getPortalSpreadsheet_().getSheetByName('AUDIT_LOG');
  if (!sheet || sheet.getLastRow() < 2) return;
  const headers = getSheetHeaders_(sheet);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  rows.forEach(function(row) {
    const item = rowToObject_(headers, row);
    const details = parseLogDetails_(item.DETAILS);
    const action = String(item.ACTION || '');
    target.push({
      timestamp: normalizeLogDate_(item.TIMESTAMP),
      category: classifyAuditCategory_(action, item.STATUS),
      level: String(item.STATUS || '').toUpperCase() === 'FAILED' ? 'ERROR' : 'INFO',
      status: String(item.STATUS || '').toUpperCase() || 'INFO',
      source: 'AUDIT_LOG',
      action: action,
      message: buildAuditMessage_(action, item.STATUS),
      requestId: String(item.REQUEST_ID || ''),
      userId: String(item.USER_ID || details.targetUserId || ''),
      appId: inferLogAppId_(action, details),
      durationMs: Number(item.DURATION_MS || 0),
      details: JSON.stringify(details)
    });
  });
}

function readSystemLogs_(target) {
  const sheet = getPortalSpreadsheet_().getSheetByName('SYSTEM_LOG');
  if (!sheet || sheet.getLastRow() < 2) return;
  const headers = getSheetHeaders_(sheet);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  rows.forEach(function(row) {
    const item = rowToObject_(headers, row);
    const details = parseLogDetails_(item.DETAILS);
    target.push({
      timestamp: normalizeLogDate_(item.TIMESTAMP),
      category: String(item.LEVEL || '').toUpperCase() === 'ERROR' ? 'ERRORS' : 'SYSTEM',
      level: String(item.LEVEL || 'INFO').toUpperCase(),
      status: String(item.LEVEL || 'INFO').toUpperCase(),
      source: String(item.SOURCE || 'SYSTEM_LOG'),
      action: String(details.action || item.SOURCE || 'system'),
      message: String(item.MESSAGE || ''),
      requestId: String(item.REQUEST_ID || ''),
      userId: String(details.userId || ''),
      appId: String(details.appId || inferLogAppId_(details.action, details) || ''),
      durationMs: Number(details.durationMs || 0),
      details: JSON.stringify(details)
    });
  });
}

function parseLogDetails_(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(String(value)); } catch (error) { return { raw: String(value) }; }
}

function normalizeLogDate_(value) {
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? String(value || '') : date.toISOString();
}

function classifyAuditCategory_(action, status) {
  const name = String(action || '').toLowerCase();
  if (name.indexOf('auth.') === 0) return 'AUTHENTICATION';
  if (name.indexOf('users.') === 0 || name.indexOf('apps.') === 0 || name.indexOf('settings.') === 0) return 'AUDIT';
  if (name.indexOf('data.') === 0) return 'USER_ACTIVITY';
  if (name.indexOf('appa.') === 0 || name.indexOf('appb.') === 0 || name.indexOf('appc.') === 0 || name.indexOf('appd.') === 0 || name.indexOf('appe.') === 0) return 'APPLICATION';
  if (String(status || '').toUpperCase() === 'FAILED') return 'ERRORS';
  return 'SYSTEM';
}

function inferLogAppId_(action, details) {
  if (details && details.appId) return String(details.appId);
  const text = String(action || '');
  const match = text.match(/^(app[a-z0-9_-]+)\./i);
  if (match) return match[1];
  if (details && details.datasetKey) {
    const dataset = String(details.datasetKey);
    const datasetMatch = dataset.match(/^(app[a-z0-9_-]+)/i);
    if (datasetMatch) return datasetMatch[1];
  }
  return '';
}

function buildAuditMessage_(action, status) {
  const label = String(action || 'Aktivitas');
  const result = String(status || '').toUpperCase();
  return result ? label + ' · ' + result : label;
}
