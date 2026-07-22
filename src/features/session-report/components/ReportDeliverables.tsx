/**
 * Entregables del reporte (FASE RP): firma del analista, publicación con captura
 * del mapa, liga pública y apertura del PDF en una pestaña.
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
import { useUpdateSessionReport } from '../hooks/useSessionReport'
import { useUploadReportAssets, useOpenReportPdf } from '../hooks/useReportAssets'
import { ReportMapCapture } from './ReportMapCapture'
import type { SessionReport, SessionType } from '../types'

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
  const pdfMut = useOpenReportPdf(report.id)

  const isPublished = report.status === 'publicado'
  const hasMap = !!report.map_snapshot
  const publicUrl = `${window.location.origin}/r/${report.id}/`
  const busy = capturing || uploadMut.isPending || updateMut.isPending

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
    // Siempre se re-captura: republicar es el mecanismo para refrescar el mapa.
    setCapturing(true)
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

  function openPdf() {
    // La pestaña se abre AQUÍ, dentro del gesto del usuario; abrirla después del
    // fetch la haría víctima del bloqueador de popups.
    const tab = window.open('', '_blank')
    pdfMut.mutate(tab, {
      onError: (e) =>
        toast.error(
          e instanceof Error ? e.message : 'No se pudo generar el PDF del reporte.'
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
          Firma del analista, liga para el cliente y PDF del reporte.
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

        {/* Publicar (captura el mapa si hace falta) */}
        {!isPublished && (
          <Button size="sm" onClick={handlePublish} disabled={!canWrite || busy}>
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
          onClick={openPdf}
          disabled={pdfMut.isPending || !hasMap}
          title={hasMap ? undefined : 'Publica el reporte para capturar el mapa'}
        >
          {pdfMut.isPending ? 'Generando PDF…' : 'Ver PDF'}
        </Button>
      </div>

      {isPublished && (
        <p className="break-all text-xs text-muted-foreground">
          {publicUrl}
          <br />
          Para revocar el acceso, cambia el estatus a otro distinto de “Publicado”.
        </p>
      )}

      {!isPublished && (
        <p className="text-xs text-muted-foreground">
          {hasMap
            ? 'Al publicar se vuelve a capturar el mapa de la sesión, reemplazando la captura anterior.'
            : 'Al publicar se captura el mapa de la sesión y queda congelado en el reporte.'}
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
