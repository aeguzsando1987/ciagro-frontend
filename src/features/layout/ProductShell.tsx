import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ProductHeader } from './ProductHeader'
import { ProductSidebar } from './ProductSidebar'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { AnimatedAgroindustryLogo } from '@/features/auth/AnimatedAgroindustryLogo'

interface ProductShellProps {
  contextLabel: string
  currentDcId?: string
  children: React.ReactNode
  mainClassName?: string
}

/** Estructura única de las áreas autenticadas: Header / Sidebar / Main Content. */
export function ProductShell({
  contextLabel,
  currentDcId,
  children,
  mainClassName,
}: ProductShellProps) {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const roleLevel = useAuthStore((state) => state.user?.role_level ?? 1)

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <ProductHeader
        contextLabel={contextLabel}
        currentDcId={currentDcId}
        onOpenNavigation={() => setMobileNavigationOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <ProductSidebar
          roleLevel={roleLevel}
          currentDcId={currentDcId}
          className="hidden lg:flex"
        />
        <main
          className={cn(
            'min-w-0 flex-1 overflow-auto bg-background p-4 pb-8 sm:p-6 lg:p-8',
            mainClassName
          )}
        >
          {children}
        </main>
      </div>

      <Sheet open={mobileNavigationOpen} onOpenChange={setMobileNavigationOpen}>
        <SheetContent side="left" className="w-64 gap-0 p-0">
          <SheetTitle className="sr-only">Navegación principal</SheetTitle>
          <div className="flex h-16 shrink-0 items-center border-b border-default px-4">
            <AnimatedAgroindustryLogo className="w-[132px]" gearClassName="cia-header-gear" />
          </div>
          <ProductSidebar
            roleLevel={roleLevel}
            currentDcId={currentDcId}
            className="min-h-0 w-full flex-1 border-r-0"
            onNavigate={() => setMobileNavigationOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
