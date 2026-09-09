/**
 * Borrado de lecturas importadas de una sesión de Rendimiento (solo SuperAdmin).
 * Reutiliza la misma confirmación fuerte de NDVI / Suelo y deja viva la cabecera
 * para que el usuario pueda corregir la parcela o volver a importar el CSV.
 */
import { FlushSessionDialog } from './FlushSessionDialog'
import { useFlushSession } from '../hooks/useFlushSession'

interface FlushYieldMapDialogProps {
  open: boolean
  onClose: () => void
  sessionId: string
}

export function FlushYieldMapDialog({ open, onClose, sessionId }: FlushYieldMapDialogProps) {
  const flush = useFlushSession('yield_map', sessionId)
  return (
    <FlushSessionDialog
      open={open}
      onClose={onClose}
      flush={flush}
      itemsLabel="las lecturas de rendimiento importadas en esta sesión"
      extraNotice="La sesión se conserva para que puedas corregir sus metadatos y volver a importar el CSV."
    />
  )
}
