function writeAuditLog_(entry) {
  try {
    const sheet = getPortalSpreadsheet_().getSheetByName('AUDIT_LOG');
    if (!sheet) return;
    const headers = getSheetHeaders_(sheet);
    const record = {
      TIMESTAMP: new Date(),
      REQUEST_ID: entry.requestId || '',
      USER_ID: entry.userId || '',
      ACTION: entry.action || '',
      STATUS: entry.status || '',
      DURATION_MS: entry.durationMs || '',
      DETAILS: JSON.stringify(entry.details || {})
    };
    sheet.appendRow(headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
    }));
  } catch (error) {
    console.error('Audit log gagal:', error);
  }
}
