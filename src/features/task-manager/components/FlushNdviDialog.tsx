/**
 * Borrado de los puntos de una sesión NDVI (solo SuperAdmin).
 *
 * A diferencia de aspersión, el backend también purga la coropleta cacheada
 * (NdviIndexContour / NdviContourRun) de TODAS las organizaciones: esas bandas se
 * derivan de los puntos y sobrevivir al borrado las dejaría pintando datos que ya
 * no existen. Se avisa en el diálogo para que no sorprenda.
 */
import { FlushSessionDialog } from './FlushSessionDialog'
import { useFlushSession } from '../hooks/useFlushSession'

interface FlushNdviDialogProps {
  open: boolean
  onClose: () => void
  /** UUID de la sesión cuyos puntos se eliminarán (acotado a esta sesión). */
  sessionId: string
}

export function FlushNdviDialog({ open, onClose, sessionId }: FlushNdviDialogProps) {
  const flush = useFlushSession('ndvi', sessionId)
  return (
    <FlushSessionDialog
      open={open}
      onClose={onClose}
      flush={flush}
      itemsLabel="los puntos de índices vegetativos importados en esta sesión"
      extraNotice="También se descarta la coropleta ya generada de esta sesión; se vuelve a calcular la próxima vez que se importen datos."
    />
  )
}
