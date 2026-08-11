/**
 * Modelo de selección del Visor de Datos Agrícolas.
 *
 * El explorador emite una `VisorSelection` que describe el nodo seleccionado y toda su
 * ruta de ancestros (organización → … → sesión). El dashboard la consume para saber qué
 * estadísticas/mapa mostrar. `level` indica cuál de los niveles es el nodo activo.
 */
export type VisorLevel = 'org' | 'datacentral' | 'producer' | 'ranch' | 'plot' | 'session'

/** Tipo de sesión seleccionada a nivel 'session' — decide qué mapa/stats renderiza el dashboard. */
export type SessionKind = 'aspersion' | 'phyto' | 'ndvi' | 'soil_map'

/**
 * Resultado de la búsqueda avanzada (fase AS).
 *
 * El backend devuelve la jerarquía ya armada, así que el explorador en modo resultados
 * no vuelve a pedir nada por nivel: pinta este árbol tal cual. `kind` es el mismo
 * `SessionKind` de la selección, por lo que el dashboard existente renderiza cualquiera
 * de los cuatro tipos sin cambios.
 */
export interface SearchSessionRef {
  id: string
  kind: SessionKind
  date: string | null
  points_count: number
}

export interface SearchPlotNode {
  id: string
  code: string
  sessions: SearchSessionRef[]
}

export interface SearchRanchNode {
  id: string
  name: string
  plots: SearchPlotNode[]
}

export interface SearchProducerNode {
  id: string
  name: string
  /**
   * Organización que representa al productor en este resultado (la elegida en el
   * modal o, si no se eligió ninguna, la de su asignación más antigua). El explorador
   * la necesita porque toda `VisorSelection` lleva `org`, y de ahí sale el tenant con
   * el que el mapa NDVI pide su paleta. `null` si el productor perdió sus asignaciones.
   */
  organization: VisorRef | null
  ranches: SearchRanchNode[]
}

export interface AdvancedSearchResult {
  /** Sesiones devueltas (ya recortadas si `truncated`). */
  count: number
  /** Coincidencias totales antes del recorte. */
  total: number
  truncated: boolean
  plot_ids: string[]
  producers: SearchProducerNode[]
}

export interface VisorRef {
  id: string
  name: string
}

export interface VisorSession {
  id: string
  date: string | null
  kind: SessionKind
}

export interface VisorSelection {
  level: VisorLevel
  org: VisorRef
  datacentral?: VisorRef
  producer?: VisorRef
  ranch?: VisorRef
  plot?: VisorRef
  session?: VisorSession
}

/** Id del nodo activo según su nivel — para resaltar la fila seleccionada en el árbol. */
export function activeIdFor(sel: VisorSelection | null): string | null {
  if (!sel) return null
  switch (sel.level) {
    case 'org': return sel.org.id
    case 'datacentral': return sel.datacentral?.id ?? null
    case 'producer': return sel.producer?.id ?? null
    case 'ranch': return sel.ranch?.id ?? null
    case 'plot': return sel.plot?.id ?? null
    case 'session': return sel.session?.id ?? null
  }
}
