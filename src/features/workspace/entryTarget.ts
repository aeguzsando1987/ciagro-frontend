/**
 * A dónde lleva elegir una CIAgro.
 *
 * El selector dejó de ser la entrada del sistema: el login va directo al Visor. Ahora
 * solo aparece en el camino del Task Manager, cuyos datos sí son de una CIAgro concreta
 * y no tienen equivalente al árbol del Visor.
 *
 * Vive aparte porque el destino se decide en cinco sitios —las tres entradas por rol,
 * el selector de CIAgro hija y el menú— y repetir el condicional en cada uno es la
 * forma más fácil de que uno se quede atrás y lleve al usuario al sitio equivocado.
 */
export type EntryTarget = 'task-manager' | undefined

interface Destino {
  to: '/w/$dc/task-manager' | '/w/$dc/visor'
  params: { dc: string }
}

/** Ruta a la que navegar tras elegir la CIAgro `dcId`. */
export function targetRouteFor(dcId: string, next: EntryTarget): Destino {
  return next === 'task-manager'
    ? { to: '/w/$dc/task-manager', params: { dc: dcId } }
    : { to: '/w/$dc/visor', params: { dc: dcId } }
}

/** CIAgro tal como la expone `/users/me/`: lo mínimo para decidir la entrada. */
interface DatacentralAlcanzable {
  id: string
}

export type EntryDecision =
  | { kind: 'sin-acceso' }
  | { kind: 'unica'; dcId: string }
  | { kind: 'elegir-en-el-arbol' }

/**
 * Qué hacer al iniciar sesión, según cuántas CIAgros alcanza el usuario.
 *
 * Es una función aparte y no lógica suelta dentro del `beforeLoad` para poder probarla:
 * un guard de redirección pasa con facilidad sin llegar a ejercitarse, y aquí se decide
 * a qué pantalla entra todo el mundo.
 *
 *   ninguna   -> `/workspaces`, que decide entre el wizard de primer uso y la pantalla
 *                de sin acceso. No es cosa de esta función distinguirlos.
 *   una       -> se entra directo a la suya: elegir sería un trámite de un botón.
 *   varias    -> no se preselecciona ninguna. El árbol del explorador ya arranca en el
 *                nivel que su alcance justifica, así que elegir aquí sería pedir dos
 *                veces lo mismo.
 */
export function resolveEntryDecision(
  datacentrals: DatacentralAlcanzable[] | undefined | null
): EntryDecision {
  const alcanzables = datacentrals ?? []
  if (alcanzables.length === 0) return { kind: 'sin-acceso' }
  const unica = alcanzables.length === 1 ? alcanzables[0] : null
  if (unica) return { kind: 'unica', dcId: unica.id }
  return { kind: 'elegir-en-el-arbol' }
}
