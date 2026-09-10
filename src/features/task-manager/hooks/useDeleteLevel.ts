/**
 * Borrado por niveles: preview, ejecución y restauración.
 *
 * Las rutas históricas siguen usando apiClient porque ya están en api.d.ts. Rendimiento
 * todavía no forma parte del cliente OpenAPI generado en este checkout, así que su par
 * preview/delete usa fetch autenticado sin degradar el tipado del resto del módulo.
 */
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'

import { apiClient } from '@/lib/api/client'
import { tokens } from '@/lib/auth/tokens'
import type { DeleteImpact } from '@/features/task-manager/types'

export type DeleteLevel =
  | 'aspersion'
  | 'soil_map'
  | 'ndvi'
  | 'phyto'
  | 'yield_map'
  | 'programa'
  | 'master'

type TypedDeleteLevel = Exclude<DeleteLevel, 'yield_map'>

const CLAVES_DE_ESTRUCTURA: QueryKey[] = [['master-tree'], ['master-programs']]

interface Spec {
  noun: string
  extra: (id: string) => QueryKey[]
}

const SPECS: Record<DeleteLevel, Spec> = {
  aspersion: {
    noun: 'la sesión de aspersión',
    extra: (id) => [
      ['aspersion-detail', id],
      ['aspersion-points', id],
      ['aspersion-session-stats'],
    ],
  },
  soil_map: {
    noun: 'la sesión de mapeo de suelo',
    extra: (id) => [['soil-map-detail', id], ['soil-map-points', id], ['soil-map']],
  },
  ndvi: {
    noun: 'la sesión de NDVI',
    extra: (id) => [
      ['ndvi-detail', id],
      ['ndvi-points', id],
      ['ndvi-variable-stats', id],
      ['ndvi'],
    ],
  },
  phyto: {
    noun: 'la sesión fitosanitaria',
    extra: (id) => [
      ['phyto-detail', id],
      ['phyto-checkpoints', id],
      ['phyto-session-stats', id],
    ],
  },
  yield_map: {
    noun: 'la sesión de rendimiento',
    extra: (id) => [
      ['yield-map-detail', id],
      ['yield-map-points', id],
      ['yield-map-stats', id],
      ['yield-map', 'headers'],
    ],
  },
  programa: { noun: 'el subprograma', extra: (id) => [['hijo-detail', id]] },
  master: { noun: 'el programa maestro', extra: (id) => [['master-detail', id]] },
}

const RUTAS = {
  aspersion: {
    preview: '/api/v1/monitoring/aspersion/headers/{id}/delete-preview/',
    remove: '/api/v1/monitoring/aspersion/headers/{id}/delete/',
  },
  soil_map: {
    preview: '/api/v1/monitoring/soil-map/headers/{id}/delete-preview/',
    remove: '/api/v1/monitoring/soil-map/headers/{id}/delete/',
  },
  ndvi: {
    preview: '/api/v1/monitoring/ndvi/headers/{id}/delete-preview/',
    remove: '/api/v1/monitoring/ndvi/headers/{id}/delete/',
  },
  phyto: {
    preview: '/api/v1/monitoring/phyto/headers/{id}/delete-preview/',
    remove: '/api/v1/monitoring/phyto/headers/{id}/delete/',
  },
  programa: {
    preview: '/api/v1/field_ops/tasks/{id}/delete-preview/',
    remove: '/api/v1/field_ops/tasks/{id}/delete/',
  },
  master: {
    preview: '/api/v1/field_ops/master-programs/{id}/delete-preview/',
    remove: '/api/v1/field_ops/master-programs/{id}/delete/',
  },
} as const satisfies Record<TypedDeleteLevel, { preview: string; remove: string }>

const RUTAS_RESTORE = {
  programa: '/api/v1/field_ops/tasks/{id}/restore/',
  master: '/api/v1/field_ops/master-programs/{id}/restore/',
} as const

async function fetchYieldDelete(
  path: 'delete-preview' | 'delete',
  id: string,
  method: 'GET' | 'DELETE'
) {
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string
  const response = await fetch(`${baseUrl}/monitoring/yield-map/headers/${id}/${path}/`, {
    method,
    headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` },
  })
  const payload = await response.json().catch(() => null)
  return { response, payload }
}

export function useDeleteImpact(level: DeleteLevel, id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['delete-impact', level, id] as const,
    queryFn: async (): Promise<DeleteImpact> => {
      if (level === 'yield_map') {
        const { response, payload } = await fetchYieldDelete('delete-preview', id, 'GET')
        if (!response.ok || !payload) throw new Error('No se pudo calcular el impacto del borrado')
        return payload as DeleteImpact
      }

      const { data, error } = await apiClient.GET(RUTAS[level].preview, {
        params: { path: { id } },
      })
      if (error || !data) throw new Error('No se pudo calcular el impacto del borrado')
      return data as DeleteImpact
    },
    enabled,
    staleTime: 0,
  })
}

export function useDeleteLevel(level: DeleteLevel, id: string) {
  const spec = SPECS[level]
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<DeleteImpact> => {
      if (level === 'yield_map') {
        const { response, payload } = await fetchYieldDelete('delete', id, 'DELETE')
        if (!response.ok || !payload) {
          if (response.status === 409) {
            throw Object.assign(new Error('bloqueado'), { blocked: true, impact: payload })
          }
          throw new Error(`No se pudo eliminar ${spec.noun}`)
        }
        return payload as DeleteImpact
      }

      const { data, error, response } = await apiClient.DELETE(RUTAS[level].remove, {
        params: { path: { id } },
      })
      if (error || !data) {
        if (response?.status === 409) {
          throw Object.assign(new Error('bloqueado'), { blocked: true, impact: error })
        }
        throw new Error(`No se pudo eliminar ${spec.noun}`)
      }
      return data as DeleteImpact
    },
    onSuccess: () => {
      toast.success(`Se eliminó ${spec.noun}.`)
      for (const key of [...CLAVES_DE_ESTRUCTURA, ...spec.extra(id)]) {
        qc.invalidateQueries({ queryKey: key })
      }
      qc.removeQueries({ queryKey: ['delete-impact', level, id] })
    },
    onError: (err: Error & { blocked?: boolean }) => {
      if (err.blocked) {
        toast.error('Hay elementos que impiden el borrado. Revisa el detalle.')
        return
      }
      toast.error(`No se pudo eliminar ${spec.noun}.`)
    },
  })
}

export function useRestoreLevel(level: 'programa' | 'master', id: string) {
  const spec = SPECS[level]
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<{ restored: number }> => {
      const { data, error } = await apiClient.POST(RUTAS_RESTORE[level], {
        params: { path: { id } },
      })
      if (error || !data) throw new Error(`No se pudo restaurar ${spec.noun}`)
      return data as { restored: number }
    },
    onSuccess: (data) => {
      toast.success(`Se restauraron ${data.restored} registro(s).`)
      for (const key of [...CLAVES_DE_ESTRUCTURA, ...spec.extra(id)]) {
        qc.invalidateQueries({ queryKey: key })
      }
    },
    onError: () => toast.error(`No se pudo restaurar ${spec.noun}.`),
  })
}
