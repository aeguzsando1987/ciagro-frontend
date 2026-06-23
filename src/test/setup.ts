import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './msw-server'

// jsdom no implementa ResizeObserver (lo usa AnimatedHeight para animar la altura
// de los modales con pestañas). Se mockea para que los componentes monten en tests.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)

// Setup compartido de Vitest. Se ejecuta antes de cualquier test (configurado
// en vite.config.ts → test.setupFiles).
//
// 1. Carga matchers extendidos de jest-dom (toBeInTheDocument, toHaveClass…).
// 2. Limpia el DOM entre tests para evitar contaminación.
// 3. Arranca el servidor MSW (mock de fetches) por toda la suite y resetea
//    handlers entre tests.

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => server.close())
