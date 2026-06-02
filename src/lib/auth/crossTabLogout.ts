/**
 * Sincronización de logout entre pestañas (storage event).
 *
 * El navegador dispara el evento `storage` en TODAS las pestañas hermanas (mismo origen)
 * cuando una de ellas modifica localStorage. Aprovechamos esto: cuando una pestaña hace
 * logout o el refresh expira, llama a `tokens.clear()` que elimina la clave del refresh
 * → las otras pestañas reciben el evento y también cierran sesión.
 *
 * Llamar `setupCrossTabLogout()` una sola vez en el bootstrap (main.tsx).
 */
import { tokens, REFRESH_STORAGE_KEY } from './tokens'
import { useAuthStore } from '@/features/auth/useAuthStore'

export function setupCrossTabLogout(): void {
  if (typeof window === 'undefined') return

  window.addEventListener('storage', (e) => {
    if (e.storageArea !== window.localStorage) return
    if (e.key !== REFRESH_STORAGE_KEY) return
    // Solo nos interesa la ELIMINACIÓN de la clave (logout/expiración en otra pestaña).
    // Las escrituras (login, rotación) llegan con newValue truthy y se ignoran.
    if (e.newValue !== null) return

    tokens.clear()
    useAuthStore.getState().clearUser()
    // Evita bucle si ya estamos en /login.
    if (!window.location.pathname.startsWith('/login')) {
      window.location.replace('/login')
    }
  })
}
