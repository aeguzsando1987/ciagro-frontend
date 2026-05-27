/**
 * Diálogo de confirmación para eliminar los puntos de aspersión de UNA sesión (solo SuperAdmin).
 *
 * Acción destructiva e irreversible, ACOTADA a la sesión actual (no toca otras sesiones).
 * Blindaje: se genera un código aleatorio de 6 dígitos al abrir; el botón "Eliminar"
 * permanece deshabilitado hasta que el usuario teclea exactamente ese código.
 * El diálogo solo cierra por sus botones (no por click-outside / Escape).
 */
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFlushAspersion } from '../hooks/useFlushAspersion'

interface FlushAspersionDialogProps {
  open: boolean
  onClose: () => void
  /** UUID de la sesión cuyos puntos se eliminarán (acotado a esta sesión). */
  sessionId: string
}

function gen6() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function FlushAspersionDialog({ open, onClose, sessionId }: FlushAspersionDialogProps) {
  const [code, setCode] = useState(gen6)
  const [typed, setTyped] = useState('')
  const flush = useFlushAspersion(sessionId)

  // Regenerar código y limpiar input cada vez que se abre.
  useEffect(() => {
    if (open) {
      setCode(gen6())
      setTyped('')
    }
  }, [open])

  const confirmed = typed.trim() === code
  const busy = flush.isPending

  const handleDelete = () => {
    if (!confirmed || busy) return
    flush.mutate(undefined, { onSuccess: () => onClose() })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !busy) onClose() }}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-destructive">⚠ Eliminar los datos de esta sesión</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Esta acción elimina <strong>los puntos de aspersión importados en esta sesión</strong>.
                No afecta a otras sesiones de la parcela. La sesión vuelve a estado
                «sin importar». <strong>No se puede deshacer.</strong>
              </p>
              <p>
                Para confirmar, escribe el código <span className="font-mono font-bold text-foreground">{code}</span>:
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Código de 6 dígitos"
          inputMode="numeric"
          autoFocus
          disabled={busy}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={!confirmed || busy}>
            {busy ? 'Eliminando…' : 'Eliminar todo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
