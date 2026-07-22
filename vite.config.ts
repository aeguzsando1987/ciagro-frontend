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
    proxy: {
      // Liga pública del reporte (/r/<uuid>/): la renderiza Django server-side, NO la
      // SPA. Sin este proxy, en desarrollo Vite devolvería index.html y el router
      // mostraría "NOT FOUND". Réplica del `location /r/` que nginx tiene en producción,
      // para que la liga copiada desde la app funcione igual en ambos entornos.
      '/r': {
        target: process.env['VITE_BACKEND_ORIGIN'] ?? 'http://localhost:8500',
        changeOrigin: true,
      },
      // Archivos subidos (snapshot del mapa y firma del reporte). La página pública
      // los referencia como rutas relativas `/media/...`, que el navegador resuelve
      // contra el origen de la página; sin este proxy caerían en Vite y saldrían como
      // imagen rota. nginx ya tiene el equivalente en producción.
      '/media': {
        target: process.env['VITE_BACKEND_ORIGIN'] ?? 'http://localhost:8500',
        changeOrigin: true,
      },
    },
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
