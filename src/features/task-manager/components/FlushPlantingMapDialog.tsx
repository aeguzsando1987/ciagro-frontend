import { FlushSessionDialog } from './FlushSessionDialog'
import { useFlushSession } from '../hooks/useFlushSession'

interface Props { open: boolean; onClose: () => void; sessionId: string }

export function FlushPlantingMapDialog({ open, onClose, sessionId }: Props) {
  const flush = useFlushSession('planting_map', sessionId)
  return (
    <FlushSessionDialog
      open={open}
      onClose={onClose}
      flush={flush}
      itemsLabel="las lecturas de siembra importadas en esta sesión"
      extraNotice="La sesión se conserva para corregir sus metadatos y volver a importar el CSV."
    />
  )
}
