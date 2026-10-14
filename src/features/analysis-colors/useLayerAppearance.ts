/** Independent appearance configuration for four non-NDVI, non-phyto session types. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'
import { doRefresh } from '@/lib/api/client'

export type AppearanceKind = 'aspersion' | 'soil_map' | 'yield_map' | 'planting_map'
export type LayerAppearance = {
  colors?: string[]
  /** Ascending numeric thresholds: length must equal colors.length-1. */
  breaks?: number[]
  /** Optional stable legend extremes per organization; stored in Django JSON. */
  range_min?: number
  range_max?: number
  category_colors?: Record<string, string>
}
export type AppearanceResponse = { tenant: string; session_type: AppearanceKind; layers: Record<string, LayerAppearance> }
const baseUrl = import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')

function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const obj = body as Record<string, unknown>
  for (const key of ['detail', 'tenant', 'error', 'message']) {
    const value = obj[key]
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value.map(String).join('; ')
  }
  return null
}

function explanation(status: number): string {
  switch (status) {
    case 401: return 'La sesión expiró o falta autenticación; vuelve a iniciar sesión.'
    case 403: return 'El usuario no tiene permiso para consultar esta organización.'
    case 404: return 'El backend todavía no tiene activa la ruta de colores; verifica que se copió y reconstruyó.'
    case 500: return 'Error interno del backend. Revisa logs y ejecuta la migración analytics_config (0004).'
    case 502:
    case 503:
    case 504: return 'El proxy o el backend no está disponible.'
    default: return `Error HTTP ${status} al consultar la API.`
  }
}

async function request(method: 'GET' | 'PATCH' | 'DELETE', kind: AppearanceKind, tenantId?: string, dcId?: string, layer?: string, config?: LayerAppearance): Promise<AppearanceResponse> {
  const params = new URLSearchParams()
  if (tenantId) params.set('tenant', tenantId)
  else if (dcId) params.set('dc', dcId)
  if (method === 'DELETE' && layer) params.set('layer', layer)
  const path = `/analytics-config/layers/${kind}/`
  const url = `${baseUrl}${path}?${params.toString()}`
  const perform = (token: string | null) => fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(method === 'PATCH' ? { body: JSON.stringify({layer,config}) } : {}),
  })
  let response: Response
  try {
    response = await perform(tokens.getAccess())
    if (response.status === 401 && tokens.getRefresh()) {
      const access = await doRefresh()
      response = await perform(access)
    }
  } catch (err) {
    throw new Error(`No hay conexión con la API (${path}). ${err instanceof Error ? err.message : 'Verifica que Docker y el túnel estén funcionando.'}`)
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = extractMessage(body)
    throw new Error(`${explanation(response.status)}${detail ? ` Detalle: ${detail}` : ''} Ruta: ${path}`)
  }
  // Proxies accidentally serving an HTML fallback should never enable the save button.
  if (!body || typeof body !== 'object' || !('layers' in body) || !('session_type' in body) ||
      (body as AppearanceResponse).session_type !== kind ||
      typeof (body as AppearanceResponse).layers !== 'object' ||
      (body as AppearanceResponse).layers === null) {
    throw new Error(`La ruta ${path} respondió sin los datos esperados. Verifica proxy /api/v1 y versión de backend.`)
  }
  return body as AppearanceResponse
}

const cacheKey = (kind: AppearanceKind, tenantId?: string, dcId?: string) => ['layer-appearance',kind,tenantId ?? '',dcId ?? ''] as const

/** Read as permitted to organization members; falls back to original colors on API errors. */
export function useLayerAppearance(kind: AppearanceKind, tenantId?: string, dcId?: string, enabled = true) {
  return useQuery({queryKey:cacheKey(kind,tenantId,dcId), queryFn:()=>request('GET',kind,tenantId,dcId), retry:false, staleTime:60_000, enabled})
}

export function useSaveLayerAppearance(kind: AppearanceKind, tenantId?: string, dcId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn:({layer,config}:{layer:string;config:LayerAppearance})=>request('PATCH',kind,tenantId,dcId,layer,config),
    onSuccess:()=>qc.invalidateQueries({queryKey:['layer-appearance',kind]}),
  })
}

export function useResetLayerAppearance(kind: AppearanceKind, tenantId?: string, dcId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn:(layer:string)=>request('DELETE',kind,tenantId,dcId,layer),
    onSuccess:()=>qc.invalidateQueries({queryKey:['layer-appearance',kind]}),
  })
}

/** Retain original palette if user has not changed the layer. */
export function appearancePalette(defaults: readonly string[], appearance?: LayerAppearance): string[] {
  return appearance?.colors?.length ? [...appearance.colors] : [...defaults]
}

export function appearanceCategoryColor(original: string, key: string, appearance?: LayerAppearance): string {
  return appearance?.category_colors?.[key] ?? original
}

export function colorStops(defaults: readonly string[], n: number) {
  if (n === defaults.length) return [...defaults]
  return Array.from({length:n},(_,i)=>defaults[Math.round(i*(defaults.length-1)/(n-1))]!)
}
