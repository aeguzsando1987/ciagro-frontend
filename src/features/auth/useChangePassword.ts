import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { tokens } from '@/lib/auth/tokens'
import { queryClient } from '@/lib/queryClient'
import type { ChangePasswordFormValues } from './changePasswordSchema'

// POST /api/v1/auth/change-password/
async function changePasswordRequest(values: ChangePasswordFormValues): Promise<void> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL
  const res = await fetch(`${baseUrl}/auth/change-password/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.getAccess() ?? ''}`,
    },
    body: JSON.stringify(values),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const detail =
      (data as Record<string, unknown>)['old_password'] ??
      (data as Record<string, unknown>)['new_password'] ??
      (data as Record<string, unknown>)['detail'] ??
      'Error al cambiar la contraseña'
    throw new Error(Array.isArray(detail) ? String(detail[0]) : String(detail))
  }
}

/**
 * Mutación de cambio de contraseña forzado (Paso 1.2 product-doc).
 * Al éxito invalida la query ['me'] para que useCurrentUser recargue el perfil
 * con requires_password_change=false, desbloqueando las rutas protegidas.
 */
export function useChangePassword() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: changePasswordRequest,
    onSuccess: async () => {
      // Forzar recarga de /users/me/ para que requires_password_change sea false
      await queryClient.invalidateQueries({ queryKey: ['me'] })
      void navigate({ to: '/workspaces' })
    },
  })
}
