import { Navigate, Outlet } from '@tanstack/react-router'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { ProductShell } from '@/features/layout/ProductShell'

/**
 * Layout del panel global de administración (/admin).
 *
 * Ruta hermana de /workspaces — no vive dentro de un workspace. Usa el mismo
 * shell global que Dashboard y Visor, sin inventar una identidad paralela.
 * Guard de rol en el componente (no en beforeLoad) porque el usuario se carga
 * de forma asíncrona en el layout _authenticated; en beforeLoad aún podría ser null.
 */
export function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const roleLevel = user?.role_level ?? ROLE_LEVELS.GUEST
  const contextLabel =
    user?.datacentrals.length === 1
      ? (user.datacentrals[0]?.name ?? 'Organización activa')
      : 'Todas las organizaciones'

  // Mínimo Supervisor para entrar al panel; cada sección re-gatea por minRole.
  if (roleLevel < ROLE_LEVELS.SUPERVISOR) {
    return <Navigate to="/workspaces" />
  }

  return (
    <ProductShell contextLabel={contextLabel}>
      <Outlet />
    </ProductShell>
  )
}
