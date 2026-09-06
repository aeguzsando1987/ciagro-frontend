/**
 * Entregables del reporte (FASE RP): firma del analista, publicación con captura
 * del mapa, liga pública y descarga de PDF, KML y CSV.
 *
 * Flujo de publicación (decisión del dev): publicar EXIGE el snapshot del mapa y lo
 * deja congelado. Al pulsar "Publicar" se monta el mapa fuera de pantalla, se captura,
 * se sube y recién entonces se marca `publicado`. El backend revalida lo mismo (400 si
 * falta el mapa).
 *
 * La captura se rehace en CADA publicación, no solo la primera vez: el snapshot está
 * congelado mientras el reporte está publicado, pero despublicar y volver a publicar es
 * la forma de refrescarlo desde la propia app, sin tocar la base de datos.
 *
 * La liga es el UUID que el reporte ya tiene, así que revocarla = despublicar.
 */
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { useUpdateSessionReport } from '../hooks/useSessionReport'
import {
  useUploadReportAssets,
  useDownloadReportPdf,
  useDownloadReportKmz,
  useDownloadReportCsv,
} from '../hooks/useReportAssets'
import { ReportMapCapture } from './ReportMapCapture'
import { SoilPublishFlow } from './SoilPublishFlow'
import { statsSnapshotOf, type SessionReport, type SessionType } from '../types'

interface ReportDeliverablesProps {
  report: SessionReport
  sessionType: SessionType
  objectId: string
  plotId: string | null
  canWrite: boolean
}

