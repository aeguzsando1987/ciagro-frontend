import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'
import { radarPreviewSchema } from '../radarContract'

export function useAspersionRadar(objectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['aspersion-radar', objectId], enabled, staleTime: 30_000,
    refetchOnWindowFocus: 'always',
    refetchInterval: enabled ? 30_000 : false,
    queryFn: async () => {
      // New read-only route; validate its JSON until the OpenAPI types are regenerated.
      const { data, response } = await apiClient.GET(
        '/api/v1/field_ops/aspersion-sessions/{id}/radar/' as never,
        { params: { path: { id: objectId } } } as never,
      )
      if (!response.ok) throw new Error(response.status === 404
        ? 'La sesión no está disponible o el backend local no incluye la consulta del radar.'
        : response.status === 403 ? 'No tienes permiso para consultar esta sesión.'
          : `No se pudo consultar el radar (HTTP ${response.status}).`)
      const result = radarPreviewSchema.safeParse(data)
      if (!result.success || result.data.object_id !== objectId) {
        throw new Error('El servidor devolvió una evaluación con formato incorrecto. Reintenta o revisa la versión del backend.')
      }
      return result.data
    },
    retry: false,
  })
}
