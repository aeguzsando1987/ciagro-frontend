import { tokens } from '@/lib/auth/tokens'

const baseUrl = import.meta.env.VITE_API_BASE_URL as string

export class PlantingApiError extends Error {
  payload: unknown
  status: number

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'PlantingApiError'
    this.status = status
    this.payload = payload
  }
}

export async function plantingApiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  const token = tokens.getAccess()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${baseUrl}${path}`, { ...init, headers })
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'detail' in payload
        ? String((payload as { detail?: unknown }).detail)
        : `Error HTTP ${response.status}`
    throw new PlantingApiError(message, response.status, payload)
  }

  return payload as T
}
