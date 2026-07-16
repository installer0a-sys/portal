import { createPlaceholderApp } from '../shared/placeholder-app.js';
const app = createPlaceholderApp({ id: 'appB', title: 'App B', description: 'Kerangka aplikasi B sudah terhubung dengan router, lifecycle, permission, dan portal shell.' });
export const { mount, refresh, pause, resume, unmount } = app;
