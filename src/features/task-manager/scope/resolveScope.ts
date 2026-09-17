/**
 * Con que CIAgro se abre el Task Manager.
 *
 * El Task Manager trabaja siempre sobre UNA CIAgro hija concreta. Antes elegirla
 * costaba dos pantallas previas; ahora se entra derecho a una y el cambio se hace con
 * los selectores que viven DENTRO de la propia pantalla. Por eso aqui no hay ningun
 * caso "elegir": esta funcion solo decide con cual se abre.
 *
 * Es una funcion pura y no logica suelta dentro del `beforeLoad` de la ruta por la
 * misma razon que `entryTarget.resolveEntryDecision`: un guard de redireccion pasa con
 * facilidad sin llegar a ejercitarse, y aqui se decide a que pantalla entra todo el
 * mundo. Separada se cubre con una tabla de casos.
 *
 * La lista de CIAgros alcanzables sale de `/users/me/`, que es EXACTAMENTE el criterio
 * del guard de `/w/$dc` (`routes/w.$dc.tsx`): abrir una que no este aqui la haria
 * rebotar.
 */
import type { WorkspaceDataCentral, WorkspaceDataCentralMain } from '@/types/auth'

export interface TaskManagerScopeInput {
  /** CIAgros hijas alcanzables, tal cual vienen de /users/me/. */
  datacentrals: WorkspaceDataCentral[] | undefined | null
  /** Ultima CIAgro usada, si se recordo alguna. */
  rememberedDcId?: string | null
}

export type TaskManagerScope = { kind: 'sin-acceso' } | { kind: 'directo'; dcId: string }

/** Orden en el que se presentan las CIAgros al usuario. Uno solo, para que la que abre por defecto sea la misma que encabeza el selector. */
function porNombre<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'es-MX'))
}

/** CIAgros padre presentes en las hijas alcanzables, sin repetir y ordenadas por nombre. */
export function mainsFrom(datacentrals: WorkspaceDataCentral[]): WorkspaceDataCentralMain[] {
  const porId = new Map<string, WorkspaceDataCentralMain>()
  for (const dc of datacentrals) {
    if (!porId.has(dc.data_central_main.id)) porId.set(dc.data_central_main.id, dc.data_central_main)
  }
  return porNombre([...porId.values()])
}

/** Hijas de una CIAgro padre concreta, ordenadas por nombre. */
export function childrenOfMain(
  datacentrals: WorkspaceDataCentral[],
  mainId: string | undefined
): WorkspaceDataCentral[] {
  if (!mainId) return []
  return porNombre(datacentrals.filter((dc) => dc.data_central_main.id === mainId))
}

/**
 * Decide con que CIAgro se abre el Task Manager.
 *
 *   sin CIAgros                      -> sin-acceso
 *   hay una recordada y sigue valida -> esa
 *   resto                            -> la primera por nombre
 *
 * Se abre con la recordada porque quien trabaja siempre en la misma no tiene por que
 * reencontrarla en cada visita; y con la primera cuando no hay recuerdo porque una
 * pantalla vacia pidiendo que elijas es, otra vez, un tramite antes del trabajo. En
 * ambos casos el usuario cambia de CIAgro sin salir del Task Manager.
 *
 * Una CIAgro recordada que ya no este en el alcance se descarta en silencio: que a un
 * usuario le quiten una asignacion es normal, y no es motivo para mostrarle un error.
 */
export function resolveTaskManagerScope({
  datacentrals,
  rememberedDcId,
}: TaskManagerScopeInput): TaskManagerScope {
  const alcanzables = datacentrals ?? []
  if (alcanzables.length === 0) return { kind: 'sin-acceso' }

  const recordada = rememberedDcId
    ? alcanzables.find((dc) => dc.id === rememberedDcId)
    : undefined
  if (recordada) return { kind: 'directo', dcId: recordada.id }

  // porNombre garantiza que la que se abre sea la misma que encabeza el selector.
  const primera = porNombre(alcanzables)[0]!
  return { kind: 'directo', dcId: primera.id }
}
