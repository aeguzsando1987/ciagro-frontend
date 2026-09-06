/**
 * Histograma de una capa de suelo (FASE RS, F3, D3).
 *
 * SVG a mano y no una libreria de graficos: el PDF lo dibuja `report_charts.py` en
 * el backend, que no puede correr Recharts. Compartiendo la geometria de
 * `lib/histogram.ts` —espejo de ese modulo— pantalla y papel salen iguales; con una
 * libreria no coincidirian, y un reporte que no cuadra con la app que lo genero
 * pierde credibilidad justo donde se publica.
 *
 * Lo que si es exclusivo de la pantalla: tooltip y seleccion de barra.
 */
import { useState } from 'react'
import {
  histogramGeometry,
  W,
  H,
  PAD_L,
  PAD_R,
  PAD_T,
  FONT,
  type HistogramBar,
  type HistogramBinInput,
} from '../lib/histogram'
import type { SoilHistogram as SoilHistogramData } from '../hooks/useSoilLayerStats'

interface SoilHistogramProps {
  histogram: SoilHistogramData | { bins?: HistogramBinInput[] } | null | undefined
  /** Cortes congelados. Se dibujan `breaks.length` lineas, no siete (H8). */
  breaks?: number[]
  palette?: string[]
  unit?: string
  /** Rango elegido, para que el contenedor filtre. Null al deseleccionar. */
  onSelect?: (range: { lower: number; upper: number } | null) => void
}

function fmt(v: number): string {
  return v.toLocaleString('es-MX', { maximumFractionDigits: 2 })
}

export function SoilHistogram({
  histogram,
  breaks = [],
  palette = [],
  unit = '',
  onSelect,
}: SoilHistogramProps) {
  const [activa, setActiva] = useState<number | null>(null)
  const [elegida, setElegida] = useState<number | null>(null)
  const geo = histogramGeometry(histogram, breaks, palette)

  if (!geo) {
    return <p className="text-sm text-muted-foreground">Sin datos para el histograma.</p>
  }

  const barra = activa !== null ? geo.bars[activa] : null

  const alternar = (b: HistogramBar) => {
    const siguiente = elegida === b.index ? null : b.index
    setElegida(siguiente)
    onSelect?.(
      siguiente === null ? null : { lower: Number(b.bin.lower), upper: Number(b.bin.upper) }
    )
  }

  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Distribución de la capa"
        style={{ fontSize: FONT, fontFamily: 'inherit' }}
      >
        {geo.yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="#e5e5e5" strokeWidth={1} />
            <text x={PAD_L - 6} y={t.y + FONT / 3} textAnchor="end" fill="#333">
              {t.label}
            </text>
          </g>
        ))}

        {geo.bars.map((b) => (
          <rect
            key={b.index}
            x={b.x}
            y={b.y}
            width={b.width}
            height={b.height}
            fill={b.fill}
            stroke={elegida === b.index ? '#000' : '#00000022'}
            strokeWidth={elegida === b.index ? 1.6 : 0.4}
            // Una barra sin altura (bin vacio) no se puede apuntar: el rect mide 0.
            opacity={elegida !== null && elegida !== b.index ? 0.45 : 1}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
            onMouseEnter={() => setActiva(b.index)}
            onMouseLeave={() => setActiva(null)}
            onClick={() => onSelect && alternar(b)}
          />
        ))}

        {geo.breakLines.map((l, i) => (
          <line
            key={i}
            x1={l.x}
            y1={PAD_T}
            x2={l.x}
            y2={geo.axisY}
            stroke="#333"
            strokeWidth={1.2}
            strokeDasharray="4,3"
          />
        ))}

        {geo.curve && (
          <path d={geo.curve} fill="none" stroke="#C00000" strokeWidth={2.2} />
        )}

        <line x1={PAD_L} y1={geo.axisY} x2={W - PAD_R} y2={geo.axisY} stroke="#000" strokeWidth={1.2} />
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={geo.axisY} stroke="#000" strokeWidth={1.2} />
        <text x={PAD_L} y={geo.axisY + FONT + 3} fill="#000">{fmt(geo.lo)}</text>
        <text x={W - PAD_R} y={geo.axisY + FONT + 3} textAnchor="end" fill="#000">{fmt(geo.hi)}</text>
        <text x={W / 2} y={geo.axisY + 2 * FONT + 6} textAnchor="middle" fill="#333">{unit}</text>
        <text x={PAD_L - 6} y={PAD_T - 8} textAnchor="end" fill="#333">{geo.yLabel}</text>
      </svg>

      {/* Tooltip fuera del SVG: en HTML se lee mejor y no hay que recortarlo al viewBox. */}
      <p
        className="h-4 text-xs text-muted-foreground"
        aria-live="polite"
        data-testid="histogram-tooltip"
      >
        {barra
          ? `${fmt(Number(barra.bin.lower))} – ${fmt(Number(barra.bin.upper))}${unit ? ` ${unit}` : ''} · ${fmt(barra.value)} ${geo.yLabel}`
          : ''}
      </p>
    </div>
  )
}
