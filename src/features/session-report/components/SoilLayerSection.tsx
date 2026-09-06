/**
 * Bloque de capas del panel, con preparacion automatica (FASE RS).
 *
 * Ata el visor de la capa con el motor de preparacion: elegir una capa que aun no
 * esta lista la prepara sola, porque calcular el raster y mostrarlo son el mismo
 * trabajo y pedir un paso aparte para ver la propia capa era fricción inventada.
 *
 * Preparar NO publica: elegir que capas van al PDF es una decision aparte, en
 * `SoilPublishFlow`.
 */
import { useSoilLayerPreparation } from '../hooks/useSoilLayerPreparation'
import { SoilLayerBlock } from './SoilLayerBlock'
import { useSoilLayerOptions } from './SoilLayerPicker'
import { statsSnapshotOf, type SessionReport, type SessionType } from '../types'

interface Props {
  report: SessionReport
  sessionType: SessionType
  objectId: string
  plotId: string | null
  canWrite: boolean
}

export function SoilLayerSection({
  report,
  sessionType,
  objectId,
  plotId,
  canWrite,
}: Props) {
  const { layers } = useSoilLayerOptions(objectId)
  const preparacion = useSoilLayerPreparation({
    reportId: report.id,
    sessionType,
    objectId,
    plotId,
    kindOf: (key) => layers.find((l) => l.key === key)?.kind,
  })

  return (
    <>
      <SoilLayerBlock
        headerId={objectId}
        frozenLayers={statsSnapshotOf(report).layers}
        // Sin permiso de escritura el bloque es de solo lectura: se ven las capas
        // ya preparadas, pero abrir una nueva no escribe en el reporte.
        onPrepare={canWrite ? (key) => preparacion.start([key]) : undefined}
        preparing={preparacion.preparing}
      />
      {preparacion.captureNode}
    </>
  )
}
