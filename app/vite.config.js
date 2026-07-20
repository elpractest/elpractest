import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Dev API proxy target — override with VITE_API_PROXY (env var or .env.local)
  // when port 8000 is taken, e.g. `php artisan serve --port=8010`
  // + VITE_API_PROXY=http://127.0.0.1:8010 in app/.env.local (gitignored).
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_API_PROXY || 'http://127.0.0.1:8000';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          credentials: true,
        },
        '/sanctum': {
          target: proxyTarget,
          changeOrigin: true,
          credentials: true,
        },
      },
    },
  };
});
