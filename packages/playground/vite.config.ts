import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3457, // Truxe Playground port (3456++ pattern)
    strictPort: true, // Fail if port is busy instead of auto-incrementing
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})