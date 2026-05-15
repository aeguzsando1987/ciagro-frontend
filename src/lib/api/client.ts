import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from '@/types/api'
import { tokens } from '@/lib/auth/tokens'
import { useAuthStore } from '@/features/auth/useAuthStore'

const baseUrl = import.meta.env.VITE_API_BASE_URL
if (!baseUrl) {
  throw new Error(
    'VITE_API_BASE_URL no esta definida. Copia .env.example a .env.local y completa el valor.'
  )
}

// El OpenAPI schema generado por openapi-typescript incluye /api/v1/ en cada path.
// VITE_API_BASE_URL tradicionalmente termina en /api/v1 para los hooks que usan
// fetch directo (Fase 1). Quitamos ese sufijo solo para apiClient para evitar
// concatenacion duplicada (/api/v1/api/v1/...).
const apiClientBaseUrl = baseUrl.replace(/\/api\/v1\/?$/, '')

// ---------- refresh mutex ----------
// Si dos requests simultáneos reciben 401, solo uno llama al endpoint /auth/refresh/;
// el otro espera al mismo promise. Evita que simplejwt invalide el refresh token
// con rotación doble.
let refreshPromise: Promise<string> | null = null

async function doRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise

  refreshPromise = (async () => {
    try {
      const refresh = tokens.getRefresh()
      if (!refresh) throw new Error('Sin refresh token')

      const res = await fetch(`${baseUrl}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })

      if (!res.ok) throw new Error('Refresh fallido')

      const data = (await res.json()) as { access: string }
      tokens.setAccess(data.access)
      return data.access
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

function forceLogout(): void {
  tokens.clear()
  useAuthStore.getState().clearUser()
  // Fuera de React: hard redirect para limpiar estado en memoria.
  window.location.replace('/login')
}

// ---------- middlewares ----------

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const token = tokens.getAccess()
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
    }
    return request
  },
}

const refreshMiddleware: Middleware = {
  async onResponse({ request, response }) {
    if (response.status !== 401) return response

    const refresh = tokens.getRefresh()
    if (!refresh) {
      forceLogout()
      return response
    }

    try {
      const newAccess = await doRefresh()

      // Solo reintentamos GET: los cuerpos de POST/PUT ya fueron consumidos por
      // el primer envío. Para mutaciones, el caller (TanStack Query mutation) debe
      // reintentar si lo necesita; el token ya está actualizado para ese reintento.
      if (request.method === 'GET') {
        const headers = new Headers(request.headers)
        headers.set('Authorization', `Bearer ${newAccess}`)
        return fetch(request.url, { method: 'GET', headers })
      }

      return response
    } catch {
      forceLogout()
      return response
    }
  },
}

export const apiClient = createClient<paths>({ baseUrl: apiClientBaseUrl })
apiClient.use(authMiddleware)
apiClient.use(refreshMiddleware)
