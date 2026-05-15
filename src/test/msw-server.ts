import { setupServer } from 'msw/node'

/**
 * Servidor MSW para tests de Node (Vitest + jsdom).
 *
 * En Fase 0 arranca con 0 handlers — cada test agrega los suyos con
 * `server.use(http.get(...))`. Esto fuerza a declarar explícitamente
 * cada endpoint que un test mockea, en línea con `strict`.
 *
 * En Fase 1+ podemos exportar también un set de "handlers comunes" si
 * notamos repetición (ej: handler default de /users/me/).
 */
export const server = setupServer()
