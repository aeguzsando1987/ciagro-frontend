import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './msw-server'

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

// jsdom tampoco implementa createObjectURL. maplibre-gl la llama al importarse, para
// armar su worker, así que cualquier test que arrastre el mapa (aunque lo mockee en el
// componente) reventaba con una unhandled rejection al cargar el módulo. No tumbaba
// tests, pero vitest avisa de que puede causar falsos positivos.
if (!window.URL.createObjectURL) {
  window.URL.createObjectURL = () => ''
  window.URL.revokeObjectURL = () => {}
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
