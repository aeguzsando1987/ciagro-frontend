/** Selector común; NDVI conserva sus reglas de cálculo, bandas y endpoints originales. */
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/page-header'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { useDataCentralMains } from '@/features/admin/hooks/useDataCentrals'
import { NdviVariablesSection } from '@/features/admin/sections/NdviVariablesSection'
import { LayerVariablesSection } from './LayerVariablesSection'
import type { AppearanceKind } from './useLayerAppearance'

type Tab = 'ndvi' | AppearanceKind
const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'ndvi', label: 'NDVI (índices vegetativos)' },
  { key: 'aspersion', label: 'Aspersión' },
  { key: 'soil_map', label: 'Mapeo de suelo' },
  { key: 'yield_map', label: 'Rendimiento' },
  { key: 'planting_map', label: 'Siembra' },
]

function cachedTenant(key: string) {
  try { return window.sessionStorage.getItem(key) ?? '' } catch { return '' }
}

export function AnalysisVariablesPanel() {
  const user = useAuthStore(s => s.user)
  const { data: organizations = [], isLoading } = useDataCentralMains()
  const available = useMemo(() => user?.role_level != null && user.role_level >= ROLE_LEVELS.SUPER_ADMIN
    ? organizations : organizations.filter(o => o.is_owner), [organizations, user?.role_level])
  // Nunca seleccionar una sesión automáticamente: sin selección no hay catálogo ni capas.
  const [tab, setTab] = useState<Tab | null>(null)
  const storageKey = `ciagro:admin:analysis-org:${user?.id ?? 'anonymous'}`
  const [tenantId, setTenantId] = useState(() => cachedTenant(storageKey))
  useEffect(() => {
    setTenantId(cachedTenant(storageKey))
  }, [storageKey])
  useEffect(() => {
    if (isLoading) return
    if (tenantId && !available.some(o => o.id === tenantId)) {
      setTenantId('')
    } else if (!tenantId && available.length === 1) {
      setTenantId(available[0]!.id)
    }
  }, [tenantId, available, isLoading])
  useEffect(() => {
    if (isLoading || !user?.id) return
    try {
      if (tenantId && available.some(o => o.id === tenantId)) window.sessionStorage.setItem(storageKey, tenantId)
      else window.sessionStorage.removeItem(storageKey)
    } catch { /* SessionStorage puede estar bloqueado: el estado React sigue funcionando. */ }
  }, [storageKey, tenantId, available, user?.id, isLoading])

  const chooseTenant = (id: string) => { setTenantId(id) }
  return <div className="space-y-5">
    <PageHeader title="Variables de análisis" description="Elige organización y tipo de sesión. Los colores y rangos se guardan por organización; NDVI y Fitosanitario mantienen su análisis original." />
    {available.length > 0 && <div className="max-w-xs space-y-1">
      <Label>Organización</Label>
      <Select value={available.some(o=>o.id===tenantId) ? tenantId : ''} onValueChange={chooseTenant}>
        <SelectTrigger><SelectValue placeholder="Selecciona organización" /></SelectTrigger>
        <SelectContent>{available.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
      </Select>
    </div>}
    <nav aria-label="Tipos de sesión para variables de análisis" className="flex flex-wrap gap-2 border-b pb-3">
      {tabs.map(({ key, label }) => <Button key={key} type="button" size="sm"
        aria-current={tab === key ? 'page' : undefined} variant={tab === key ? 'default' : 'outline'}
        onClick={() => setTab(key)}>{label}</Button>)}
      <Button type="button" size="sm" variant="ghost" disabled={!tab} onClick={() => setTab(null)}>Limpiar sesión</Button>
    </nav>
    {!tab ? <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Selecciona un tipo de sesión para mostrar sus capas y variables.</p>
      : !tenantId || !available.some(o=>o.id===tenantId) ? <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Selecciona una organización para consultar sus variables.</p>
      : tab === 'ndvi' ? <NdviVariablesSection tenantId={tenantId} onTenantChange={chooseTenant} hideOrgPicker />
      : <LayerVariablesSection key={`${tab}:${tenantId}`} activeKind={tab} tenantId={tenantId} />}
  </div>
}
