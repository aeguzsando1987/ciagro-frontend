/**
 * "Sincronizar datos de sesión": recalcula los snapshots del reporte desde la sesión.
 * Oculto si el reporte está `publicado` (F5); el backend además responde 409 en ese caso,
 * que el hook convierte en `ReportPublishedError` → toast claro.
 */
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  useSyncSessionReport,
  ReportPublishedError,
} from '../hooks/useSessionReport'
import type { SessionReport, SessionType } from '../types'

interface SyncReportButtonProps {
  report: SessionReport
  sessionType: SessionType
  objectId: string
  canWrite: boolean
}

export function SyncReportButton({ report, sessionType, objectId, canWrite }: SyncReportButtonProps) {
  const syncMut = useSyncSessionReport(report.id, sessionType, objectId)

  // Publicado = entregable inmutable: no se sincroniza (D3 / F5).
  if (report.status === 'publicado') return null

  function onSync() {
    syncMut.mutate(undefined, {
      onSuccess: () => toast.success('Datos de sesión sincronizados.'),
      onError: (e) => {
        if (e instanceof ReportPublishedError) {
          toast.error('El reporte está publicado y no puede sincronizarse.')
        } else {
          toast.error('No se pudieron sincronizar los datos de sesión.')
        }
      },
    })
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onSync}
      disabled={!canWrite || syncMut.isPending}
      title={canWrite ? undefined : 'Requiere rol técnico o superior'}
    >
      {syncMut.isPending ? 'Sincronizando…' : '🔄 Sincronizar datos de sesión'}
    </Button>
  )
}
