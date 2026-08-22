import type { VisorLevel } from '../types'

/**
 * Nivel por el que arranca el árbol del explorador, según lo que el usuario alcanza.
 *
 * La regla es una sola: **un nivel con un solo hijo no se pinta**. Atravesar un nodo
 * que no ofrece ninguna elección es trabajo sin información — el usuario expande para
 * encontrar exactamente una cosa. Se detiene en agrounidad: rancho y parcela siempre
 * se muestran, porque son el grano con el que se trabaja y esconderlos dejaría el
 * árbol sin ningún ancestro visible.
 *
 * De esa regla salen solos los tres casos del caso de uso:
 *
 *   1 organización, 1 CIAgro, 1 productor   -> arranca en AGROUNIDAD
 *   1 organización, varias CIAgros          -> arranca en CIAGRO HIJA
 *   varias organizaciones                   -> arranca en ORGANIZACIÓN
 *
 * y además cubre las combinaciones que no estaban enumeradas, como varias
 * organizaciones con una sola CIAgro cada una.
 *
 * Se cuenta lo que el usuario **realmente ve**, no sus filas de asignación: desde la
 * fase PS un técnico puede estar asignado a una CIAgro de cinco productores y alcanzar
 * las parcelas de uno solo. Contar asignaciones le haría atravesar niveles que para él
 * tienen un único hijo, que es justo lo que esta regla evita.
 */
export type ExplorerRoot = Extract<VisorLevel, 'org' | 'datacentral' | 'producer'>

export interface ScopeCounts {
  /** Organizaciones (DataCentralMain) visibles. */
  orgs: number
  /** CIAgros hijas visibles, sumadas todas las organizaciones. */
  datacentrals: number
}

/**
 * No recibe el número de productores a propósito: como la regla se detiene en
 * agrounidad, con una sola CIAgro se arranca ahí haya uno o veinte. Pedir un dato que
 * no cambia el resultado obligaría a una consulta extra y haría creer que influye.
 */
export function resolveExplorerRoot({ orgs, datacentrals }: ScopeCounts): ExplorerRoot {
  // Más de una organización: la organización sí es una elección.
  if (orgs > 1) return 'org'
  // Una sola organización pero varias CIAgros: la elección empieza en la CIAgro.
  if (datacentrals > 1) return 'datacentral'
  // Una sola CIAgro. Si además hay un solo productor, tampoco es una elección, pero
  // aquí paramos: el productor es el ancestro más profundo que el árbol conserva.
  if (datacentrals === 1) return 'producer'
  // Sin ninguna CIAgro visible no hay nada que colapsar; el árbol dirá que está vacío
  // en su nivel raíz habitual.
  return 'org'
}
