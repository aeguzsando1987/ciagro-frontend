import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { useAspersionRadar } from '../hooks/useAspersionRadar'
import { AspersionRadarEvaluation } from './AspersionRadarEvaluation'
import type { GeneralSnapshot, StatsSnapshot } from '../types'
import { SessionEvaluationSelector } from './SessionEvaluationSelector'

export function AspersionRadarPanel({ open, onClose, objectId, datacentralId }: {
  open: boolean; onClose: () => void; objectId: string; datacentralId?: string | null
}) {
  const query = useAspersionRadar(objectId, open)
  const canAssociate = useAuthStore(s => (s.user?.role_level ?? 0) >= 3)
  const ciaName = useAuthStore(s => s.user?.datacentrals?.find(dc => dc.id === datacentralId)?.name)
  const general = query.data?.general_snapshot as GeneralSnapshot | undefined
  const stats = query.data?.stats_snapshot as StatsSnapshot | undefined
  const fields = general ? [
    ['Organización', general.organizacion], ['CIAgro', ciaName ?? general.ciagro], ['Productor', general.productor],
    ['Rancho', general.rancho], ['Parcela', general.parcela], ['Fecha', general.fecha_aplicacion],
    ['Producto', general.producto],
    ['Superficie aplicada (suma de puntos)', stats?.area_cobertura_ha != null ? `${Number(stats.area_cobertura_ha).toLocaleString('es-MX', { maximumFractionDigits: 2 })} ha` : null],
    ['Duración de aplicación', stats?.linea_tiempo?.duration_seconds != null ? `${(stats.linea_tiempo.duration_seconds / 3600).toLocaleString('es-MX', { maximumFractionDigits: 2 })} h` : 'No disponible: sin marcas horarias suficientes'],
    ['Estado general', stats?.radar?.status],
  ] : []
  return <Sheet open={open} onOpenChange={value => { if (!value) onClose() }}>
    <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[95vw] xl:max-w-6xl">
      <div className="space-y-2 border-b px-6 py-4 pr-12">
        <SheetTitle>Evaluación de Aspersión — Gráfica radar</SheetTitle>
        <SheetDescription>Análisis de los datos de la sesión. Consultar esta vista no crea un reporte.</SheetDescription>
        <Button size="sm" variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>Actualizar análisis</Button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {query.isLoading && <LoadingState label="Calculando evaluación de aspersión…" />}
        {query.isError && <div role="alert" className="space-y-2 rounded border p-4">
          <p>{query.error.message}</p><Button onClick={() => void query.refetch()}>Reintentar</Button>
        </div>}
        {!query.isError && query.data && <>
          <dl className="grid grid-cols-2 gap-3 rounded border p-4 lg:grid-cols-4">
            {fields.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-sm font-medium">{value || 'No disponible'}</dd></div>)}
          </dl>
          <p className="text-sm text-muted-foreground">Catálogo de evaluación: {general?.catalogo_evaluacion || 'Sin catálogo de evaluación asociado'}
            {general?.catalogo_estado && <span className="ml-2 rounded bg-amber-100 px-2 py-1 text-amber-900">{general.catalogo_estado}</span>}
          </p>
          {general?.catalogo_estado === 'PROVISIONAL' && <p role="note" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            Rango provisional basado en histórico; la calificación es operativa, no una aprobación técnica.
            {general.catalogo_periodo_fuente && <> Fuente: {general.catalogo_procedencia} ({general.catalogo_muestra_sesiones} sesiones, {general.catalogo_periodo_fuente}).</>}
            {general.catalogo_fuera_periodo && <strong className="block">Esta sesión está fuera del periodo de origen del perfil; la comparación histórica informativa permanece sin confirmar.</strong>}
            {general.catalogo_alcance_valido === false && <strong className="block">El perfil no coincide con el alcance verificado y no califica los indicadores.</strong>}
          </p>}
          {canAssociate && <SessionEvaluationSelector objectId={objectId} />}
          {query.data.state === 'not_ready' ? <p role="status">La importación de esta sesión aún no está lista para evaluarse.</p>
            : query.data.state === 'empty' ? <p role="status">Esta sesión no contiene puntos para evaluar.</p>
              : <AspersionRadarEvaluation stats={query.data.stats_snapshot as StatsSnapshot} />}
        </>}
      </div>
    </SheetContent>
  </Sheet>
}
