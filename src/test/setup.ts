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

// jsdom tampoco implementa la API de pointer capture ni scrollIntoView, que Radix
// usa en Select para posicionar el listado y seguir el puntero. Sin estos stubs
// abrir un Select desde un test revienta.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

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
