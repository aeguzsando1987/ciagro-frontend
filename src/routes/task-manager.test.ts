/**
 * La entrada /task-manager: con que CIAgro abre el Task Manager.
 *
 * Se prueba el `beforeLoad` directamente porque es TODO lo que hace esta ruta, y porque
 * un guard de redireccion es justo lo que pasa desapercibido cuando no se ejercita: no
 * renderiza nada que un test de pantalla pudiera echar en falta.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isRedirect } from '@tanstack/react-router'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { makeDataCentral } from '@/test/test-utils'
import { rememberDc } from '@/features/task-manager/scope/scopeStorage'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import type { AuthUser } from '@/types/auth'
import { taskManagerEntryRoute } from './task-manager'

const BASE_USER: AuthUser = {
  id: 'u1',
  username: 'test',
  email: 'test@test.com',
  role_name: 'Supervisor',
  role_level: ROLE_LEVELS.SUPERVISOR,
  requires_password_change: false,
  datacentrals: [],
}

/**
 * Ejecuta el guard y devuelve el destino al que redirige, o null si deja pasar.
 *
 * `redirect()` lanza un objeto tipo Response que guarda el destino en `.options`, no en
 * la raiz: leerlo de `.to` daria undefined y el test pasaria sin comprobar nada.
 */
function destinoDe(): { to?: string; params?: Record<string, string> } | null {
  const beforeLoad = taskManagerEntryRoute.options.beforeLoad as () => void
  try {
    beforeLoad()
    return null
  } catch (salto: unknown) {
    if (!isRedirect(salto)) throw salto
    const { to, params } = (salto as { options: { to?: string; params?: Record<string, string> } })
      .options
    return { to, params }
  }
}

describe('entrada /task-manager', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.setState({ user: null })
    vi.restoreAllMocks()
  })

  it('abre la unica CIAgro del usuario sin preguntar', () => {
    useAuthStore.setState({
      user: { ...BASE_USER, datacentrals: [makeDataCentral({ id: 'dc-1' })] },
    })
    expect(destinoDe()).toEqual({ to: '/w/$dc/task-manager', params: { dc: 'dc-1' } })
  })

  it('con varias, abre la recordada', () => {
    useAuthStore.setState({
      user: {
        ...BASE_USER,
        datacentrals: [
          makeDataCentral({ id: 'dc-a', name: 'Aguascalientes' }),
          makeDataCentral({ id: 'dc-z', name: 'Zacatecas' }),
        ],
      },
    })
    rememberDc('dc-z')
    expect(destinoDe()).toEqual({ to: '/w/$dc/task-manager', params: { dc: 'dc-z' } })
  })

  it('sin nada recordado abre la primera por nombre', () => {
    useAuthStore.setState({
      user: {
        ...BASE_USER,
        datacentrals: [
          makeDataCentral({ id: 'dc-z', name: 'Zacatecas' }),
          makeDataCentral({ id: 'dc-a', name: 'Aguascalientes' }),
        ],
      },
    })
    expect(destinoDe()).toEqual({ to: '/w/$dc/task-manager', params: { dc: 'dc-a' } })
  })

  it('un rol por debajo de Supervisor se va al Visor, no al selector', () => {
    // El guard de /w/$dc/task-manager lo rebotaria igual: redirigirlo aqui evita el
    // rebote y deja el motivo en un solo sitio.
    useAuthStore.setState({
      user: {
        ...BASE_USER,
        role_level: ROLE_LEVELS.TECHNICIAN,
        datacentrals: [makeDataCentral({ id: 'dc-1' })],
      },
    })
    expect(destinoDe()).toEqual({ to: '/visor-datos', params: undefined })
  })

  it('sin ninguna CIAgro no redirige: se queda a mostrar la pantalla de sin acceso', () => {
    useAuthStore.setState({ user: { ...BASE_USER, datacentrals: [] } })
    expect(destinoDe()).toBeNull()
  })
})
