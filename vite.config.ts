/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Configuración Vite + Vitest. Alias @/ apunta a src/ (regla Paso 13).
// El servidor dev expone 5173 por defecto y consume el backend Django en
// VITE_API_BASE_URL (http://localhost:8500/api/v1/ en desarrollo).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/', 'e2e/'],
    },
  },
})
