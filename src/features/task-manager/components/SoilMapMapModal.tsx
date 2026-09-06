import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SoilMap } from '@/features/geodata-visor/components/SoilMap'
import { SessionReportToggle } from '@/features/session-report/components/SessionReportToggle'

interface SoilMapMapModalProps {
  open: boolean
  onClose: () => void
  sessionId: string
  plotId: string | null
  datacentralId?: string | null
}

export function SoilMapMapModal({
  open,
  onClose,
  sessionId,
  plotId,
  datacentralId,
}: SoilMapMapModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="h-[92vh] w-full max-w-6xl gap-0 overflow-hidden p-0"
        onInteractOutside={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogDescription className="sr-only">
          Visualización geográfica de las muestras y variables del mapa de suelo.
        </DialogDescription>
        <SoilMap
          sessionId={sessionId}
          plotId={plotId}
          enabled={open}
          toolbarStart={
            <DialogTitle className="mr-2 text-base font-semibold">Mapa de suelo</DialogTitle>
          }
          toolbarEnd={
            <>
              <SessionReportToggle
                objectId={sessionId}
                plotId={plotId}
                datacentralId={datacentralId}
                sessionType="soilmap"
              />
              <Button size="sm" variant="outline" onClick={onClose}>
                ✕ Cerrar
              </Button>
            </>
          }
        />
      </DialogContent>
    </Dialog>
  )
}
