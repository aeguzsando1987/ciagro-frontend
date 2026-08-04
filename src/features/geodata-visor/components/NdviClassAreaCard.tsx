/**
 * Superficie por clase del indice activo, en hectareas.
 *
 * Histograma de columnas verticales: eje x los rangos de clase, eje y las hectareas. Cada
 * columna lleva el color de SU clase, el mismo del mapa, para que leyenda e histograma se
 * lean como una sola cosa.
 *
 * Con nueve o mas clases no cabe una etiqueta por columna sin que choquen, asi que las
 * etiquetas del eje x se ralean (siempre la primera y la ultima) y el detalle exacto de
 * cada columna -rango, hectareas, % de area y puntos- se lee en la linea de lectura al
 * pasar el cursor. El texto usa tokens de texto y nunca el color de la serie.
 *
 * "Sin clase" no entra como columna: el eje x es una escala de valores del indice y meter
 * ahi una barra sin rango la falsearia. Va en el desglose de abajo, donde el area queda
 * igualmente contabilizada.
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatHa } from '../lib/aspersionMap.helpers'
import { niceAxisTicks, readableTextColor } from '../lib/chartScale'
import { formatBandRange, type NdviClassArea, type NdviClassAreaSummary } from '../lib/ndviClassArea'

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
   * clase recibe ~1/n del area POR CONSTRUCCION y las columnas salen casi iguales. Se
   * avisa para que nadie lea como hallazgo lo que es un artefacto del metodo.
   */
  equalAreaByConstruction?: boolean
}

/**
 * Alto del area de trazado, en px. Se subio de 84 a 128 al añadir marcas intermedias y
 * etiquetas dentro de las barras: con menos alto no cabian ni unas ni otras.
 */
const CHART_HEIGHT = 128

/** Alto minimo de barra para escribir area y porcentaje dentro; por debajo, solo el area. */
const LABEL_TWO_LINES_PX = 30
/** Alto minimo de barra para escribir algo dentro. Por debajo el dato se lee al pasar el cursor. */
const LABEL_ONE_LINE_PX = 15
/** Mas columnas que esto y no hay ancho para etiquetas dentro de la barra. */
const MAX_CLASSES_WITH_INNER_LABELS = 10

function pctText(value: number): string {
  return `${value.toLocaleString('es-MX', { maximumFractionDigits: 1 })}%`
}

/**
 * Porcentaje para escribir DENTRO de la barra, donde hay ~23 px de ancho: se redondea a
 * entero a partir del 10% ("17%" en vez de "17.4%") y solo se conserva un decimal en los
 * valores pequeños, donde el decimal es la informacion.
 */
function pctCompact(value: number): string {
  return value >= 10 ? `${Math.round(value)}%` : pctText(value)
}

/**
 * Decimales minimos para que las marcas del eje x no se repitan: con clases de 0.1 basta
 * uno, con clases de 0.05 hacen falta dos.
 */
function edgeDecimals(classes: NdviClassArea[]): number {
  const bounds = classes.map((c) => c.min).filter((v): v is number => v !== null)
  return bounds.some((v) => Math.abs(v * 10 - Math.round(v * 10)) > 1e-9) ? 2 : 1
}

/** Marca del eje x: el limite inferior de la clase, que es donde empieza su columna. */
function edgeLabel(min: number | null, decimals: number): string {
  return min === null ? '−∞' : min.toFixed(decimals)
}

/**
 * Cada cuantas columnas se escribe una marca. Por debajo de ~22 px por columna las
 * etiquetas se tocan, asi que se ralean en vez de rotarlas o recortarlas.
 */
