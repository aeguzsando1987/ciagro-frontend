/**
 * Borrado de las muestras de una sesión de mapeo de suelo (solo SuperAdmin).
 * La UX de confirmación vive en FlushSessionDialog, compartida con aspersión y NDVI.
 */
import { FlushSessionDialog } from './FlushSessionDialog'
import { useFlushSession } from '../hooks/useFlushSession'

interface FlushSoilMapDialogProps {
  open: boolean
  onClose: () => void
  /** UUID de la sesión cuyas muestras se eliminarán (acotado a esta sesión). */
  sessionId: string
}

export function FlushSoilMapDialog({ open, onClose, sessionId }: FlushSoilMapDialogProps) {
  const flush = useFlushSession('soil_map', sessionId)
  return (
    <FlushSessionDialog
      open={open}
      onClose={onClose}
      flush={flush}
      itemsLabel="las muestras de suelo importadas en esta sesión"
    />
  )
}
