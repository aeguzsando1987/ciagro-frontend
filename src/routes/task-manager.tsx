import { createRoute, redirect } from '@tanstack/react-router'
import { authenticatedRoute } from './_authenticated'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { ProductShell } from '@/features/layout/ProductShell'
import { NoAccessScreen } from '@/features/workspace/NoAccessScreen'
import { resolveTaskManagerScope } from '@/features/task-manager/scope/resolveScope'
import { readRememberedDc } from '@/features/task-manager/scope/scopeStorage'

/**
 * Ruta `/task-manager` — la entrada al Task Manager cuando no hay CIAgro en la URL.
 *
 * No pinta nada: resuelve con que CIAgro abrir y redirige a `/w/$dc/task-manager`. Antes
 * se llegaba por `/workspaces?next=task-manager`, que obligaba a recorrer dos pantallas
 * de seleccion antes de ver un solo programa. Ahora se entra derecho y el cambio de
 * CIAgro se hace con los selectores que viven dentro de la propia pantalla.
 *
 * Lo unico que renderiza es la pantalla de sin acceso, porque para un usuario sin
 * ninguna CIAgro no hay a donde redirigir.
 *
 * La decision va en `beforeLoad` por lo mismo que en `/visor-datos`:
 * `_authenticated.beforeLoad` ya garantiza que el usuario esta poblado, y resolverlo
 * antes de montar evita pintar una pantalla para acto seguido navegar a otra.
 */
export const taskManagerEntryRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/task-manager',
  beforeLoad: () => {
    const user = useAuthStore.getState().user
    const level = user?.role_level ?? ROLE_LEVELS.GUEST
    // Mismo guard que /w/$dc/task-manager: sin esto, un tecnico acabaria rebotado por
    // el guard de destino despues de una redireccion inutil.
    if (level < ROLE_LEVELS.SUPERVISOR) {
      throw redirect({ to: '/visor-datos' })
    }

    const scope = resolveTaskManagerScope({
      datacentrals: user?.datacentrals,
      rememberedDcId: readRememberedDc(),
    })
    if (scope.kind === 'directo') {
      throw redirect({ to: '/w/$dc/task-manager', params: { dc: scope.dcId } })
    }
  },
  component: () => (
    <ProductShell>
      <NoAccessScreen />
    </ProductShell>
  ),
})
