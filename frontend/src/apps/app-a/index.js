import { createCrudApp } from '../shared/crud-app.js';

const appA = createCrudApp({
  id: 'appA',
  title: 'App A',
  dataset: 'appARecords'
});

export const { mount, refresh, pause, resume, unmount } = appA;
