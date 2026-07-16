import { callApi } from '../../core/api.js';

export const dataClient = {
  list(dataset, options = {}) {
    return callApi('data.list', {
      dataset,
      page: options.page || 1,
      pageSize: options.pageSize || 20,
      query: options.query || '',
      status: options.status || '',
      includeDeleted: Boolean(options.includeDeleted)
    }, { deduplicate: options.deduplicate !== false });
  },
  get(dataset, recordId) {
    return callApi('data.get', { dataset, recordId });
  },
  create(dataset, values) {
    return callApi('data.create', { dataset, values }, { deduplicate: false });
  },
  update(dataset, recordId, rowVersion, values) {
    return callApi('data.update', { dataset, recordId, rowVersion, values }, { deduplicate: false });
  },
  remove(dataset, recordId, rowVersion) {
    return callApi('data.delete', { dataset, recordId, rowVersion }, { deduplicate: false });
  },
  restore(dataset, recordId, rowVersion) {
    return callApi('data.restore', { dataset, recordId, rowVersion }, { deduplicate: false });
  }
};
