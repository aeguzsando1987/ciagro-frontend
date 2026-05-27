import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { tokens } from '@/lib/auth/tokens'

export interface FlushResult {
  deleted_points: number
  header_id: string
}

/**
 * Borra los puntos de aspersión de UNA sesión (la indicada por sessionId). NO toca otras
 * sesiones de la misma parcela. Acción solo SuperAdmin.
 * Endpoint no tipado en api.d.ts → fetch directo con el token (patrón de useAspersionVariableStats).
 * Tras el borrado, la cabecera vuelve a 'pending' en el backend, así que invalidamos
 * detalle/stats/puntos para que el visor desaparezca y los resúmenes se refresquen.
 */
export function useFlushAspersion(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<FlushResult> => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL
      const res = await fetch(
        `${baseUrl}/monitoring/aspersion/headers/${sessionId}/flush/`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` },
        },
      )
      if (!res.ok) throw new Error('No se pudo eliminar los datos de aspersión')
      return (await res.json()) as FlushResult
    },
    onSuccess: (data) => {
      toast.success(`Datos de aspersión eliminados: ${data.deleted_points} puntos de esta sesión`)
      qc.invalidateQueries({ queryKey: ['aspersion-detail'] })
      qc.invalidateQueries({ queryKey: ['aspersion-session-stats'] })
      qc.invalidateQueries({ queryKey: ['aspersion-points'] })
      qc.invalidateQueries({ queryKey: ['aspersion-variable-stats'] })
    },
    onError: () => {
      toast.error('No se pudieron eliminar los datos de aspersión.')
    },
  })
}
