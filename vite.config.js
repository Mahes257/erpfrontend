import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    allowedHosts: true,
    // Same-origin API proxying: the frontend calls /v1 (see src/api/axiosInstance.js),
    // which is forwarded to the Spring Boot backend. This makes localhost and the
    // ngrok public URL behave identically from any device (no hardcoded localhost:8080
    // in browser code, no CORS dependency).
    proxy: {
      '/v1': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
    // Never let the browser cache dev assets so the latest bundle is always served
    // on localhost and through ngrok after every HMR/rebuild.
    headers: {
      'Cache-Control': 'no-store',
    },
  },
})
