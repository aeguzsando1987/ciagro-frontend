/**
 * Resuelve rutas de `media/` que sirve el backend.
 *
 * Django devuelve rutas RELATIVAS (`/media/attachments/...`). El front corre en
 * otro origen que la API, asi que el navegador las pediria a SU propio host y daria
 * 404 sin decir nada: la imagen simplemente no aparece.
 *
 * No se guardan absolutas en la base a proposito: `stats_snapshot` es un snapshot
 * permanente, y una URL con el dominio de hoy dejaria de servir al mover el sistema
 * de servidor. El origen se resuelve al pintar.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined

/** Origen de la API, sin el sufijo `/api/v1`. */
function apiOrigin(): string {
  if (!API_BASE) return ''
  return API_BASE.replace(/\/api\/v\d+\/?$/, '').replace(/\/$/, '')
}

/**
 * URL absoluta de un archivo de `media/`, o `null` si no hay ruta.
 * Una URL ya absoluta (S3, CDN) se devuelve tal cual.
 */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${apiOrigin()}${path.startsWith('/') ? '' : '/'}${path}`
}
