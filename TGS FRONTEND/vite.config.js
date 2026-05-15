import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 6789, // Standard Vite port
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4567', // Matches the user's backend port
        changeOrigin: true,
        secure: false,
        xfwd: true,
      },
      '^/media': {
        target: 'http://127.0.0.1:4567',
        changeOrigin: true,
        secure: false,
        xfwd: true,
      }
    },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  }
})
