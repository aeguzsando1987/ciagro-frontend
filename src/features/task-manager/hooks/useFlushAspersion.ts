import { useFlushSession, type FlushResult } from './useFlushSession'

export type { FlushResult }

/**
 * Borra los puntos de aspersión de UNA sesión (la indicada por sessionId). NO toca otras
 * sesiones de la misma parcela. Acción solo SuperAdmin.
 * La implementación es común a los tres tipos de sesión; ver useFlushSession.
 */
export function useFlushAspersion(sessionId: string) {
  return useFlushSession('aspersion', sessionId)
}
