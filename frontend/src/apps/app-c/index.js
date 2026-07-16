import { createPlaceholderApp } from '../shared/placeholder-app.js';
const app = createPlaceholderApp({ id: 'appC', title: 'App C', description: 'Kerangka aplikasi C sudah terhubung dengan router, lifecycle, permission, dan portal shell.' });
export const { mount, refresh, pause, resume, unmount } = app;
