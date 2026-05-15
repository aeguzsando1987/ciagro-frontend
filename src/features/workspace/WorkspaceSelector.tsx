import { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { DataCentralMainSelector } from './DataCentralMainSelector'
import { DataCentralChildSelector } from './DataCentralChildSelector'
import { NoAccessScreen } from './NoAccessScreen'

/**
 * Selector de workspace con bifurcacion por role_level (Paso 1.3 product-doc):
 * - datacentrals.length === 0 → NoAccessScreen
 * - datacentrals.length === 1 → auto-navega a /w/<id>/dashboard
 * - role_level >= 4           → DataCentralMainSelector (Gerente/SuperAdmin)
 * - role_level < 4            → DataCentralChildSelector directo (Supervisor/Tecnico/Guest)
 */
export function WorkspaceSelector() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const datacentrals = user?.datacentrals ?? []

  // Auto-seleccion si solo hay una DC asignada
  useEffect(() => {
    if (datacentrals.length === 1 && datacentrals[0]) {
      void navigate({ to: '/w/$dc/dashboard', params: { dc: datacentrals[0].id } })
    }
  }, [datacentrals, navigate])

  if (!user) return null

  if (datacentrals.length === 0) return <NoAccessScreen />

  if (datacentrals.length === 1) {
    return <p className="text-muted-foreground">Redirigiendo...</p>
  }

  if (user.role_level >= ROLE_LEVELS.MANAGER) {
    return <DataCentralMainSelector />
  }

  return <DataCentralChildSelector datacentrals={datacentrals} />
}
