import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'
import { tokens } from '@/lib/auth/tokens'

export interface FlushResult {
  deleted_points: number
  header_id: string
  /** Solo NDVI: bandas de coropleta invalidadas junto con los puntos. */
  deleted_contours?: number
}

/** Tipos de sesión que admiten borrado de puntos. */
export type FlushKind = 'aspersion' | 'ndvi' | 'soil_map'

interface FlushSpec {
  /** Segmento del endpoint bajo /monitoring/<segment>/headers/<id>/flush/ */
  segment: string
  /** Nombre del dato en los toasts ("puntos de aspersión"). */
  noun: string
  /**
   * Query keys a invalidar tras el borrado. React Query hace match por PREFIJO,
   * así que ['ndvi'] alcanza headers, contornos e índices de contorno.
   */
  invalidate: (sessionId: string) => QueryKey[]
}

const SPECS: Record<FlushKind, FlushSpec> = {
  aspersion: {
    segment: 'aspersion',
    noun: 'datos de aspersión',
    invalidate: () => [
      ['aspersion-detail'],
      ['aspersion-session-stats'],
      ['aspersion-points'],
      ['aspersion-variable-stats'],
    ],
  },
  ndvi: {
    segment: 'ndvi',
    noun: 'datos de NDVI',
    invalidate: (id) => [
      ['ndvi-detail', id],
      ['ndvi-points', id],
      ['ndvi-session-variable-config', id],
      // Clave propia: el prefijo ['ndvi'] no la alcanza, react-query compara elemento a
      // elemento y 'ndvi' no es lo mismo que 'ndvi-variable-stats'.
      ['ndvi-variable-stats', id],
      // Prefijo común de headers/contornos/índices del visor.
      ['ndvi'],
    ],
  },
  soil_map: {
    segment: 'soil-map',
    noun: 'datos de mapeo de suelo',
    invalidate: (id) => [
      ['soil-map-detail', id],
      ['soil-map-points', id],
      ['soil-map-session-stats', id],
      ['soil-map'],
    ],
  },
}

/**
 * Borra los puntos de UNA sesión (la indicada por sessionId). NO toca otras sesiones
 * de la misma parcela. Acción solo SuperAdmin.
 *
 * Endpoints no tipados en api.d.ts → fetch directo con el token (mismo patrón que
 * useAspersionVariableStats). Tras el borrado la cabecera vuelve a 'pending' en el
 * backend, así que se invalida detalle/stats/puntos para que el visor desaparezca y
 * los resúmenes se refresquen. En NDVI el backend además purga la coropleta cacheada.
 */
export function useFlushSession(kind: FlushKind, sessionId: string) {
  const spec = SPECS[kind]
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<FlushResult> => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL
      const res = await fetch(
        `${baseUrl}/monitoring/${spec.segment}/headers/${sessionId}/flush/`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` },
        },
      )
      if (!res.ok) throw new Error(`No se pudo eliminar los ${spec.noun}`)
      return (await res.json()) as FlushResult
    },
    onSuccess: (data) => {
      toast.success(`Datos eliminados: ${data.deleted_points} puntos de esta sesión`)
      for (const key of spec.invalidate(sessionId)) {
        qc.invalidateQueries({ queryKey: key })
      }
    },
    onError: () => {
      toast.error(`No se pudieron eliminar los ${spec.noun}.`)
    },
  })
}
