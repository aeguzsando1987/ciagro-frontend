/**
 * Modelo de selección del Visor de Datos Agrícolas.
 *
 * El explorador emite una `VisorSelection` que describe el nodo seleccionado y toda su
 * ruta de ancestros (organización → … → sesión). El dashboard la consume para saber qué
 * estadísticas/mapa mostrar. `level` indica cuál de los niveles es el nodo activo.
 */
export type VisorLevel = 'org' | 'datacentral' | 'producer' | 'ranch' | 'plot' | 'session'

/** Tipo de sesión seleccionada a nivel 'session' — decide qué mapa/stats renderiza el dashboard. */
export type SessionKind = 'aspersion' | 'phyto'

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
