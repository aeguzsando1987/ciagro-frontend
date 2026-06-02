import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'
import { useAuthStore } from './useAuthStore'
import type { AuthUser, WorkspaceDataCentral } from '@/types/auth'

/** Shape cruda que devuelve GET /api/v1/users/me/ */
interface MeResponse {
  id: string
  username: string
  email: string
  user_role: { role_name: string; level: number }
  requires_password_change?: boolean
  datacentrals: WorkspaceDataCentral[]
}

// GET /api/v1/users/me/
export async function fetchCurrentUser(): Promise<AuthUser> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL
  const res = await fetch(`${baseUrl}/users/me/`, {
    headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` },
  })
  if (!res.ok) throw new Error('No se pudo obtener el perfil del usuario')

  const data = (await res.json()) as MeResponse

  // Aplanamos user_role para que AuthUser sea simple de consumir en componentes
  return {
    id: data.id,
    username: data.username,
    email: data.email,
    role_name: data.user_role.role_name,
    role_level: data.user_role.level,
    requires_password_change: data.requires_password_change ?? false,
    datacentrals: data.datacentrals,
  }
}

/**
 * Carga el perfil del usuario autenticado desde GET /api/v1/users/me/.
 * Deshabilitado si no hay access token en memoria.
 * Al recibir datos, sincroniza con useAuthStore para acceso fuera de React.
 */
export function useCurrentUser() {
  const setUser = useAuthStore((s) => s.setUser)

  const query = useQuery({
    queryKey: ['me'],
    queryFn: fetchCurrentUser,
    enabled: !!tokens.getAccess(),
    staleTime: 60_000,
  })

  // useEffect (no select) para el side-effect: TanStack Query v5 eliminó
  // onSuccess de useQuery. useEffect solo corre cuando data cambia.
  useEffect(() => {
    if (query.data) setUser(query.data)
  }, [query.data, setUser])

  return query
}
