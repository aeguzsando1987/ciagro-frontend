import { create } from 'zustand'
import type { AuthUser } from '@/types/auth'

interface AuthState {
  user: AuthUser | null
  setUser: (user: AuthUser) => void
  clearUser: () => void
}

/**
 * Store global del usuario autenticado (Zustand).
 *
 * Uso restringido a:
 * - Leer user en componentes que no pueden llamar useCurrentUser (evitar refetch).
 * - clearUser() desde el interceptor de refresh (Tarea 1.16) y el logout (Tarea 1.17),
 *   donde no hay contexto de React y no se puede usar un hook.
 *
 * La fuente de verdad es siempre /users/me/ vía useCurrentUser — el store
 * refleja ese dato, no lo origina.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}))
