/**
 * Etiquetas y variantes canonicas de las sesiones de campo.
 *
 * Antes de la homologacion de modales estos mapas vivian duplicados en cuatro archivos
 * (YieldSesionModal, NdviSesionModal, SesionModal y HijoModal) y ademas divergian: el mismo
 * import_status 'done' se leia "Completado" en Rendimiento y NDVI pero "Cargado" en aspersion,
 * suelo y el arbol. El usuario veia dos nombres para el mismo dato segun por donde entrara.
 *
 * Se toma como canonico el juego de Rendimiento, que es la referencia de diseno, y ademas evita
 * la colision de "Cargado" con el estado de sesion `loaded`, que tambien se llama asi.
 */

import type { BadgeProps } from '@/components/ui/badge'

type BadgeVariant = NonNullable<BadgeProps['variant']>

/** Estado del proceso de importacion del CSV de la sesion. */
export const IMPORT_STATUS_LABELS: Record<string, string> = {
  pending: 'Sin importar',
  processing: 'Procesando',
  done: 'Completado',
  error: 'Error',
  pending_mapping: 'Mapeo pendiente',
}

/** Estado operativo de la sesion, independiente de si hay datos cargados. */
export const SESION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  loaded: 'Cargado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const IMPORT_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending: 'outline',
  processing: 'info',
  done: 'success',
  error: 'danger',
  pending_mapping: 'warning',
}

const SESION_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending: 'secondary',
  in_progress: 'info',
  loaded: 'default',
  completed: 'success',
  cancelled: 'danger',
}

/**
 * Etiqueta legible de un import_status. Devuelve el codigo crudo si el backend introduce
 * un estado nuevo: es preferible mostrar `pending_review` que una celda vacia.
 */
export function importStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return IMPORT_STATUS_LABELS[status] ?? status
}

export function importStatusVariant(status: string | null | undefined): BadgeVariant {
  if (!status) return 'outline'
  return IMPORT_STATUS_VARIANTS[status] ?? 'outline'
}

export function sesionStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return SESION_STATUS_LABELS[status] ?? status
}

export function sesionStatusVariant(status: string | null | undefined): BadgeVariant {
  if (!status) return 'secondary'
  return SESION_STATUS_VARIANTS[status] ?? 'secondary'
}

/**
 * Normaliza points_count a numero.
 * Los serializers no coinciden: aspersion y suelo lo exponen como string (drf-spectacular
 * tipa el SerializerMethodField sin anotar como string), rendimiento y NDVI como numero.
 * Cada modal resolvia esto a su manera; aqui hay una sola conversion tolerante a ambas.
 */
export function pointsCount(value: string | number | null | undefined): number {
  if (value == null) return 0
  const parsed = typeof value === 'number' ? value : parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : 0
}
