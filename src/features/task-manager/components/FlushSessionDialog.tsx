/**
 * Diálogo de confirmación para eliminar los puntos de UNA sesión (solo SuperAdmin).
 *
 * Acción destructiva e irreversible, ACOTADA a la sesión actual (no toca otras sesiones).
 * Blindaje: se genera un código aleatorio de 6 dígitos al abrir; el botón "Eliminar"
 * permanece deshabilitado hasta que el usuario teclea exactamente ese código.
 * El diálogo solo cierra por sus botones (no por click-outside / Escape).
 *
 * La mutación entra por prop en vez de resolverse aquí: cada tipo de sesión trae su
 * propio hook (aspersión / NDVI / mapeo de suelo) y así el diálogo no conoce endpoints.
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
import { DeleteImpactSummary } from './DeleteImpactSummary'
import type { DeleteImpact } from '@/features/task-manager/types'

interface FlushSessionDialogProps {
  open: boolean
  onClose: () => void
  /** Mutación de borrado ya ligada a la sesión (useFlushSession). */
  flush: { mutate: (v: undefined, opts?: { onSuccess?: () => void }) => void; isPending: boolean }
  /** Qué se borra, en la frase "Esta acción elimina <children>". */
  itemsLabel: React.ReactNode
  /** Aviso extra bajo la descripción (p. ej. la coropleta de NDVI). */
  extraNotice?: React.ReactNode
  /**
   * FASE BC — impacto del borrado, del endpoint `delete-preview`. OPCIONAL a propósito:
   * los tres diálogos de flush que ya existían no lo pasan y siguen funcionando igual.
   * Cuando viene, el diálogo muestra el resumen y, si `can_delete` es false, bloquea el
   * botón por completo: el código de confirmación no puede saltarse un bloqueo del backend.
   */
  impact?: DeleteImpact
  /** true mientras el preview está en vuelo; el botón espera en vez de mentir. */
  impactLoading?: boolean
  /** Título del diálogo. Por defecto habla de "datos de esta sesión" (flush). */
  title?: React.ReactNode
  /**
   * Qué queda después. El default describe el FLUSH ("la sesión vuelve a sin importar"),
   * que es falso en un borrado: ahí la sesión desaparece. Sobrescribirlo es obligatorio en
   * los diálogos de borrado, o el texto le miente al usuario justo antes de destruir datos.
   */
  consequence?: React.ReactNode
}

function gen6() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function FlushSessionDialog({
  open,
  onClose,
  flush,
  itemsLabel,
  extraNotice,
  impact,
  impactLoading = false,
  title,
  consequence,
}: FlushSessionDialogProps) {
  const [code, setCode] = useState(gen6)
  const [typed, setTyped] = useState('')

  // Regenerar código y limpiar input cada vez que se abre.
  useEffect(() => {
    if (open) {
      setCode(gen6())
      setTyped('')
    }
  }, [open])

  const confirmed = typed.trim() === code
  const busy = flush.isPending
  // Si el backend ya dijo que no se puede, el código de confirmación es irrelevante: no
  // hay nada que confirmar. Se bloquea el botón en vez de dejar que el usuario teclee un
  // código para recibir un 409 después.
  const bloqueado = impact ? !impact.can_delete : false
  const puedeBorrar = confirmed && !busy && !bloqueado && !impactLoading

  const handleDelete = () => {
    if (!puedeBorrar) return
    flush.mutate(undefined, { onSuccess: () => onClose() })
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !busy) onClose() }}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-destructive">
            {title ?? 'Eliminar los datos de esta sesión'}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm">
              <p>
                Esta acción elimina <strong>{itemsLabel}</strong>.{' '}
                {consequence ?? (
                  <>
                    No afecta a otras sesiones de la parcela. La sesión vuelve a estado
                    «sin importar».
                  </>
                )}{' '}
                <strong>No se puede deshacer.</strong>
              </p>
              {extraNotice && <p>{extraNotice}</p>}
              {impactLoading && <p className="text-muted-foreground">Calculando impacto…</p>}
              {impact && <DeleteImpactSummary impact={impact} />}
              {!bloqueado && (
                <p>
                  Para confirmar, escribe el código <span className="font-mono font-bold text-foreground">{code}</span>:
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {!bloqueado && (
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Código de 6 dígitos"
            inputMode="numeric"
            autoFocus
            disabled={busy || impactLoading}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {bloqueado ? 'Entendido' : 'Cancelar'}
          </Button>
          {!bloqueado && (
            <Button variant="destructive" onClick={handleDelete} disabled={!puedeBorrar}>
              {busy ? 'Eliminando…' : 'Eliminar todo'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
