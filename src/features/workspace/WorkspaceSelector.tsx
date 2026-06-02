import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { DataCentralMainSelector } from './DataCentralMainSelector'
import { DataCentralChildSelector } from './DataCentralChildSelector'
import { NoAccessScreen } from './NoAccessScreen'
import { FirstUseWizard } from './FirstUseWizard'
import { useDataCentralsMain } from './useDataCentralsMain'

/**
 * Selector de workspace con bifurcacion por role_level (Paso 1.3 product-doc):
 * - SuperAdmin (>= 5)         → SuperAdminEntry (wizard de primer uso o selector)
 * - datacentrals.length === 0 → NoAccessScreen
 * - datacentrals.length === 1 → auto-navega a /w/<id>/dashboard
 * - role_level >= 4           → DataCentralMainSelector (Gerente)
 * - role_level < 4            → DataCentralChildSelector directo (Supervisor/Tecnico/Guest)
 */
export function WorkspaceSelector() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  const datacentrals = user?.datacentrals ?? []

  // Auto-seleccion si solo hay una DC asignada. No aplica a SuperAdmin: este pasa
  // por SuperAdminEntry (wizard/selector) aunque solo exista una DC en el sistema.
  useEffect(() => {
    if (!user || user.role_level >= ROLE_LEVELS.SUPER_ADMIN) return
    if (datacentrals.length === 1 && datacentrals[0]) {
      void navigate({ to: '/w/$dc/dashboard', params: { dc: datacentrals[0].id } })
    }
  }, [user, datacentrals, navigate])

  if (!user) return null

  if (user.role_level >= ROLE_LEVELS.SUPER_ADMIN) return <SuperAdminEntry />

  if (datacentrals.length === 0) return <NoAccessScreen />

  if (datacentrals.length === 1) {
    return <p className="text-muted-foreground">Redirigiendo...</p>
  }

  if (user.role_level >= ROLE_LEVELS.MANAGER) {
    return <DataCentralMainSelector />
  }

  return <DataCentralChildSelector datacentrals={datacentrals} />
}

/**
 * Entrada para SuperAdmin: si el sistema no tiene ninguna organización muestra el
 * wizard de primer uso; en caso contrario, el selector jerárquico normal. La decisión
 * se fija una sola vez (mode) para que crear la primera org dentro del wizard no lo
 * desmonte a mitad de camino.
 */
function SuperAdminEntry() {
  const queryClient = useQueryClient()
  const { data: mains, isLoading } = useDataCentralsMain()
  const [mode, setMode] = useState<'auto' | 'wizard' | 'selector'>('auto')

  useEffect(() => {
    if (isLoading || mode !== 'auto' || !mains) return
    setMode(mains.length === 0 ? 'wizard' : 'selector')
  }, [isLoading, mains, mode])

  if (mode === 'auto' || isLoading) {
    return <p className="text-muted-foreground">Cargando...</p>
  }

  if (mode === 'wizard') {
    return (
      <FirstUseWizard
        onExit={() => {
          // El wizard crea orgs/CIAs vía los hooks admin (otra query key); refrescamos
          // las del workspace para que el selector y /me reflejen lo recién creado.
          void queryClient.invalidateQueries({ queryKey: ['data-centrals-main'] })
          void queryClient.invalidateQueries({ queryKey: ['me'] })
          setMode('selector')
        }}
      />
    )
  }

  return <DataCentralMainSelector />
}
