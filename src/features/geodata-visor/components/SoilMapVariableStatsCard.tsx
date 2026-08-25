/**
 * Estadísticas por variable de una sesión de mapeo de suelo.
 *
 * Sale del mismo endpoint que ya alimenta el combobox del visor
 * (`/soil-map/headers/<id>/variable-stats/`), así que mostrarlas no cuesta una
 * petición nueva: los números ya estaban descargados y se descartaban.
 *
 * Que sea el MISMO endpoint importa por una razón que no es de rendimiento: el
 * visor y cualquier otra pantalla que reporte esta sesión muestran los mismos
 * números, calculados una sola vez en el servidor. Recalcularlos en el cliente
 * sobre los puntos ya cargados daría diferencias de redondeo con los reportes.
 *
 * Las etiquetas y unidades salen de `soilMapLayers.ts`, no del endpoint: el
 * backend devuelve el nombre crudo del modelo ("lim inf CC") y no conoce las
 * unidades.
 */
import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SOIL_MAP_LAYERS } from '@/features/task-manager/lib/soilMapLayers'
import type {
  SoilMapTextVariableStat,
  SoilMapVariableStat,
  SoilMapVariableStatsResponse,
} from '@/features/task-manager/hooks/useSoilMapVariableStats'

interface Props {
  /** Campo del modelo de la capa que se está pintando. */
  activeField: string
  activeLabel: string
  stats: SoilMapVariableStatsResponse | undefined
  isLoading: boolean
}

/** Etiqueta y unidad del catálogo del front, indexadas por campo del modelo. */
const CATALOG = new Map(
  SOIL_MAP_LAYERS.map((layer) => [layer.field as string, { label: layer.label, unit: layer.unit }])
)

function formatValue(value: number | null, unit: string) {
  if (value === null) return '—'
  const formatted = value.toLocaleString('es-MX', { maximumFractionDigits: 2 })
  return unit ? `${formatted} ${unit}` : formatted
}

function labelFor(key: string, fallback: string) {
  return CATALOG.get(key)?.label ?? fallback
}

function unitFor(key: string) {
  return CATALOG.get(key)?.unit ?? ''
}

export function SoilMapVariableStatsCard({ activeField, activeLabel, stats, isLoading }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const activeStat = useMemo<SoilMapVariableStat | null>(
    () => stats?.variables.find((variable) => variable.key === activeField) ?? null,
    [activeField, stats]
  )
  const activeTextStat = useMemo<SoilMapTextVariableStat | null>(
    () => stats?.text_variables.find((variable) => variable.key === activeField) ?? null,
    [activeField, stats]
  )

  const unit = unitFor(activeField)

  return (
    <div className="w-full shrink-0 rounded-md border bg-background/85 shadow-lg backdrop-blur-sm">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((previous) => !previous)}
        className="flex w-full items-center justify-between gap-1 px-2 py-1.5 text-left"
      >
        <h3 className="truncate text-xs font-semibold">Estadísticas · {activeLabel}</h3>
        <span aria-hidden className="shrink-0 text-[10px] text-muted-foreground">
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <div className="border-t px-2 py-1.5">
          {isLoading && <p className="text-[10px] text-muted-foreground">Cargando…</p>}

          {!isLoading && !stats && (
            <p className="text-[10px] text-muted-foreground">No se pudo cargar el resumen.</p>
          )}

          {/* Las categóricas no tienen media ni desviación: una clase textural no
              promedia. Solo se informa cuántos puntos tienen valor. */}
          {!isLoading && stats && activeTextStat && (
            <p className="text-[10px] text-muted-foreground">
              Variable categórica ·{' '}
              <span className="font-medium text-foreground tabular-nums">
                {activeTextStat.count.toLocaleString('es-MX')}
              </span>{' '}
              puntos con valor
            </p>
          )}

          {!isLoading && stats && activeStat && (
            <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
              <div className="flex justify-between gap-1">
                <dt>Media</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {formatValue(activeStat.mean, unit)}
                </dd>
              </div>
              <div className="flex justify-between gap-1">
                <dt>Desv.</dt>
                <dd className="tabular-nums">{formatValue(activeStat.stddev, unit)}</dd>
              </div>
              <div className="flex justify-between gap-1">
                <dt>Mín</dt>
                <dd className="tabular-nums">{formatValue(activeStat.min, unit)}</dd>
              </div>
              <div className="flex justify-between gap-1">
                <dt>Máx</dt>
                <dd className="tabular-nums">{formatValue(activeStat.max, unit)}</dd>
              </div>
              <div className="col-span-2 flex justify-between gap-1">
                <dt>Puntos con valor</dt>
                <dd className="tabular-nums">{activeStat.count.toLocaleString('es-MX')}</dd>
              </div>
            </dl>
          )}

          {!isLoading && stats && !activeStat && !activeTextStat && (
            <p className="text-[10px] text-muted-foreground">
              Esta variable no tiene valores en la sesión.
            </p>
          )}

          {!isLoading && stats && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-1.5 w-full rounded border px-2 py-1 text-[10px] font-medium hover:bg-muted"
            >
              Ver todas las variables
            </button>
          )}
        </div>
      )}

      {/* La tabla completa va en un diálogo y no en la columna: son 53 variables por
          6 columnas y la columna del visor mide 224 px. */}
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Resumen estadístico de la sesión</DialogTitle>
            <DialogDescription>
              {stats ? `${stats.points_count.toLocaleString('es-MX')} puntos importados.` : ''}{' '}
              Calculado sobre los puntos de esta sesión.
            </DialogDescription>
          </DialogHeader>

          {stats && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3 font-medium">Variable</th>
                    <th className="px-2 py-1 text-right font-medium">Media</th>
                    <th className="px-2 py-1 text-right font-medium">Mín</th>
                    <th className="px-2 py-1 text-right font-medium">Máx</th>
                    <th className="px-2 py-1 text-right font-medium">Desv.</th>
                    <th className="py-1 pl-2 text-right font-medium">n</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.variables.map((variable) => (
                    <tr key={variable.key} className="border-t">
                      <td className="py-1 pr-3">
                        {labelFor(variable.key, variable.label)}
                        {unitFor(variable.key) && (
                          <span className="ml-1 text-muted-foreground">
                            ({unitFor(variable.key)})
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-right font-medium tabular-nums">
                        {formatValue(variable.mean, '')}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {formatValue(variable.min, '')}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {formatValue(variable.max, '')}
                      </td>
                      <td className="px-2 py-1 text-right tabular-nums">
                        {formatValue(variable.stddev, '')}
                      </td>
                      <td className="py-1 pl-2 text-right tabular-nums text-muted-foreground">
                        {variable.count.toLocaleString('es-MX')}
                      </td>
                    </tr>
                  ))}
                  {/* Las categóricas cierran la tabla con solo su conteo, para que el
                      resumen de la sesión no las deje fuera. */}
                  {stats.text_variables.map((variable) => (
                    <tr key={variable.key} className="border-t">
                      <td className="py-1 pr-3">{labelFor(variable.key, variable.label)}</td>
                      <td colSpan={4} className="px-2 py-1 text-right text-muted-foreground">
                        categórica
                      </td>
                      <td className="py-1 pl-2 text-right tabular-nums text-muted-foreground">
                        {variable.count.toLocaleString('es-MX')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
