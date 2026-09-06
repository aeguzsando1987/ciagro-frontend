/**
 * Selector de capa del reporteador de suelo (FASE RS, F2).
 *
 * Los grupos y su orden salen del CATALOGO DEL BACKEND, no de `soilMapLayers.ts`:
 * la agrupacion del reporte sigue D5 y diverge a proposito de la del visor. Que una
 * capa tenga datos lo dice `variable-stats`, cruzando por `field` y no por `key`
 * (coinciden, pero depender de esa coincidencia seria fragil).
 *
 * `<select>` nativo con `<optgroup>`, igual que el visor: agrupa sin librería.
 */
import { useMemo } from 'react'
import {
  buildLayerCountMap,
  useSoilMapVariableStats,
} from '@/features/task-manager/hooks/useSoilMapVariableStats'
import { useSoilLayerCatalog, type SoilLayerMeta } from '../hooks/useSoilLayerCatalog'

interface SoilLayerPickerProps {
  /** UUID de la cabecera de mapeo de suelo. */
  headerId: string
  value: string | null
  onChange: (layerKey: string) => void
  disabled?: boolean
  /** Capas ya preparadas: se marcan para no tener que abrirlas una por una. */
  preparedLayers?: string[]
}

/** Grupos con al menos una capa con datos, en el orden del catalogo. */
export function useSoilLayerOptions(headerId: string) {
  const { data: catalog, isLoading: cargandoCatalogo } = useSoilLayerCatalog()
  const { data: stats, isLoading: cargandoStats } = useSoilMapVariableStats(headerId)

  return useMemo(() => {
    const counts = buildLayerCountMap(stats)
    const groups = (catalog?.groups ?? [])
      .map((g) => ({
        group: g.group,
        layers: g.layers.filter((l) => (counts.get(l.field) ?? 0) > 0),
      }))
      .filter((g) => g.layers.length > 0)
    return {
      groups,
      /** Aplanado en orden de despliegue: define la primera capa por defecto. */
      layers: groups.flatMap((g) => g.layers),
      isLoading: cargandoCatalogo || cargandoStats,
    }
  }, [catalog, stats, cargandoCatalogo, cargandoStats])
}

export function SoilLayerPicker({
  headerId,
  value,
  onChange,
  disabled,
  preparedLayers = [],
}: SoilLayerPickerProps) {
  const { groups, layers, isLoading } = useSoilLayerOptions(headerId)
  const listas = new Set(preparedLayers)

  // Un desplegable vacio se leeria como "esta sesion no tiene capas". Mientras la
  // respuesta no llega se dice que carga; si llega vacia, se dice eso mismo.
  if (isLoading) {
    return (
      <select disabled aria-label="Capa del reporte" className={SELECT_CLASS}>
        <option>Cargando capas…</option>
      </select>
    )
  }
  if (layers.length === 0) {
    return <p className="text-sm text-muted-foreground">La sesión no tiene capas con datos.</p>
  }

  return (
    <select
      aria-label="Capa del reporte"
      className={SELECT_CLASS}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {value === null && <option value="">Selecciona una capa…</option>}
      {groups.map((g) => (
        <optgroup key={g.group} label={g.group}>
          {g.layers.map((l) => (
            <option key={l.key} value={l.key}>
              {/* El check dice cuales ya tienen mapa y clases listos, para no
                  tener que abrirlas una por una a ver cual falta. */}
              {listas.has(l.key) ? '✓ ' : ''}
              {optionLabel(l)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}

/** La unidad va en la etiqueta: sin ella "40.5" no dice si son % o ppm. */
function optionLabel(layer: SoilLayerMeta): string {
  return layer.unit ? `${layer.label} (${layer.unit})` : layer.label
}

const SELECT_CLASS =
  'h-8 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm ' +
  'outline-none focus:ring-2 focus:ring-ring disabled:opacity-60'
