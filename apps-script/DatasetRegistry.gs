const PORTAL_SCHEMA_VERSION = 9;

const PORTAL_DATASETS = Object.freeze({
  appARecords: createDatasetDefinition_('appA', 'APP_A_DATA'),
  appBRecords: createDatasetDefinition_('appB', 'APP_B_DATA'),
  appCRecords: createDatasetDefinition_('appC', 'APP_C_DATA'),
  appDRecords: createDatasetDefinition_('appD', 'APP_D_DATA'),
  appERecords: createDatasetDefinition_('appE', 'APP_E_DATA')
});

function createDatasetDefinition_(appId, sheetName) {
  return Object.freeze({
    appId: appId,
    sheetName: sheetName,
    idPrefix: String(appId || 'record').toUpperCase(),
    idColumn: 'RECORD_ID',
    headers: [
      'RECORD_ID',
      'TITLE',
      'DESCRIPTION',
      'STATUS',
      'ROW_VERSION',
      'CREATED_BY',
      'CREATED_AT',
      'UPDATED_BY',
      'UPDATED_AT',
      'DELETED_BY',
      'DELETED_AT'
    ],
    writableFields: ['TITLE', 'DESCRIPTION', 'STATUS'],
    requiredFields: ['TITLE'],
    defaultValues: { STATUS: 'ACTIVE' },
    allowedStatus: ['ACTIVE', 'INACTIVE', 'DRAFT'],
    permissions: {
      list: appId + '.data.view',
      get: appId + '.data.view',
      create: appId + '.data.create',
      update: appId + '.data.edit',
      delete: appId + '.data.delete',
      restore: appId + '.data.delete'
    }
  });
}

function getDatasetDefinition_(datasetKey) {
  const key = String(datasetKey || '').trim();
  const definition = PORTAL_DATASETS[key];
  if (!definition) {
    const error = new Error('Dataset tidak terdaftar.');
    error.code = 'DATASET_NOT_FOUND';
    throw error;
  }
  return definition;
}

function listDatasetDefinitions_() {
  return Object.keys(PORTAL_DATASETS).map(function(key) {
    return { key: key, definition: PORTAL_DATASETS[key] };
  });
}
