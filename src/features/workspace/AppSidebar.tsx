import { useParams } from '@tanstack/react-router'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { ProductSidebar } from '@/features/layout/ProductSidebar'

export function AppSidebar() {
  const { dc } = useParams({ from: '/_authenticated/w/$dc' })
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)

  return <ProductSidebar roleLevel={roleLevel} currentDcId={dc} />
}
