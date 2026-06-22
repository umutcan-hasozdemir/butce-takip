import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // /api isteklerini backend'e yönlendir
      '/api': 'http://localhost:3001',
    },
  },
})
