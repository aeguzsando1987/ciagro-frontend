/**
 * Modal grande con el mapa fitosanitario de una sesión (símil de AspersionMapModal).
 * Sólo aporta el chrome del Dialog: título y botón cerrar (sólo cierra con el botón).
 * El gating del botón que lo abre vive en SesionModal.tsx (role_level >= 3).
 */
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PhytoMap } from './PhytoMap'

interface PhytoMapModalProps {
  open: boolean
  onClose: () => void
  /** UUID del PhytoMonitoringHeader. */
  sessionId: string
  plotId: string | null
}

export function PhytoMapModal({ open, onClose, sessionId, plotId }: PhytoMapModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent
        className="max-w-6xl w-full h-[92vh] flex flex-col p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <PhytoMap
          sessionId={sessionId}
          plotId={plotId}
          enabled={open}
          toolbarStart={<DialogTitle className="text-base font-semibold mr-2">Mapa fitosanitario</DialogTitle>}
          toolbarEnd={<Button size="sm" variant="outline" onClick={onClose}>✕ Cerrar</Button>}
        />
      </DialogContent>
    </Dialog>
  )
}
