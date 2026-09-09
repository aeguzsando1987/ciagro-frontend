import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { YieldMap } from '@/features/geodata-visor/components/YieldMap'

interface Props {
  sessionId: string
  plotId: string | null | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Visor rápido de Rendimiento desde Task Manager.
 * Reutiliza exactamente el mismo YieldMap que usa Exploración agrícola para que
 * la sesión se vea igual sin mantener dos implementaciones del mapa.
 */
export function YieldMapModal({ sessionId, plotId, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Visor de Rendimiento</DialogTitle>
        </DialogHeader>
        <div className="h-[72vh] min-h-[520px] w-full overflow-hidden rounded-lg border">
          <YieldMap sessionId={sessionId} plotId={plotId ?? null} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