function labelStep(count: number): number {
  if (count <= 6) return 1
  if (count <= 12) return 2
  return Math.ceil(count / 6)
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
  const [hovered, setHovered] = useState<number | null>(null)

  // Eje y con marcas intermedias en valores redondos: con solo 0 y el maximo no se puede
  // estimar cuanto vale una barra a media altura.
  const maxAreaHa = Math.max(0, ...classes.map((c) => c.areaHa))
  const { axisMax, ticks } = niceAxisTicks(maxAreaHa)
  const decimals = edgeDecimals(classes)
  const step = labelStep(classes.length)
  const innerLabels = classes.length <= MAX_CLASSES_WITH_INNER_LABELS

  /**
   * Superficie de la parcela que quedo SIN medir: la que el casco convexo de los puntos
   * no alcanza. null cuando lo medido excede el area declarada, caso en el que restar
   * daria un negativo sin sentido y lo que conviene es avisar de la inconsistencia.
   */
  const unmeasuredAreaHa =
    plotAreaHa != null && plotAreaHa > coveredAreaHa ? plotAreaHa - coveredAreaHa : null

  const active = hovered != null ? classes[hovered] : null

  return (
    <div className="w-[272px] rounded-md bg-white/90 shadow">
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
        <div className="border-t px-2 pb-2 pt-2">
          <div className="flex gap-1">
            {/* Eje y: unidad arriba y marcas en valores redondos, alineadas a su altura. */}
            <div className="w-8 shrink-0">
              <div className="text-right text-[9px] font-medium leading-none text-gray-500">Ha</div>
              <div className="relative mt-0.5" style={{ height: CHART_HEIGHT }}>
                {ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute right-0 -translate-y-1/2 text-[9px] tabular-nums leading-none text-gray-500"
                    style={{ bottom: axisMax > 0 ? `${(t / axisMax) * 100}%` : '0%' }}
                  >
                    {formatHa(t)}
                  </span>
                ))}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              {/* Reserva del alto de la etiqueta "Ha" para que ambas columnas se alineen. */}
              <div className="h-[9px]" />
              <div className="relative mt-0.5" style={{ height: CHART_HEIGHT }}>
                {/* Retícula discreta: da referencia sin competir con las columnas. */}
                {ticks.map((t) => (
                  <div
                    key={t}
                    className="absolute inset-x-0 border-t border-dashed border-gray-200"
                    style={{ bottom: axisMax > 0 ? `${(t / axisMax) * 100}%` : '0%' }}
                  />
                ))}
                <div className="relative flex h-full items-end gap-[2px]">
                  {classes.map((c, i) => {
                    const barPx = axisMax > 0 ? (c.areaHa / axisMax) * CHART_HEIGHT : 0
                    const showTwoLines = innerLabels && barPx >= LABEL_TWO_LINES_PX
                    const showOneLine = innerLabels && !showTwoLines && barPx >= LABEL_ONE_LINE_PX
                    return (
                      <div
                        key={c.order}
                        className="flex h-full flex-1 items-end"
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                        title={`${formatBandRange(c.min, c.max)}: ${formatHa(c.areaHa)} ha · ${pctText(c.pctArea)} del área · ${c.pointCount} puntos`}
                      >
                        <div
                          className="flex w-full flex-col items-center justify-start overflow-hidden rounded-t-[2px] pt-0.5 transition-opacity"
                          style={{
                            height: `${barPx}px`,
                            backgroundColor: c.color,
                            // Resaltar la columna apuntada atenuando las demas.
                            opacity: hovered === null || hovered === i ? 1 : 0.45,
                          }}
                        >
                          {/* Etiquetado directo solo donde cabe: en las barras bajas el dato
                              se lee en la linea de lectura al pasar el cursor. */}
                          {(showTwoLines || showOneLine) && (
                            <span
                              className="text-[8px] font-medium leading-tight tabular-nums"
                              style={{ color: readableTextColor(c.color) }}
                            >
                              {formatHa(c.areaHa)}
                            </span>
                          )}
                          {showTwoLines && (
                            <span
                              className="text-[8px] leading-tight tabular-nums opacity-90"
                              style={{ color: readableTextColor(c.color) }}
                            >
                              {pctCompact(c.pctArea)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Eje x */}
              <div className="border-t border-gray-300" />
              <div className="flex gap-[2px]">
                {classes.map((c, i) => (
                  <span
                    key={c.order}
                    className="min-w-0 flex-1 truncate text-center text-[9px] tabular-nums text-gray-500"
                  >
                    {i % step === 0 || i === classes.length - 1
                      ? edgeLabel(c.min, decimals)
                      : ' '}
                  </span>
                ))}
              </div>
              <p className="mt-0.5 text-center text-[9px] text-gray-400">rango del índice</p>
            </div>
          </div>

          {/* Linea de lectura: el detalle de la columna apuntada, o el total si no hay. */}
          <p className="mt-1 truncate border-t pt-1 text-[10px] text-gray-600">
            {active ? (
              <>
                <span className="tabular-nums">{formatBandRange(active.min, active.max)}</span>
                {' · '}
                <span className="font-medium tabular-nums text-gray-800">
                  {formatHa(active.areaHa)} ha
                </span>
                {' · '}
                <span className="tabular-nums">{pctText(active.pctArea)}</span>
                {' · '}
                <span className="tabular-nums">{active.pointCount} pts</span>
              </>
            ) : (
              <span className="text-gray-400">Pasa el cursor por una columna para el detalle</span>
            )}
          </p>

          <dl className="mt-1 space-y-0.5 border-t pt-1 text-[10px] text-gray-500">
            {outsideAreaHa > 0 && (
              <div className="flex justify-between gap-1">
                <dt>Sin clase</dt>
                <dd className="tabular-nums">
                  {formatHa(outsideAreaHa)} ha ({pctText(pctOutside)})
                </dd>
              </div>
            )}
            {plotAreaHa != null && (
              <>
                <div className="flex justify-between gap-1">
                  <dt>Parcela</dt>
                  <dd className="tabular-nums">{formatHa(plotAreaHa)} ha</dd>
                </div>
                <div className="flex justify-between gap-1">
                  <dt>Medido</dt>
                  <dd className="tabular-nums">{formatHa(coveredAreaHa)} ha</dd>
                </div>
                {unmeasuredAreaHa != null ? (
                  <div className="flex justify-between gap-1 font-medium text-gray-700">
                    <dt>Sin medir</dt>
                    <dd className="tabular-nums">
                      {formatHa(unmeasuredAreaHa)} ha ({pctText((unmeasuredAreaHa / plotAreaHa) * 100)})
                    </dd>
                  </div>
                ) : (
                  /* La nube de muestras desborda el area declarada de la parcela: no hay
                     "sin medir" que reportar, y el dato a revisar es el otro. */
                  <p className="pt-0.5 leading-snug text-amber-700">
                    Lo medido excede el área declarada de la parcela; revisa su superficie.
                  </p>
                )}
              </>
            )}
          </dl>

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
