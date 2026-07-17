function appAViewParitySplit_(value) {
  return String(value || '')
    .split(',')
    .map(function(item) { return appANormalizeText_(item); })
    .filter(Boolean);
}

function appAViewParityEmployeeSource_(appContext, view) {
  const config = appContext.config || {};
  let sheetName = String(config.CONF_KAR_SHEET || '').trim();
  let headerName = String(config.CONF_KAR_JABATAN || '').trim();
  let roleConfig = '';

  if (view === 'jadwal-spv') {
    sheetName = String(config.CONF_SPV_SHEET || sheetName).trim();
    headerName = String(config.CONF_SPV_HEADER || headerName).trim();
    roleConfig = String(config.CONF_SPV_ROLES || '').trim();
  } else if (view === 'dop-dos') {
    sheetName = String(config.CONF_DOP_SHEET || sheetName).trim();
    headerName = String(config.CONF_DOP_HEADER || headerName).trim();
    roleConfig = String(config.CONF_DOP_ROLES || '').trim();
  }

  return {
    sheetName: sheetName,
    headerName: headerName,
    roleConfig: roleConfig
  };
}

function appAViewParityEmployeeMap_(appContext, view) {
  const config = appContext.config || {};
  const source = appAViewParityEmployeeSource_(appContext, view);
  const sheet = source.sheetName
    ? appContext.spreadsheet.getSheetByName(source.sheetName)
    : null;

  if (!sheet) {
    return {
      source: source,
      rows: [],
      byNip: {},
      roles: appAViewParitySplit_(source.roleConfig)
    };
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    return {
      source: source,
      rows: [],
      byNip: {},
      roles: appAViewParitySplit_(source.roleConfig)
    };
  }

  const headers = values[0].map(function(value) {
    return String(value || '').trim();
  });
  const normalized = headers.map(appANormalizeText_);

  function resolve(configKey, patterns, fallback) {
    const configured = String(config[configKey] || '').trim();
    if (configured) {
      const exact = normalized.indexOf(appANormalizeText_(configured));
      if (exact >= 0) return exact;
    }
    return appAFindHeaderIndex_(headers, patterns, fallback);
  }

  const nipIndex = resolve('CONF_KAR_NIP', ['NIP','USERNAME'], 0);
  const nameIndex = resolve('CONF_KAR_NAMA', ['NAMA'], 1);
  const deptIndex = resolve('CONF_KAR_DEPT', ['DEPARTEMEN','DEPARTMENT'], 2);
  const zoneIndex = resolve('CONF_KAR_ZONA', ['ZONA'], 3);
  const positionIndex = source.headerName
    ? normalized.indexOf(appANormalizeText_(source.headerName))
    : resolve('CONF_KAR_JABATAN', ['JABATAN','ROLE'], 4);
  const dashboardPositionIndex = resolve('CONF_KAR_JAB_DASH', ['JABATAN DASHBOARD','JABATAN'], positionIndex);
  const roIndex = resolve('CONF_KAR_RO', ['SISA RO','RO'], -1);

  const byNip = {};
  const rows = [];

  values.slice(1).forEach(function(row) {
    const nip = nipIndex >= 0 ? String(row[nipIndex] || '').trim().replace(/^'+/, '') : '';
    if (!nip) return;

    const item = {
      nip: nip,
      name: nameIndex >= 0 ? String(row[nameIndex] || '').trim() : '',
      department: deptIndex >= 0 ? String(row[deptIndex] || '').trim() : '',
      zone: zoneIndex >= 0 ? String(row[zoneIndex] || '').trim() : '',
      position: positionIndex >= 0 ? String(row[positionIndex] || '').trim() : '',
      dashboardPosition: dashboardPositionIndex >= 0 ? String(row[dashboardPositionIndex] || '').trim() : '',
      sisaRo: roIndex >= 0 ? String(row[roIndex] || '').trim() : '',
      sourceRow: row
    };

    item.positionTokens = appAViewParitySplit_(item.position);
    rows.push(item);
    byNip[appANormalizeText_(nip)] = item;
  });

  return {
    source: source,
    rows: rows,
    byNip: byNip,
    roles: appAViewParitySplit_(source.roleConfig)
  };
}

function appAViewParityDateStart_(head1) {
  for (let index = 0; index < head1.length; index += 1) {
    if (/^\d{1,2}$/.test(String(head1[index] || '').trim())) return index;
  }
  return 5;
}

function appAViewParityRowObject_(row, headers, employee) {
  const nipIndex = appAFindHeaderIndex_(headers, ['NIP'], 0);
  const nameIndex = appAFindHeaderIndex_(headers, ['NAMA'], 1);
  const deptIndex = appAFindHeaderIndex_(headers, ['DEPARTEMEN','DEPARTMENT'], 2);
  const zoneIndex = appAFindHeaderIndex_(headers, ['ZONA'], 3);
  const positionIndex = appAFindHeaderIndex_(headers, ['JABATAN'], 4);

  const sheetPosition = positionIndex >= 0 ? String(row[positionIndex] || '').trim() : '';

  return {
    nip: String(row[nipIndex] || '').trim().replace(/^'+/, ''),
    name: String(row[nameIndex] || employee && employee.name || '').trim(),
    department: String(row[deptIndex] || employee && employee.department || '').trim(),
    zone: String(row[zoneIndex] || employee && employee.zone || 'TANPA ZONA').trim() || 'TANPA ZONA',
    position: sheetPosition || String(employee && employee.position || '').trim(),
    dashboardPosition: String(employee && employee.dashboardPosition || sheetPosition || '').trim(),
    sisaRo: String(employee && employee.sisaRo || '').trim(),
    raw: row
  };
}

function appAViewParityMatchesRoles_(employee, roles) {
  if (!roles.length) return true;
  if (!employee) return false;

  const tokens = employee.positionTokens || appAViewParitySplit_(employee.position);
  return tokens.some(function(token) {
    return roles.indexOf(token) >= 0;
  });
}

function appAViewParityBuild_(context, payload) {
  const appContext = getAppAContext_(context);
  const view = String(payload && payload.view || 'jadwal-all').trim();

  // Semua view memakai sheet jadwal utama yang sama.
  const data = appAReadScheduleData_(
    appContext,
    payload && payload.sheetName,
    payload && payload.limit
  );

  const scope = appAViewScope_(context, appContext, view);
  const employeeData = appAViewParityEmployeeMap_(appContext, view);
  const dateStart = appAViewParityDateStart_(data.head1);

  let rowObjects = data.rows.map(function(row) {
    const nipIndex = appAFindHeaderIndex_(data.head1, ['NIP'], 0);
    const nip = String(row[nipIndex] || '').trim().replace(/^'+/, '');
    return appAViewParityRowObject_(
      row,
      data.head1,
      employeeData.byNip[appANormalizeText_(nip)]
    );
  });

  if (view === 'jadwal-spv' || view === 'dop-dos') {
    rowObjects = rowObjects.filter(function(item) {
      const employee = employeeData.byNip[appANormalizeText_(item.nip)];
      return appAViewParityMatchesRoles_(employee, employeeData.roles);
    });
  }

  // Scope akses Portal tetap diterapkan setelah filter business view.
  const scopedRaw = appAApplyScope_({
    head1: data.head1,
    rows: rowObjects.map(function(item) { return item.raw; })
  }, scope);
  const scopedKeys = {};
  scopedRaw.forEach(function(row) {
    const nipIndex = appAFindHeaderIndex_(data.head1, ['NIP'], 0);
    scopedKeys[appANormalizeText_(row[nipIndex])] = true;
  });
  rowObjects = rowObjects.filter(function(item) {
    return scopedKeys[appANormalizeText_(item.nip)];
  });

  const groups = {};
  rowObjects.forEach(function(item) {
    let groupKey = item.zone || 'TANPA ZONA';
    if (view === 'jadwal-spv' || view === 'dop-dos') {
      const employee = employeeData.byNip[appANormalizeText_(item.nip)];
      const matched = (employee && employee.positionTokens || []).find(function(token) {
        return employeeData.roles.indexOf(token) >= 0;
      });
      groupKey = matched || item.position || groupKey;
    }
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(item);
  });

  const configuredOrder = String(appContext.config.URUTAN_ZONA || '')
    .split(/[,;\n]/)
    .map(function(value) { return value.trim(); })
    .filter(Boolean)
    .map(appANormalizeText_);

  const groupKeys = Object.keys(groups).sort(function(a, b) {
    const ai = configuredOrder.indexOf(appANormalizeText_(a));
    const bi = configuredOrder.indexOf(appANormalizeText_(b));
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });

  let tableMeta;
  if (view === 'dop-dos') {
    tableMeta = {
      type: 'DOP_DOS',
      fixedHeaders: ['NO','NIP','NAMA','DEPARTEMEN','DOP','DOS'],
      dateStart: dateStart,
      showDopDosTotals: true,
      groupBy: 'POSITION'
    };
  } else if (view === 'jadwal-spv') {
    tableMeta = {
      type: 'SPV',
      fixedHeaders: ['NO','NIP','NAMA','DEPARTEMEN','SISA RO'],
      dateStart: dateStart,
      showSisaRo: true,
      groupBy: 'POSITION'
    };
  } else {
    tableMeta = {
      type: 'ALL',
      fixedHeaders: ['NO','NIP','NAMA','DEPARTEMEN'],
      dateStart: dateStart,
      groupBy: 'ZONE'
    };
  }

  return {
    appContext: appContext,
    data: data,
    view: view,
    scope: scope,
    employeeData: employeeData,
    rows: rowObjects,
    groups: groups,
    groupKeys: groupKeys,
    tableMeta: tableMeta
  };
}

function appAScheduleListV061_(context, payload) {
  const result = appAViewParityBuild_(context, payload);

  writeAuditLog_({
    requestId: payload && payload.requestId || '',
    userId: context.user.USER_ID,
    action: 'appA.schedule.view',
    status: 'SUCCESS',
    details: {
      version: '0.6.1',
      view: result.view,
      sheetName: result.data.sheetName,
      rows: result.rows.length,
      sourceSheet: result.employeeData.source.sheetName,
      filterHeader: result.employeeData.source.headerName,
      filterRoles: result.employeeData.roles
    }
  });

  return success_({
    appName: 'Jadwal A542',
    view: result.view,
    sheetName: result.data.sheetName,
    sheets: result.data.sheets,
    head1: result.data.head1,
    head2: result.data.head2,
    dateStart: result.tableMeta.dateStart,
    tableMeta: result.tableMeta,
    rows: result.rows,
    groupKeys: result.groupKeys,
    groupedRows: result.groups,
    total: result.rows.length,
    roles: result.scope.roles,
    readOnly: result.scope.readOnly,
    canEdit: result.scope.canEdit,
    viewFilter: {
      sourceSheet: result.employeeData.source.sheetName,
      header: result.employeeData.source.headerName,
      roles: result.employeeData.roles
    },
    accessScope: {
      mode: result.scope.mode,
      label: result.scope.label,
      identity: result.scope.identity
    }
  }, 'Data Jadwal A542 berhasil dimuat dari sheet jadwal utama.');
}
