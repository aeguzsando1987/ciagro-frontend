/**
 * Borrado por niveles: preview, ejecucion y restauracion (FASE BC).
 *
 * A diferencia de `useFlushSession`, que entra por `fetch` crudo con el token porque sus
 * endpoints nunca se tiparon, estos SI pasan por `apiClient`: los ocho endpoints de la
 * fase estan en `schema.yml` y `DeleteImpact` viene de `api.d.ts` GENERADO. El fetch
 * directo de aquel hook es deuda, no el patron a copiar (convencion 5 del proyecto).
 *
 * SEMANTICA POR NIVEL, que el llamador debe conocer:
 *   - sesion   -> borrado FISICO. La sesion y sus puntos desaparecen.
 *   - programa -> borrado LOGICO. La fila sobrevive y `useRestoreLevel` la devuelve.
 *   - maestro  -> igual que programa, y arrastra a sus subprogramas.
 */
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'

import { apiClient } from '@/lib/api/client'
import type { DeleteImpact } from '@/features/task-manager/types'

/** Los seis destinos posibles: los cuatro dominios de sesion, mas los dos de programa. */
export type DeleteLevel = 'aspersion' | 'soil_map' | 'ndvi' | 'phyto' | 'programa' | 'master'

/**
 * Claves que SIEMPRE hay que invalidar tras un borrado, en cualquier nivel.
 *
 * ESTA ES LA TRAMPA DE LA FASE, y no es teorica: los `SPECS` de `useFlushSession` NO
 * invalidan el arbol, y con razon — un flush cambia el contenido de una sesion, no la
 * ESTRUCTURA del Gantt. Un borrado si la cambia. Sin estas dos claves, el arbol sigue
 * pintando programas y sesiones que ya no existen, y la funcion parece rota aunque el
 * backend haya respondido 200.
 */
const CLAVES_DE_ESTRUCTURA: QueryKey[] = [['master-tree'], ['master-programs']]

interface Spec {
  /** Sustantivo para los toasts: "la sesion de aspersion". */
  noun: string
  /** Claves propias del nivel, ademas de las de estructura. */
  extra: (id: string) => QueryKey[]
}

const SPECS: Record<DeleteLevel, Spec> = {
  aspersion: {
    noun: 'la sesión de aspersión',
    extra: (id) => [['aspersion-detail', id], ['aspersion-points', id], ['aspersion-session-stats']],
  },
  soil_map: {
    noun: 'la sesión de mapeo de suelo',
    extra: (id) => [['soil-map-detail', id], ['soil-map-points', id], ['soil-map']],
  },
  ndvi: {
    // Prefijo ['ndvi'] alcanza headers, contornos e indices; ['ndvi-...'] son claves
    // propias que el prefijo NO alcanza (react-query compara elemento a elemento).
    noun: 'la sesión de NDVI',
    extra: (id) => [['ndvi-detail', id], ['ndvi-points', id], ['ndvi-variable-stats', id], ['ndvi']],
  },
  phyto: {
    noun: 'la sesión fitosanitaria',
    extra: (id) => [['phyto-detail', id], ['phyto-checkpoints', id], ['phyto-session-stats', id]],
  },
  programa: { noun: 'el subprograma', extra: (id) => [['hijo-detail', id]] },
  master: { noun: 'el programa maestro', extra: (id) => [['master-detail', id]] },
}

/**
 * Rutas por nivel, escritas COMPLETAS y literales.
 *
 * Se escriben una por una en vez de armarlas con plantillas (`/monitoring/${seg}/...`)
 * porque openapi-fetch solo valida el path contra los tipos generados si le llega un
 * literal: una plantilla colapsa a `string` y obliga a un `as any` que apaga exactamente
 * la garantia por la que se abandono el `fetch` crudo de `useFlushSession`. Doce lineas
 * repetitivas a cambio de que un endpoint mal escrito falle al compilar y no en runtime.
 */
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
} as const

const RUTAS_RESTORE = {
  programa: '/api/v1/field_ops/tasks/{id}/restore/',
  master: '/api/v1/field_ops/master-programs/{id}/restore/',
} as const

/**
 * Impacto del borrado. Lazy: solo consulta cuando `enabled` es true, es decir cuando el
 * dialogo esta abierto. `staleTime: 0` a proposito — el impacto puede cambiar entre dos
 * aperturas del mismo dialogo si alguien importo datos mientras tanto, y mostrar un
 * conteo viejo antes de destruir datos es peor que esperar 200 ms.
 */
export function useDeleteImpact(level: DeleteLevel, id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['delete-impact', level, id] as const,
    queryFn: async (): Promise<DeleteImpact> => {
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

/** Ejecuta el borrado. Fisico en sesiones, logico en programas. */
export function useDeleteLevel(level: DeleteLevel, id: string) {
  const spec = SPECS[level]
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<DeleteImpact> => {
      const { data, error, response } = await apiClient.DELETE(RUTAS[level].remove, {
        params: { path: { id } },
      })
      if (error || !data) {
        // El 409 NO es un fallo inesperado: es la respuesta normal cuando algo bloquea, y
        // trae el detalle de que lo impide. Se distingue para que la UI pueda decirlo en
        // vez de mostrar un "error de red" generico.
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

/** Deshace el borrado logico de un programa o maestro. No aplica a sesiones. */
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
