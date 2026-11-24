import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === 'build' || isPreview ? '/static/' : '/',
  server: {
    proxy: {
      '/chat': 'http://127.0.0.1:8000',
    },
  },
  preview: {
    proxy: {
      '/chat': 'http://127.0.0.1:8000',
    },
  },
}));
