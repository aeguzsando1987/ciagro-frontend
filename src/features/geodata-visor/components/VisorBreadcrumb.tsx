import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { breadcrumbTrail, selectionAtStep } from '../lib/breadcrumbTrail'
import { sessionDateTime } from '../lib/aspersionSessionTime'
import type { VisorSelection } from '../types'

/**
 * Migas de pan del Visor: dónde está el usuario, de un vistazo.
 *
 * Hacen falta porque la izquierda no siempre lo dice: el explorador oculta los niveles
 * en los que el alcance del usuario no ofrece elección, y el árbol se desplaza al
 * navegar en profundidad.
 *
 * Cada escalón anterior es pulsable y sube a ese nivel, así que las migas son también
 * el camino de vuelta al panel de la CIAgro desde cualquier profundidad. El último no
 * lo es: es donde ya se está.
 */
export function VisorBreadcrumb({
  selection,
  onSelect,
}: {
  selection: VisorSelection
  onSelect: (sel: VisorSelection) => void
}) {
  const pasos = breadcrumbTrail(selection)

  return (
    <Breadcrumb>
      <BreadcrumbList className="gap-1 sm:gap-1.5">
        {pasos.map((paso, i) => {
          const ultimo = i === pasos.length - 1
          return (
            <BreadcrumbItem key={`${paso.level}-${paso.id}`}>
              {ultimo ? (
                <BreadcrumbPage className="font-semibold">
                  {selection.session?.kind === 'aspersion' && selection.session.aspersion_start_at ? (
                    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>Inicio: {sessionDateTime(selection.session.aspersion_start_at)}</span>
                      {selection.session.aspersion_finish_at && (
                        <span>Fin: {sessionDateTime(selection.session.aspersion_finish_at)}</span>
                      )}
                    </span>
                  ) : paso.name}
                </BreadcrumbPage>
              ) : (
                <>
                  <button
                    type="button"
                    className="max-w-[160px] truncate rounded text-muted-foreground transition-colors hover:text-foreground hover:underline"
                    title={paso.name}
                    onClick={() => onSelect(selectionAtStep(selection, paso.level))}
                  >
                    {paso.name}
                  </button>
                  <BreadcrumbSeparator />
                </>
              )}
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
