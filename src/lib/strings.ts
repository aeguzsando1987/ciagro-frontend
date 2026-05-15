/**
 * Strings compartidos entre features (decisión Paso 10).
 *
 * Sólo entran acá los strings que aparecen en >1 lugar (status de Programa,
 * roles, acciones comunes). Los strings de un solo uso van inline en el JSX.
 *
 * Cuando se active la migración a react-i18next (GAP-FUTURO-002), este
 * objeto se transforma en `es-MX.json` con un script (las keys son los
 * paths del objeto: 'statusLabels.pending', etc.).
 */

export const statusLabels = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  loaded: 'Cargado',
  completed: 'Completado',
  cancelled: 'Cancelado',
} as const

export const roleLabels = {
  1: 'Invitado',
  2: 'Técnico',
  3: 'Ingeniero / Supervisor',
  4: 'Gerente',
  5: 'SuperAdmin',
} as const

export const commonActions = {
  save: 'Guardar',
  cancel: 'Cancelar',
  delete: 'Eliminar',
  edit: 'Editar',
  create: 'Crear',
  back: 'Volver',
  close: 'Cerrar',
  confirm: 'Confirmar',
  loading: 'Cargando…',
  search: 'Buscar',
} as const

export const commonErrors = {
  generic: 'Ocurrió un error inesperado. Por favor, intentá nuevamente.',
  network: 'No pudimos conectar con el servidor. Verificá tu conexión.',
  unauthorized: 'Tu sesión expiró. Iniciá sesión nuevamente.',
  forbidden: 'No tenés permiso para realizar esta acción.',
  notFound: 'No se encontró el recurso solicitado.',
} as const
