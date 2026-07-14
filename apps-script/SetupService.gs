function setupPortalSheets_() {
  const ss = SpreadsheetApp.getActive();
  const definitions = [
    ['CONFIG', ['KEY','VALUE','TYPE','DESCRIPTION','UPDATED_AT']],
    ['USERS', ['USER_ID','USERNAME','PASSWORD_HASH','PASSWORD_SALT','STATUS','PORTAL_ROLE','SESSION_VERSION','CREATED_AT','UPDATED_AT']],
    ['USER_APP_ROLES', ['USER_ID','APP_ID','ROLE','STATUS','UPDATED_AT']],
    ['ROLE_PERMISSIONS', ['APP_ID','ROLE','PERMISSION','DESCRIPTION']],
    ['SESSIONS', ['SESSION_ID','USER_ID','TOKEN_HASH','EXPIRES_AT','STATUS','CREATED_AT','LAST_SEEN_AT']],
    ['APPS', ['APP_ID','APP_NAME','ENABLED','DIRECT_PWA','SORT_ORDER','DESCRIPTION']],
    ['AUDIT_LOG', ['TIMESTAMP','REQUEST_ID','USER_ID','ACTION','STATUS','DURATION_MS','DETAILS']],
    ['SYSTEM_LOG', ['TIMESTAMP','LEVEL','SOURCE','MESSAGE','REQUEST_ID','DETAILS']]
  ];

  definitions.forEach(([name, headers]) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#1d4ed8').setFontColor('#ffffff');
    sheet.autoResizeColumns(1, headers.length);
  });

  seedConfig_(ss);
  seedApps_(ss);
  seedPermissions_(ss);
  return success_({ sheets: definitions.map(item => item[0]) }, 'Struktur sheet berhasil dibuat.');
}

function setupPortalSheets() {
  return setupPortalSheets_();
}

function seedConfig_(ss) {
  const sheet = ss.getSheetByName('CONFIG');
  const rows = [
    ['PORTAL_NAME','Portal AZKO Kudus','STRING','Nama portal',new Date()],
    ['PORTAL_VERSION',PORTAL_VERSION,'STRING','Versi backend',new Date()],
    ['MAINTENANCE_MODE','FALSE','BOOLEAN','Mode pemeliharaan',new Date()],
    ['SESSION_TTL_MINUTES','480','NUMBER','Masa sesi login',new Date()]
  ];
  sheet.getRange(2,1,rows.length,rows[0].length).setValues(rows);
}

function seedApps_(ss) {
  const sheet = ss.getSheetByName('APPS');
  const rows = [
    ['portal','Portal Utama',true,true,1,'Shell utama portal'],
    ['appA','App A',false,true,10,'Akan dibuat pada fase berikutnya']
  ];
  sheet.getRange(2,1,rows.length,rows[0].length).setValues(rows);
}

function seedPermissions_(ss) {
  const sheet = ss.getSheetByName('ROLE_PERMISSIONS');
  const rows = [
    ['portal','ADMIN','portal.access','Akses portal'],
    ['portal','ADMIN','portal.settings','Kelola pengaturan'],
    ['portal','USER','portal.access','Akses portal'],
    ['appA','MANAGER','appA.access','Akses App A'],
    ['appA','MANAGER','appA.manage','Kelola App A'],
    ['appA','VIEWER','appA.access','Lihat App A']
  ];
  sheet.getRange(2,1,rows.length,rows[0].length).setValues(rows);
}
