/**
 * Modal grande con el mapa de calor de los datos de aspersión de una sesión.
 *
 * Desde la Fase 7 el contenido del mapa vive en el componente reutilizable `AspersionMap`
 * (src/features/geodata-visor/components/AspersionMap.tsx), que también se embebe en el
 * dashboard del Visor de Datos Agrícolas. Este modal sólo aporta el chrome del Dialog:
 * el título, el botón "✕ Cerrar" y el bloqueo de cierre por clic-fuera/Escape
 * (§2.7 del caso de uso: el modal sólo se cierra con el botón).
 *
 * Gating: el botón que abre este modal se gatea en SesionModal.tsx (role_level >= 3).
 */
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AspersionMap } from '@/features/geodata-visor/components/AspersionMap'

interface AspersionMapModalProps {
  open: boolean
  onClose: () => void
  /** UUID de la AspersionSessionHeader. */
  sessionId: string
  plotId: string | null
}

export function AspersionMapModal({ open, onClose, sessionId, plotId }: AspersionMapModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-6xl w-full h-[92vh] flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AspersionMap
          sessionId={sessionId}
          plotId={plotId}
          enabled={open}
          toolbarStart={<DialogTitle className="text-base font-semibold mr-2">Mapa de aspersión</DialogTitle>}
          toolbarEnd={<Button size="sm" variant="outline" onClick={onClose}>✕ Cerrar</Button>}
        />
      </DialogContent>
    </Dialog>
  )
}
