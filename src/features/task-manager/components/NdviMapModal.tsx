import { useParams } from '@tanstack/react-router'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NdviMap } from '@/features/geodata-visor/components/NdviMap'

interface Props {
  sessionId: string
  plotId: string | null | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Abre el visor de contornos NDVI de una sesión en un modal (reusa NdviMap del visor). */
export function NdviMapModal({ sessionId, plotId, open, onOpenChange }: Props) {
  // El task-manager sí vive bajo `w/$dc`, así que el ámbito sale de la ruta. El visor,
  // en cambio, está fuera de `/w/$dc` y pasa su organización explícitamente.
  const { dc } = useParams({ from: '/_authenticated/w/$dc' })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Visor NDVI</DialogTitle>
        </DialogHeader>
        <div className="h-[70vh] w-full overflow-hidden rounded-lg border">
          <NdviMap sessionId={sessionId} plotId={plotId} dcId={dc} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
