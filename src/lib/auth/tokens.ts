/**
 * Almacenamiento de tokens JWT — Decisión Paso 5 (regla 🛑 #3).
 *
 * - access token vive ÚNICAMENTE en memoria (closure de este módulo).
 *   Se pierde al cerrar/recargar la pestaña → al cargar la app pedimos
 *   refresh inmediato.
 * - refresh token vive en localStorage con clave 'ciagro-refresh'.
 *   Aceptable bajo CSP estricta; gap futuro a httpOnly cookie en
 *   GAP-FUTURO-001.
 *
 * El módulo expone `tokens` como objeto simple para que el interceptor
 * HTTP (src/lib/api/client.ts) y el guard del router puedan leerlo
 * fuera de React sin Hooks.
 */

export const REFRESH_STORAGE_KEY = 'ciagro-refresh'

let accessToken: string | null = null

export const tokens = {
  getAccess(): string | null {
    return accessToken
  },

  setAccess(token: string | null): void {
    accessToken = token
  },

  getRefresh(): string | null {
    try {
      return localStorage.getItem(REFRESH_STORAGE_KEY)
    } catch {
      // En entornos sin localStorage (SSR/tests) devolvemos null.
      return null
    }
  },

  setRefresh(token: string | null): void {
    try {
      if (token === null) localStorage.removeItem(REFRESH_STORAGE_KEY)
      else localStorage.setItem(REFRESH_STORAGE_KEY, token)
    } catch {
      // Silently no-op si localStorage no está disponible.
    }
  },

  clear(): void {
    accessToken = null
    this.setRefresh(null)
  },
}
