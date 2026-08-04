/**
 * Superficie por clase del indice activo, en hectareas.
 *
 * Barras horizontales y no columnas verticales por el sitio que ocupa: la tarjeta vive
 * flotando en una esquina del mapa y puede haber nueve o mas clases con etiquetas del tipo
 * "0.70 - 0.80". En vertical esas etiquetas chocan o hay que rotarlas; en horizontal la
 * etiqueta va a la izquierda de su barra y se lee sin girar la cabeza. Es el mismo patron
 * que SoilMapStatsCard.
 *
 * Cada barra lleva el color de SU clase, el mismo del mapa, para que leyenda e histograma
 * se lean como una sola cosa. El valor en hectareas va escrito en cada fila (etiquetado
 * directo), asi que no hace falta leyenda aparte; el texto usa tokens de texto y nunca el
 * color de la serie.
 */
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatHa } from '../lib/aspersionMap.helpers'
import { formatBandRange, type NdviClassAreaSummary } from '../lib/ndviClassArea'

interface NdviClassAreaCardProps {
  summary: NdviClassAreaSummary
  /** Nombre del indice activo, para el encabezado. */
  indexLabel: string
  open: boolean
  onToggle: () => void
  /** Area total de la parcela, si se conoce: contraste con lo realmente medido. */
  plotAreaHa?: number | null
  /**
   * En modo cuartiles los cortes se recalculan desde la propia superficie, asi que cada
   * clase recibe ~1/n del area POR CONSTRUCCION y las barras salen casi iguales. Se avisa
   * para que nadie lea como hallazgo lo que es un artefacto del metodo.
   */
  equalAreaByConstruction?: boolean
}

function pctText(value: number): string {
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`
}

export function NdviClassAreaCard({
  summary,
  indexLabel,
  open,
  onToggle,
  plotAreaHa,
  equalAreaByConstruction = false,
}: NdviClassAreaCardProps) {
  const { classes, coveredAreaHa, outsideAreaHa, pctOutside } = summary
  // Escala de las barras: la clase mayor llena el ancho. Con el maximo a 0 no se divide.
  const maxAreaHa = Math.max(outsideAreaHa, ...classes.map((c) => c.areaHa))

  return (
    <div className="w-[232px] rounded-md bg-white/90 shadow">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? 'Ocultar superficie por clase' : 'Mostrar superficie por clase'}
        className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left hover:bg-black/5"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-gray-700">
            Superficie por clase
          </span>
          <span className="block truncate text-[10px] text-gray-500">
            {indexLabel} · {formatHa(coveredAreaHa)} ha medidas
          </span>
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
        ) : (
          <ChevronUp className="h-4 w-4 shrink-0 text-gray-500" />
        )}
      </button>

      {open && (
        <div className="border-t px-2 pb-2 pt-1.5">
          <ul className="space-y-1">
            {classes.map((c) => (
              <li key={c.order} title={`${c.label}: ${pctText(c.pctArea)} del area · ${c.pointCount} puntos`}>
                <div className="flex items-baseline justify-between gap-1 text-[10px] text-gray-600">
                  <span className="truncate tabular-nums">{formatBandRange(c.min, c.max)}</span>
                  <span className="shrink-0 tabular-nums font-medium text-gray-800">
                    {formatHa(c.areaHa)} ha
                  </span>
                </div>
                <div className="mt-0.5 h-2 w-full overflow-hidden rounded-sm bg-gray-200/70">
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: maxAreaHa > 0 ? `${(c.areaHa / maxAreaHa) * 100}%` : '0%',
                      backgroundColor: c.color,
                    }}
                  />
                </div>
              </li>
            ))}

            {outsideAreaHa > 0 && (
              <li title={`Sin clase: ${pctText(pctOutside)} del area`}>
                <div className="flex items-baseline justify-between gap-1 text-[10px] text-gray-500">
                  <span className="truncate">Sin clase</span>
                  <span className="shrink-0 tabular-nums">{formatHa(outsideAreaHa)} ha</span>
                </div>
                <div className="mt-0.5 h-2 w-full overflow-hidden rounded-sm bg-gray-200/70">
                  <div
                    className="h-full rounded-sm bg-gray-400"
                    style={{ width: maxAreaHa > 0 ? `${(outsideAreaHa / maxAreaHa) * 100}%` : '0%' }}
                  />
                </div>
              </li>
            )}
          </ul>

          {plotAreaHa != null && (
            <p className="mt-1.5 border-t pt-1 text-[10px] text-gray-500">
              Parcela: {formatHa(plotAreaHa)} ha · medido {formatHa(coveredAreaHa)} ha
            </p>
          )}

          {equalAreaByConstruction && (
            <p className="mt-1 text-[10px] leading-snug text-amber-700">
              En modo automático los cortes salen de la propia superficie, así que las clases
              reparten el área casi por igual por construcción.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
