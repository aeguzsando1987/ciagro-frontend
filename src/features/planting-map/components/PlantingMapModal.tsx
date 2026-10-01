import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PlantingMap } from '@/features/geodata-visor/components/PlantingMap'

interface Props {
  sessionId: string
  plotId: string | null | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PlantingMapModal({ sessionId, plotId, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Visor de Siembra</DialogTitle>
        </DialogHeader>
        <div className="h-[72vh] min-h-[520px] w-full overflow-hidden rounded-lg border">
          <PlantingMap sessionId={sessionId} plotId={plotId ?? null} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
