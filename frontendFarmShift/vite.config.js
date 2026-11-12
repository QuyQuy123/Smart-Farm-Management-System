import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const usePolling = env.VITE_USE_POLLING === 'true'
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [react()],
    server: {
      port: 5173,
      watch: usePolling
        ? {
            usePolling: true,
            interval: 600,
            ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/coverage/**'],
          }
        : undefined,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
