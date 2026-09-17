import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { childrenOfMain, mainsFrom } from './resolveScope'
import type { WorkspaceDataCentral } from '@/types/auth'

interface TaskManagerScopePickerProps {
  /** CIAgros hijas alcanzables por el usuario, tal cual vienen de /users/me/. */
  datacentrals: WorkspaceDataCentral[]
  /** CIAgro con la que esta abierto el Task Manager ahora mismo. */
  currentDcId: string
}

const selectClass = 'h-9 rounded border border-input bg-background px-2 text-sm'

/**
 * Los dos selectores de alcance del Task Manager: CIAgro padre y CIAgro hija.
 *
 * Viven DENTRO de la pantalla, junto a los filtros, y no en un paso previo. Esa es toda
 * la fase: antes habia que recorrer dos pantallas de seleccion para llegar aqui, y
 * cambiar de CIAgro obligaba a salir del modulo y volver a entrar. Ahora cambiar de
 * CIAgro es cambiar el parametro de la ruta: el Gantt se recarga, la pantalla no.
 *
 * El selector de organizacion solo se pinta cuando el usuario alcanza mas de una: con
 * una sola, mostrarlo es pedir un clic cuya respuesta ya se conoce.
 *
 * Se usan <select> nativos, que es lo que ya hace FilterBar aqui al lado, en lugar de
 * traer shadcn/Select solo para esto. Las listas son cortas -- el perfil mas cargado
 * del sistema llega a siete organizaciones -- asi que un desplegable con busqueda no
 * tiene a quien servir todavia.
 */
export function TaskManagerScopePicker({
  datacentrals,
  currentDcId,
}: TaskManagerScopePickerProps) {
  const navigate = useNavigate()
  const mains = mainsFrom(datacentrals)
  const mainDeLaActual = datacentrals.find((dc) => dc.id === currentDcId)?.data_central_main.id

  /**
   * Organizacion que se esta mirando. Normalmente es la de la CIAgro abierta; se separa
   * en estado propio para el momento intermedio en que el usuario cambia de
   * organizacion y todavia no ha elegido CIAgro dentro de ella.
   */
  const [mainElegida, setMainElegida] = useState<string | undefined>(undefined)
  const mainId = mainElegida ?? mainDeLaActual

  // Al cambiar de CIAgro (por el selector o por cualquier otra navegacion) el estado
  // intermedio sobra: manda otra vez la organizacion de la CIAgro abierta.
  useEffect(() => {
    setMainElegida(undefined)
  }, [currentDcId])

  const hijas = childrenOfMain(datacentrals, mainId)
  // Mientras se mira otra organizacion, la CIAgro abierta no esta entre sus hijas y el
  // selector debe quedar en el placeholder, no fingir una seleccion que no existe.
  const valorHija = hijas.some((dc) => dc.id === currentDcId) ? currentDcId : ''

  return (
    <div className="flex flex-wrap items-end gap-3">
      {mains.length > 1 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="scope-main" className="text-xs text-muted-foreground">
            Organización
          </label>
          <select
            id="scope-main"
            className={selectClass}
            value={mainId ?? ''}
            onChange={(e) => setMainElegida(e.target.value || undefined)}
          >
            {mains.map((main) => (
              <option key={main.id} value={main.id}>
                {main.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="scope-dc" className="text-xs text-muted-foreground">
          CIAgro
        </label>
        <select
          id="scope-dc"
          className={selectClass}
          value={valorHija}
          onChange={(e) => {
            const dcId = e.target.value
            if (dcId) void navigate({ to: '/w/$dc/task-manager', params: { dc: dcId } })
          }}
        >
          {!valorHija && <option value="">Selecciona una CIAgro</option>}
          {hijas.map((dc) => (
            <option key={dc.id} value={dc.id}>
              {dc.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
