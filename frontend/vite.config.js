import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/portal/',
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        portal: resolve(import.meta.dirname, 'index.html'),
        appA: resolve(import.meta.dirname, 'app-a/index.html')
      }
    }
  }
});