export function ReportDeliverables({
  report,
  sessionType,
  objectId,
  plotId,
  canWrite,
}: ReportDeliverablesProps) {
  const [capturing, setCapturing] = useState(false)
  const signatureInputRef = useRef<HTMLInputElement>(null)

  const uploadMut = useUploadReportAssets(report.id, sessionType, objectId)
  const updateMut = useUpdateSessionReport(report.id, sessionType, objectId)
  const pdfMut = useDownloadReportPdf(report.id)
  const kmzMut = useDownloadReportKmz(report.id)
  const csvMut = useDownloadReportCsv(report.id)

  const isPublished = report.status === 'publicado'
  // R2: cancelado bloquea las CUATRO exportaciones, y el backend responde 409.
  // Deshabilitarlas evita una descarga que solo puede terminar en error.
  const isCancelled = report.status === 'cancelado'
  const publicUrl = `${window.location.origin}/r/${report.id}/`
  const busy = capturing || uploadMut.isPending || updateMut.isPending

  // El entregable de suelo son las capas, no la captura unica del visor: cada capa
  // publicada lleva su propia imagen. Ambas puertas —publicar y PDF— usan este
  // mismo criterio en el backend.
  const esSuelo = sessionType === 'soilmap'
  const snapshot = statsSnapshotOf(report)
  // Preparadas: tienen mapa y clases. Publicadas: las elegidas para el entregable.
  const preparedLayers = Object.keys(snapshot.layers ?? {})
  const publishedLayers = snapshot.published_layers ?? []
  const hasMap = esSuelo ? publishedLayers.length > 0 : !!report.map_snapshot

  function markPublished() {
    updateMut.mutate(
      { status: 'publicado' },
      {
        onSuccess: () => toast.success('Reporte publicado. La liga ya es accesible.'),
        onError: () => toast.error('No se pudo publicar el reporte.'),
      }
    )
  }

  function handlePublish() {
    // En suelo las imagenes ya las congelo SoilPublishFlow capa por capa, asi que
    // no hay una captura unica que hacer aqui: se publica directo.
    if (esSuelo) {
      markPublished()
      return
    }
    // Siempre se re-captura: republicar es el mecanismo para refrescar el mapa.
    setCapturing(true)
  }

  function exportCsv() {
    csvMut.mutate(undefined, {
      onSuccess: () => toast.success('CSV descargado.'),
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : 'No se pudo generar el CSV.'),
    })
  }

  function handleCaptured(blob: Blob) {
    setCapturing(false)
    uploadMut.mutate(
      { map_snapshot: blob },
      {
        onSuccess: () => markPublished(),
        onError: () => toast.error('No se pudo guardar la captura del mapa.'),
      }
    )
  }

  function handleCaptureError(message: string) {
    setCapturing(false)
    toast.error(message)
  }

  function handleSignatureChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Se limpia el input para que volver a elegir el MISMO archivo dispare el change.
    event.target.value = ''
    if (!file) return

    uploadMut.mutate(
      { analyst_signature: file },
      {
        onSuccess: () => toast.success('Firma del analista actualizada.'),
        onError: () => toast.error('No se pudo subir la firma.'),
      }
    )
  }

  function descargarPdf() {
    // Sin abrir pestaña: generar el PDF tarda unos segundos y una pestaña vacia
    // mientras tanto parece un error. La espera se muestra aqui, en el boton.
    pdfMut.mutate(undefined, {
      onSuccess: () => toast.success('PDF descargado.'),
      onError: (e) =>
        toast.error(
          e instanceof Error ? e.message : 'No se pudo generar el PDF del reporte.'
        ),
    })
  }

  function exportKmz() {
    kmzMut.mutate(undefined, {
      onSuccess: () => toast.success('KML descargado. Ábrelo en Google Earth.'),
      onError: (e) =>
        toast.error(
          e instanceof Error ? e.message : 'No se pudo generar el KML del reporte.'
        ),
    })
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast.success('Liga copiada al portapapeles.')
    } catch {
      toast.error('No se pudo copiar la liga.')
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">Entregables</p>
        <p className="text-xs text-muted-foreground">
          Firma del analista, liga para el cliente, PDF y archivo KML para Google Earth.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Firma del analista */}
        <input
          ref={signatureInputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={handleSignatureChange}
          data-testid="signature-input"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => signatureInputRef.current?.click()}
          disabled={!canWrite || busy}
          title={canWrite ? undefined : 'Requiere rol técnico o superior'}
        >
          {report.analyst_signature
            ? 'Reemplazar firma de Analista Agrícola'
            : 'Subir firma de Analista Agrícola'}
        </Button>

        {/* Publicar. En aspersion captura el mapa; en suelo exige capas ya
            preparadas, y el backend rechaza publicar sin ninguna. */}
        {!isPublished && (
          <Button
            size="sm"
            onClick={handlePublish}
            disabled={!canWrite || busy || isCancelled || (esSuelo && !hasMap)}
            title={
              esSuelo && !hasMap ? 'Prepara al menos una capa antes de publicar' : undefined
            }
          >
            {capturing
              ? 'Capturando mapa…'
              : busy
                ? 'Publicando…'
                : 'Publicar reporte'}
          </Button>
        )}

        {/* La liga solo existe mientras el reporte está publicado. */}
        {isPublished && (
          <Button size="sm" variant="outline" onClick={copyLink}>
            Copiar liga pública
          </Button>
        )}

        {/* Sin captura no hay PDF (el backend responde 400): se deshabilita para no
            abrir una pestaña que terminaría en error. */}
        <Button
          size="sm"
          variant="outline"
          onClick={descargarPdf}
          disabled={pdfMut.isPending || !hasMap || isCancelled}
          title={
            isCancelled
              ? 'Un reporte cancelado no se exporta'
              : hasMap
                ? undefined
                : esSuelo
                  ? 'Prepara al menos una capa para generar el PDF'
                  : 'Publica el reporte para capturar el mapa'
          }
        >
          {pdfMut.isPending ? 'Generando PDF…' : 'Descargar PDF'}
        </Button>

        {/* El KMZ no depende de la captura del mapa (a diferencia del PDF), así que
            no se deshabilita por `hasMap`: siempre hay algo que exportar. */}
        <Button
          size="sm"
          variant="outline"
          onClick={exportKmz}
          disabled={kmzMut.isPending || isCancelled}
          title={
            isCancelled
              ? 'Un reporte cancelado no se exporta'
              : 'Descarga el archivo para abrirlo en Google Earth'
          }
        >
          {kmzMut.isPending ? 'Generando KML…' : 'Exportar KML'}
        </Button>

        {/* Solo suelo: la telemetria de aspersion ya viaja en su propio reporte y
            no habia pedido de exportarla como tabla. */}
        {esSuelo && (
          <Button
            size="sm"
            variant="outline"
            onClick={exportCsv}
            disabled={csvMut.isPending || isCancelled}
            title={
              isCancelled
                ? 'Un reporte cancelado no se exporta'
                : 'Descarga las muestras con una columna por capa'
            }
          >
            {csvMut.isPending ? 'Generando CSV…' : 'Exportar CSV'}
          </Button>
        )}
      </div>

      {/* R4: en suelo hay que elegir capas antes de publicar. Va arriba de la liga
          porque es el paso previo, no un extra. */}
      {esSuelo && !isPublished && (
        <SoilPublishFlow
          reportId={report.id}
          sessionType={sessionType}
          objectId={objectId}
          plotId={plotId}
          canWrite={canWrite}
          preparedLayers={preparedLayers}
          publishedLayers={publishedLayers}
          disabled={busy || isCancelled}
        />
      )}

      {/* La espera se muestra AQUI y no en una pestaña en blanco: el PDF se maqueta
          en el servidor y tarda unos segundos, sobre todo con varias capas. */}
      {(pdfMut.isPending || kmzMut.isPending || csvMut.isPending) && (
        <LoadingState
          compact
          className="justify-start p-0 text-xs"
          label={
            pdfMut.isPending
              ? 'Generando el PDF en el servidor. La descarga empieza sola al terminar…'
              : kmzMut.isPending
                ? 'Generando el KML…'
                : 'Generando el CSV…'
          }
        />
      )}

      {isPublished && (
        <p className="break-all text-xs text-muted-foreground">
          {publicUrl}
          <br />
          Para revocar el acceso, cambia el estatus a otro distinto de “Publicado”.
        </p>
      )}

      {!isPublished && !esSuelo && (
        <p className="text-xs text-muted-foreground">
          {hasMap
            ? 'Al publicar se vuelve a capturar el mapa de la sesión, reemplazando la captura anterior.'
            : 'Al publicar se captura el mapa de la sesión y queda congelado en el reporte.'}
        </p>
      )}

      {!isPublished && esSuelo && (
        <p className="text-xs text-muted-foreground">
          {hasMap
            ? `${publishedLayers.length} capa${publishedLayers.length === 1 ? '' : 's'} preparada${publishedLayers.length === 1 ? '' : 's'}. Al publicar quedan congeladas.`
            : 'Prepara las capas que quieras publicar; cada una será una hoja del PDF.'}
        </p>
      )}

      {capturing && (
        <ReportMapCapture
          sessionId={objectId}
          plotId={plotId}
          onCaptured={handleCaptured}
          onError={handleCaptureError}
        />
      )}
    </div>
  )
}
