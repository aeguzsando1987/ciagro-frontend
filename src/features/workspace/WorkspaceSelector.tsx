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
 * - Manager (>= 4)            → ManagerEntry (selector jerárquico si posee/ve orgs,
 *                                aunque no tengan CIAs hijas todavía)
 * - role_level < 4            → BasicEntry (flujo clásico basado en user.datacentrals)
 */
export function WorkspaceSelector() {
  const user = useAuthStore((s) => s.user)
  if (!user) return null
  if (user.role_level >= ROLE_LEVELS.SUPER_ADMIN) return <SuperAdminEntry />
  if (user.role_level >= ROLE_LEVELS.MANAGER) return <ManagerEntry />
  return <BasicEntry />
}

/**
 * Entrada para Gerente (4): si el usuario posee/ve al menos una organización
 * muestra el selector jerárquico (incluso si aún no hay CIAs hijas creadas).
 * Si NO ve ninguna org cae al flujo basado en user.datacentrals (CIAs asignadas
 * por otros owners) o NoAccessScreen.
 */
function ManagerEntry() {
  const user = useAuthStore((s) => s.user)!
  const navigate = useNavigate()
  const datacentrals = user.datacentrals ?? []
  const { data: mains, isLoading } = useDataCentralsMain()

  // Auto-nav: solo si NO posee/ve ninguna org y tiene exactamente 1 CIA asignada.
  useEffect(() => {
    if (isLoading) return
    const noOrgs = (mains?.length ?? 0) === 0
    if (noOrgs && datacentrals.length === 1 && datacentrals[0]) {
      void navigate({ to: '/w/$dc/dashboard', params: { dc: datacentrals[0].id } })
    }
  }, [isLoading, mains, datacentrals, navigate])

  if (isLoading) return <p className="text-muted-foreground">Cargando...</p>

  const hasOrgs = (mains?.length ?? 0) > 0
  if (hasOrgs) return <DataCentralMainSelector />
  if (datacentrals.length === 0) return <NoAccessScreen />
  if (datacentrals.length === 1) return <p className="text-muted-foreground">Redirigiendo...</p>
  return <DataCentralChildSelector datacentrals={datacentrals} />
}

/**
 * Entrada para Supervisor/Tecnico/Guest (<4): selector plano sobre user.datacentrals.
 */
function BasicEntry() {
  const user = useAuthStore((s) => s.user)!
  const navigate = useNavigate()
  const datacentrals = user.datacentrals ?? []

  useEffect(() => {
    if (datacentrals.length === 1 && datacentrals[0]) {
      void navigate({ to: '/w/$dc/dashboard', params: { dc: datacentrals[0].id } })
    }
  }, [datacentrals, navigate])

  if (datacentrals.length === 0) return <NoAccessScreen />
  if (datacentrals.length === 1) return <p className="text-muted-foreground">Redirigiendo...</p>
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
