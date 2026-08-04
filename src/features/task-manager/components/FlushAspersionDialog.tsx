/**
 * Borrado de los puntos de aspersión de UNA sesión (solo SuperAdmin).
 * La UX de confirmación vive en FlushSessionDialog, compartida con NDVI y mapeo de suelo.
 */
import { FlushSessionDialog } from './FlushSessionDialog'
import { useFlushAspersion } from '../hooks/useFlushAspersion'

interface FlushAspersionDialogProps {
  open: boolean
  onClose: () => void
  /** UUID de la sesión cuyos puntos se eliminarán (acotado a esta sesión). */
  sessionId: string
}

export function FlushAspersionDialog({ open, onClose, sessionId }: FlushAspersionDialogProps) {
  const flush = useFlushAspersion(sessionId)
  return (
    <FlushSessionDialog
      open={open}
      onClose={onClose}
      flush={flush}
      itemsLabel="los puntos de aspersión importados en esta sesión"
    />
  )
}
