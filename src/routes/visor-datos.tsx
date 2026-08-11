import { createRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { authenticatedRoute } from './_authenticated'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { GeodataVisorShell } from '@/features/geodata-visor/components/GeodataVisorShell'

/**
 * Search params de la búsqueda avanzada del explorador (fase AS).
 *
 * Viven en la URL para que una búsqueda sea compartible y sobreviva al refresh, con el
 * mismo patrón que el Gantt (`w.$dc.task-manager.tsx`). Las listas viajan como CSV de
 * UUIDs; `advancedSearch.ts` hace la conversión a arrays.
 *
 * `.catch(undefined)` en cada clave: un enlace viejo o manipulado descarta el valor
 * inválido en vez de reventar la ruta. Los ids que ya no existan tampoco molestan,
 * porque el backend simplemente no los empata.
 */
const visorSearchSchema = z.object({
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  dateMode: z.enum(['planned', 'actual']).optional().catch(undefined),
  org: z.string().optional().catch(undefined),
  producers: z.string().optional().catch(undefined),
  ranches: z.string().optional().catch(undefined),
  plots: z.string().optional().catch(undefined),
  types: z.string().optional().catch(undefined),
})

/**
 * Ruta /visor-datos — Visor de Datos Agrícolas (Fase 7).
 *
 * Sección independiente, fuera de /w/$dc: no requiere una CIAgro seleccionada
 * (el explorador arranca en el nivel Organización). Hermana de /workspaces.
 *
 * Guard de rol: Supervisor+ (level >= 3). Regla crítica #5: usa ROLE_LEVELS.
 * Roles GUEST(1) y TECHNICIAN(2) se redirigen al selector de workspaces.
 */
export const visorDatosRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/visor-datos',
  validateSearch: visorSearchSchema,
  beforeLoad: () => {
    const level = useAuthStore.getState().user?.role_level ?? ROLE_LEVELS.GUEST
    if (level < ROLE_LEVELS.SUPERVISOR) {
      throw redirect({ to: '/workspaces' })
    }
  },
  component: GeodataVisorShell,
})
