import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const raw = env.VITE_BASE?.trim();
  const base = raw
    ? raw.endsWith('/') ? raw : `${raw}/`
    : mode === 'production'
      ? '/admin/'
      : '/';

  return {
  plugins: [react()],
  base,
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
};
});
