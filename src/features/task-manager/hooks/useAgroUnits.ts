import { queryOptions, useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import type { components } from '@/types/api'

export type AgroUnit = components['schemas']['AgroUnit']

/**
 * Tipos de AgroUnit válidos como dueño de un Programa Maestro o Subprograma.
 * Caso de uso §1.2.3: el productor es de tipo "Productor" o "Asociación agrícola".
 * Los valores coinciden con AgroUnit.UnitType del backend.
 */
const MASTER_OWNER_TYPES: readonly string[] = ['Productor', 'Asociación agrícola']

/**
 * QueryOptions para la lista de productores/asociaciones de un workspace.
 *
 * GET /api/v1/organizations/?datacentral=<uuid>
 *
 * El backend (AgroUnitListView) aplica el scope multi-tenant: con `datacentral`
 * acota a las AgroUnit asignadas a ese workspace. El filtrado por categoría
 * (Productor / Asociación agrícola) se hace en cliente porque el endpoint solo
 * admite un `unit_type` a la vez y necesitamos ambos — no es filtrado de scope,
 * así que no viola la regla crítica #7.
 *
 * @param datacentral UUID del workspace activo. Si se omite, el backend acota
 *   al scope global del usuario.
 */
export function agroUnitsQueryOptions(datacentral?: string) {
  return queryOptions({
    queryKey: ['agro-units', datacentral ?? 'all'] as const,
    queryFn: async (): Promise<AgroUnit[]> => {
      // `datacentral` no figura en el OpenAPI schema de /organizations/ pero el
      // backend lo acepta para el scope por workspace (mismo gap menor que en
      // master-programs). Cast localizado hasta que se documente en el schema.
      const query: Record<string, string> = {}
      if (datacentral) query.datacentral = datacentral

      const { data, error } = await apiClient.GET('/api/v1/organizations/', {
        params: { query: query as never },
      })
      if (error) throw new Error('No se pudo cargar la lista de productores')

      const results = data?.results ?? []
      return results.filter((u) => MASTER_OWNER_TYPES.includes(u.unit_type ?? ''))
    },
    staleTime: 60_000,
  })
}

/**
 * Hook que carga los productores/asociaciones del workspace activo.
 * @param datacentral UUID del workspace; reactivo a su cambio vía queryKey.
 */
export function useAgroUnits(datacentral?: string) {
  return useQuery(agroUnitsQueryOptions(datacentral))
}
