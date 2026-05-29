import { createRoute, redirect } from '@tanstack/react-router'
import { authenticatedRoute } from './_authenticated'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { GeodataVisorShell } from '@/features/geodata-visor/components/GeodataVisorShell'

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
  beforeLoad: () => {
    const level = useAuthStore.getState().user?.role_level ?? ROLE_LEVELS.GUEST
    if (level < ROLE_LEVELS.SUPERVISOR) {
      throw redirect({ to: '/workspaces' })
    }
  },
  component: GeodataVisorShell,
})
