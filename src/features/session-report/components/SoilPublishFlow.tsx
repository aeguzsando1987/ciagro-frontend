/**
 * Eleccion de las capas del entregable (FASE RS, R4).
 *
 * PREPARAR NO ES PUBLICAR. Las capas se preparan solas al abrirlas en el panel
 * —calcular el raster y mostrarlo es el mismo trabajo—, asi que aqui solo se elige
 * cuales de ellas salen en el PDF y en el KMZ. Sin esa separacion, hojear el
 * selector metia paginas al entregable.
 *
 * Una capa marcada que aun no este preparada se prepara aqui mismo, para no obligar
 * a abrirlas una por una.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { useSetPublishedLayers } from '../hooks/useFreezeSoilLayer'
import { useSoilLayerPreparation } from '../hooks/useSoilLayerPreparation'
import { useSoilLayerOptions } from './SoilLayerPicker'
import type { SessionType } from '../types'

interface SoilPublishFlowProps {
  reportId: string
  sessionType: SessionType
  objectId: string
  plotId: string | null
  canWrite: boolean
  /** Capas ya preparadas (con mapa y clases listos). */
  preparedLayers: string[]
  /** Capas elegidas hoy para el entregable. */
  publishedLayers: string[]
  disabled?: boolean
}

export function SoilPublishFlow({
  reportId,
  sessionType,
  objectId,
  plotId,
  canWrite,
  preparedLayers,
  publishedLayers,
  disabled,
}: SoilPublishFlowProps) {
  const { groups, layers, isLoading } = useSoilLayerOptions(objectId)
  const [elegidas, setElegidas] = useState<Set<string>>(new Set(publishedLayers))

  const setPublished = useSetPublishedLayers(reportId, sessionType, objectId)
  const preparacion = useSoilLayerPreparation({
    reportId,
    sessionType,
    objectId,
    plotId,
    kindOf: (key) => layers.find((l) => l.key === key)?.kind,
    // Al terminar de preparar lo que faltaba, se fija la seleccion con las que
    // efectivamente quedaron listas: las llega por parametro y no por estado,
    // porque `onDone` corre en el mismo lote de React que la ultima capa.
    onDone: (logradas) => guardarSeleccion(logradas),
  })

  const listas = new Set(preparedLayers)
  const faltantes = [...elegidas].filter((k) => !listas.has(k))
  const ocupado = preparacion.running || setPublished.isPending

  function alternar(key: string) {
    setElegidas((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function guardarSeleccion(reciénPreparadas: string[] = []) {
    // Solo lo que esta REALMENTE preparado: incluir una capa que fallo haria que el
    // backend rechazara la seleccion entera y se perdieran tambien las buenas.
    const disponibles = new Set([...preparedLayers, ...reciénPreparadas])
    // Orden del catalogo, no de clic: define las paginas del PDF.
    const enOrden = layers
      .map((l) => l.key)
      .filter((k) => elegidas.has(k) && disponibles.has(k))
    setPublished.mutate(enOrden, {
      onSuccess: () => toast.success('Capas del reporte actualizadas.'),
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : 'No se pudieron guardar las capas.'),
    })
  }

  function aplicar() {
    // Solo se prepara lo que falta; lo ya listo no se vuelve a calcular.
    if (faltantes.length > 0) {
      preparacion.start(layers.map((l) => l.key).filter((k) => faltantes.includes(k)))
      return
    }
    guardarSeleccion()
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando capas…</p>
  if (layers.length === 0) {
    return <p className="text-sm text-muted-foreground">La sesión no tiene capas con datos.</p>
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">Capas del reporte</p>
        <p className="text-xs text-muted-foreground">
          Cada capa marcada es una hoja del PDF y una carpeta del KMZ. Las que ya
          abriste en el panel están listas ({preparedLayers.length}); el resto se
          preparan al aplicar.
        </p>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          className="underline underline-offset-2 disabled:opacity-50"
          disabled={ocupado || !canWrite}
          onClick={() => setElegidas(new Set(layers.map((l) => l.key)))}
        >
          Seleccionar todas ({layers.length})
        </button>
        <button
          type="button"
          className="underline underline-offset-2 disabled:opacity-50"
          disabled={ocupado || !canWrite || elegidas.size === 0}
          onClick={() => setElegidas(new Set())}
        >
          Limpiar
        </button>
      </div>

      <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
        {groups.map((g) => (
          <fieldset key={g.group}>
            <legend className="text-xs font-medium text-muted-foreground">{g.group}</legend>
            {g.layers.map((l) => (
              <label key={l.key} className="flex items-center gap-2 py-0.5 text-sm">
                <input
                  type="checkbox"
                  checked={elegidas.has(l.key)}
                  disabled={ocupado || !canWrite}
                  onChange={() => alternar(l.key)}
                />
                <span className="truncate">{l.label}</span>
                {/* Distingue lo que ya tiene mapa de lo que habra que calcular. */}
                {listas.has(l.key) && (
                  <span className="shrink-0 text-xs text-muted-foreground">✓ lista</span>
                )}
              </label>
            ))}
          </fieldset>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={aplicar} disabled={!canWrite || ocupado || disabled}>
          {preparacion.running ? 'Preparando capas…' : 'Aplicar selección'}
        </Button>
        {/* Mismo indicador que el visor: preparar una capa es el mismo trabajo. */}
        {preparacion.running && (
          <LoadingState
            compact
            className="p-0 text-xs"
            label={`Capa ${preparacion.done + 1} de ${preparacion.total}${
              preparacion.preparing ? ` · ${preparacion.preparing}` : ''
            }`}
          />
        )}
      </div>

      {/* Sin cifras inventadas: no se promete un tiempo que no se ha medido. */}
      {faltantes.length > 0 && !preparacion.running && (
        <p className="text-xs text-muted-foreground">
          {faltantes.length} capa{faltantes.length === 1 ? '' : 's'} sin preparar. Al
          aplicar se calculan; puede tardar un poco.
        </p>
      )}

      {preparacion.captureNode}
    </div>
  )
}
