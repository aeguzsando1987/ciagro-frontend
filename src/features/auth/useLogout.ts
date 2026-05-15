import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { tokens } from '@/lib/auth/tokens'
import { queryClient } from '@/lib/queryClient'
import { useAuthStore } from './useAuthStore'

// POST /api/v1/auth/logout/
async function logoutRequest(refresh: string): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL
  await fetch(`${baseUrl}/auth/logout/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.getAccess() ?? ''}`,
    },
    body: JSON.stringify({ refresh }),
  })
  // No lanzar error aunque el backend falle — el token local se limpia siempre.
}

/**
 * Mutacion de logout (Paso 1.10 product-doc).
 * onSettled (no onSuccess): la limpieza local ocurre siempre, incluso si el
 * backend falla al blacklistear el refresh. Evita sesiones zombi en cliente.
 */
export function useLogout() {
  const navigate = useNavigate()
  const clearUser = useAuthStore((s) => s.clearUser)

  return useMutation({
    mutationFn: () => logoutRequest(tokens.getRefresh() ?? ''),
    onSettled: () => {
      tokens.clear()
      clearUser()
      queryClient.clear()
      void navigate({ to: '/login' })
    },
  })
}
