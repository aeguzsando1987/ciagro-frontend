/**
 * Motor de preparacion de capas de suelo (FASE RS).
 *
 * Preparar una capa es: montar el mapa, esperar a que el raster la clasifique,
 * fotografiarla y congelar el resultado. Lo usan dos sitios con la misma mecanica
 * y distinto alcance —el panel prepara UNA al elegirla, el flujo de publicacion
 * prepara las que se marquen—, asi que vive aqui y no duplicado en ambos.
 *
 * Siempre DE UNA EN UNA: N mapas WebGL simultaneos fuera de pantalla agotan los
 * contextos del navegador y las capturas empiezan a salir en blanco.
 */
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { SoilLayerComputed } from '@/features/geodata-visor/components/SoilMap'
import { SoilLayerCapture } from '../components/SoilLayerCapture'
import { buildFreezePayload } from '../lib/soilFreeze'
import { useFreezeSoilLayer } from './useFreezeSoilLayer'
import { useSoilLayerStats, isNumericStats } from './useSoilLayerStats'
import type { SessionType } from '../types'

interface Params {
  reportId: string
  sessionType: SessionType
  objectId: string
  plotId: string | null
  /** `key -> kind` del catalogo: las categoricas no interpolan y no esperan raster. */
  kindOf: (layerKey: string) => 'numeric' | 'category' | undefined
  /** Recibe las capas que SI quedaron listas en el lote. */
  onDone?: (succeeded: string[]) => void
}

export function useSoilLayerPreparation({
  reportId,
  sessionType,
  objectId,
  plotId,
  kindOf,
  onDone,
}: Params) {
  const [cola, setCola] = useState<string[]>([])
  const [hechas, setHechas] = useState(0)
  // En ESTADO y no en un ref: la captura espera a que la capa este clasificada, y
  // un ref no dispara el re-render que abre esa puerta.
  const [computed, setComputed] = useState<SoilLayerComputed | null>(null)
  const [publicar, setPublicar] = useState(false)
  // Fallos acumulados del lote, para reportarlos juntos al terminar.
  const [fallidas, setFallidas] = useState<string[]>([])
  // Capas que SI quedaron listas en este lote. Sin esta lista, guardar la seleccion
  // incluiria las que fallaron y el backend la rechazaria entera.
  const [logradas, setLogradas] = useState<string[]>([])
  // Espejo en ref: `onDone` corre dentro del mismo lote de React que el
  // `setLogradas` de la ultima capa, asi que leer el estado ahi daria el valor
  // anterior y la capa recien lograda se perderia de la seleccion.
  const logradasRef = useRef<string[]>([])

  const freezeMut = useFreezeSoilLayer(reportId, sessionType, objectId)
  const actual = cola[0] ?? null
  // Los bins los calcula el BACKEND: el raster del navegador reparte por banda, no
  // por bin. Sin ellos la capa se congela sin histograma.
  const { data: statsCapa } = useSoilLayerStats(objectId, actual)

  /**
   * Gate de la captura. NO basta con que la capa este clasificada: SoilMap tiene un
   * camino de respaldo que calcula los cortes desde los valores crudos cuando el
   * raster aun no llego, asi que la clasificacion aparece ANTES que la superficie.
   * Capturar ahi daba la foto del satelite sin puntos y una leyenda sin reparto
   * espacial. Las categoricas no interpolan, asi que para ellas basta clasificar.
   */
  const listaParaCapturar =
    computed?.layerKey === actual &&
    (kindOf(actual ?? '') === 'category' || computed?.bucketCellCounts != null)

  const empezar = useCallback((keys: string[], conPublicacion = false) => {
    if (keys.length === 0) return
    setComputed(null)
    setPublicar(conPublicacion)
    setFallidas([])
    setLogradas([])
    logradasRef.current = []
    setHechas(0)
    setCola(keys)
  }, [])

  const siguiente = useCallback(() => {
    setComputed(null)
    setCola((prev) => {
      const resto = prev.slice(1)
      if (resto.length === 0) {
        // Los fallos se cuentan al final, no capa por capa: N toasts seguidos
        // durante un lote largo tapan la pantalla y no dicen cuantas quedaron bien.
        setFallidas((errores) => {
          if (errores.length > 0) {
            toast.error(
              `${errores.length} capa${errores.length === 1 ? '' : 's'} no se pudo preparar: ${errores[0]}`
            )
          }
          return errores
        })
        onDone?.(logradasRef.current)
      }
      return resto
    })
    setHechas((n) => n + 1)
  }, [onDone])

  /**
   * Una capa que falla se SALTA, no aborta el lote.
   *
   * Antes un solo fallo vaciaba la cola: si la capa que fallaba iba en medio, todas
   * las siguientes se quedaban sin preparar y el PDF salia con menos hojas de las
   * elegidas, sin decir por que. Los fallos se juntan y se reportan al final.
   */
  const saltar = useCallback((mensaje: string) => {
    setFallidas((prev) => [...prev, mensaje])
    siguiente()
  }, [siguiente])

  // `useCallback` no es cosmetico: viaja a un efecto dentro del mapa, y una
  // referencia nueva por render lo dispararia en bucle.
  const alCalcular = useCallback((result: SoilLayerComputed) => setComputed(result), [])

  const alCapturar = useCallback(
    (blob: Blob) => {
      // Red de seguridad: la captura solo se dispara con el gate abierto.
      if (!computed || !actual || computed.layerKey !== actual) {
        saltar('El mapa no alcanzó a clasificar la capa antes de la captura.')
        return
      }
      const payload = buildFreezePayload({
        layerKey: actual,
        // Sin esto las categoricas se rechazaban: se les exigian cortes que una
        // capa de clases no tiene.
        kind: kindOf(actual) ?? 'numeric',
        entries: computed.entries,
        breaks: computed.breaks,
        sampleBuckets: computed.sampleBuckets,
        bucketCellCounts: computed.bucketCellCounts,
        totalAreaHa: computed.totalAreaHa,
        histogram: statsCapa && isNumericStats(statsCapa) ? statsCapa.histogram : null,
        image: blob,
      })
      if (!payload) {
        saltar(`Los rangos de la capa ${actual} no cuadran con su paleta.`)
        return
      }
      freezeMut.mutate(
        { ...payload, publish: publicar },
        {
          onSuccess: () => {
            logradasRef.current = [...logradasRef.current, actual]
            setLogradas(logradasRef.current)
            siguiente()
          },
          onError: (e) =>
            saltar(e instanceof Error ? e.message : 'No se pudo preparar la capa.'),
        }
      )
    },
    [actual, computed, freezeMut, publicar, saltar, siguiente, statsCapa]
  )

  return {
    /** Capa en proceso, o null. */
    preparing: actual,
    /** Cuantas van y de cuantas, para el avance. */
    done: hechas,
    total: cola.length + hechas,
    running: cola.length > 0,
    /** Mensajes de las capas que no se pudieron preparar en el ultimo lote. */
    failed: fallidas,
    /** Capas que quedaron listas en el ultimo lote. */
    succeeded: logradas,
    start: empezar,
    /**
     * Elemento a montar para que la preparacion ocurra. Fuera de pantalla; devuelve
     * null cuando no hay nada en cola.
     */
    captureNode: actual ? (
      <SoilLayerCapture
        sessionId={objectId}
        plotId={plotId}
        layerKey={actual}
        onComputed={alCalcular}
        ready={listaParaCapturar}
        onCaptured={alCapturar}
        onError={saltar}
      />
    ) : null,
  }
}
