/**
 * Tarjeta de cabecera del reporte: datos denormalizados (`general_snapshot`) + estadísticos
 * (`stats_snapshot`) + semáforo. Estructura según el use case (flujo 4). Solo lectura: estos
 * datos los calcula el backend (adapter) y se refrescan con "Sincronizar", no editando texto.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SessionReport, StatsVariable } from '../types'
import { generalSnapshotOf, statsSnapshotOf } from '../types'
import { SemaforoBadges } from './SemaforoBadges'

function num(v: number | string | null | undefined, digits = 2): string {
  if (v === null || v === undefined || v === '') return '—'
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n.toLocaleString('es-MX', { maximumFractionDigits: digits }) : '—'
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium">{value ?? '—'}</dd>
    </div>
  )
}

function VariableRow({ label, v }: { label: string; v?: StatsVariable }) {
  if (!v) return null
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">
        {num(v.avg)} <span className="text-xs text-muted-foreground">prom</span>
        <span className="mx-1 text-muted-foreground">·</span>
        {num(v.min)}–{num(v.max)} {v.unit}
      </span>
    </li>
  )
}

export function ReportCard({ report }: { report: SessionReport }) {
  const g = generalSnapshotOf(report)
  const s = statsSnapshotOf(report)
  const proporcion =
    s.proporcion_meta && s.proporcion_meta.length > 0
      ? s.proporcion_meta.map((p) => num(p)).join(' · ')
      : '—'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {report.activity_label || g.actividad || 'Reporte de actividad'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          <Field label="Agricultor" value={g.productor} />
          <Field label="Granja" value={g.rancho} />
          <Field label="Parcela" value={g.parcela} />
          <Field label="Cultivo" value={g.cultivo} />
          <Field label="Área parcela (ha)" value={num(g.superficie_parcela_ha)} />
          <Field label="Ubicación" value={g.ubicacion} />
          <Field label="Fecha de aplicación" value={g.fecha_aplicacion} />
          <Field label="Proporción meta" value={proporcion} />
        </dl>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-3">
          <Field label="Puntos" value={num(s.points_count, 0)} />
          <Field label="Área de cobertura (ha)" value={num(s.area_cobertura_ha)} />
          <Field label="Dosis promedio (L/ha)" value={num(s.dosis_promedio_l)} />
          <Field label="Volumen total (L)" value={num(s.volumen_total_l)} />
          <Field label="Fecha inicio" value={s.fecha_inicio} />
          <Field label="Fecha fin" value={s.fecha_fin} />
        </dl>

        {s.variables && (
          <div className="border-t pt-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Variables</p>
            <ul className="space-y-1">
              <VariableRow label="Velocidad" v={s.variables.velocidad} />
              <VariableRow label="Flujo líquido" v={s.variables.flujo_liquido} />
              <VariableRow label="Presión" v={s.variables.presion} />
            </ul>
          </div>
        )}

        <div className="border-t pt-3">
          <SemaforoBadges stats={s} />
        </div>
      </CardContent>
    </Card>
  )
}
