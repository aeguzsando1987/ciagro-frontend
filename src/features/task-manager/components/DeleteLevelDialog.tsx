/**
 * Cablea preview + mutacion + confirmacion por codigo, para que los tres modales no
 * repitan lo mismo (FASE BC). Reutiliza FlushSessionDialog tal cual.
 *
 * El preview es lazy: solo se pide al abrir. Si trae bloqueadores, FlushSessionDialog
 * esconde el input y el boton por su cuenta.
 */
import { FlushSessionDialog } from './FlushSessionDialog'
import { useDeleteImpact, useDeleteLevel, type DeleteLevel } from '../hooks/useDeleteLevel'

/**
 * DECISION DE UX (dev, 2026-08-27): el borrado de programas es soft y `/restore/` existe,
 * pero NO se anuncia como "se puede restaurar". Ofrecer la vuelta atras en el mismo
 * dialogo abarata una accion destructiva y invita a probar. Se remite a soporte, que
 * ademas es exacto: la restauracion es de administrador, no del usuario que borra.
 * En sesiones no hay vuelta atras de ningun tipo, y ahi el texto lo dice sin rodeos.
 */
const TEXTOS: Record<DeleteLevel, { titulo: string; items: string; consecuencia: string }> = {
  aspersion: {
    titulo: 'Eliminar sesión de aspersión',
    items: 'la sesión y sus puntos',
    consecuencia: 'Los datos se eliminan de forma permanente.',
  },
  soil_map: {
    titulo: 'Eliminar sesión de mapeo de suelo',
    items: 'la sesión y sus puntos',
    consecuencia: 'Los datos se eliminan de forma permanente.',
  },
  ndvi: {
    titulo: 'Eliminar sesión de NDVI',
    items: 'la sesión, sus puntos y su coropleta',
    consecuencia: 'Los datos se eliminan de forma permanente.',
  },
  phyto: {
    titulo: 'Eliminar sesión fitosanitaria',
    items: 'la sesión y sus muestras',
    consecuencia: 'Los datos se eliminan de forma permanente.',
  },
  programa: {
    titulo: 'Eliminar subprograma',
    items: 'el subprograma',
    consecuencia: 'Recuperarlo requiere contactar a soporte técnico.',
  },
  master: {
    titulo: 'Eliminar programa maestro',
    items: 'el programa maestro y sus subprogramas',
    consecuencia: 'Recuperarlos requiere contactar a soporte técnico.',
  },
}

interface DeleteLevelDialogProps {
  open: boolean
  onClose: () => void
  level: DeleteLevel
  id: string
  /**
   * Se dispara SOLO tras un borrado exitoso, y el modal padre lo usa para cerrarse.
   *
   * Sin esto el usuario se queda mirando el detalle de algo que acaba de eliminar: el
   * dialogo se cierra, el modal no, y la accion parece no haber surtido efecto aunque el
   * backend respondio 200. Es distinto de `onClose`, que tambien corre al cancelar.
   */
  onDeleted?: () => void
}

export function DeleteLevelDialog({ open, onClose, level, id, onDeleted }: DeleteLevelDialogProps) {
  const { titulo, items, consecuencia } = TEXTOS[level]
  const { data: impact, isFetching } = useDeleteImpact(level, id, open)
  const del = useDeleteLevel(level, id)

  // FlushSessionDialog cierra el dialogo en su propio onSuccess; aqui se encadena el aviso
  // al padre sin que el dialogo tenga que saber que existe un modal por encima.
  const flush = {
    isPending: del.isPending,
    mutate: (_v: undefined, opts?: { onSuccess?: () => void }) =>
      del.mutate(undefined, {
        onSuccess: () => {
          opts?.onSuccess?.()
          onDeleted?.()
        },
      }),
  }

  return (
    <FlushSessionDialog
      open={open}
      onClose={onClose}
      flush={flush}
      title={titulo}
      itemsLabel={items}
      consequence={consecuencia}
      impact={impact}
      impactLoading={isFetching}
    />
  )
}
