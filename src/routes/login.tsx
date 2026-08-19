import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { LoginForm } from '@/features/auth/LoginForm'
import { AnimatedAgroindustryLogo } from '@/features/auth/AnimatedAgroindustryLogo'
import { useLogin } from '@/features/auth/useLogin'

/**
 * Ruta pública /login. Pantalla de ingreso de credenciales (Paso 1.1 product-doc).
 * El componente LoginForm se implementa en Tarea 1.2.
 */
export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

function LoginPage() {
  const { mutate, isPending, error } = useLogin()

  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-secondary">
      <img
        src="/backgrounds/ciagro_bg_1.jpg"
        alt="Campo agrícola al amanecer"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center brightness-[1.12] saturate-[1.04]"
      />
      <div className="absolute inset-0 -z-10 bg-secondary/18" aria-hidden="true" />
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-r from-secondary/30 via-secondary/10 to-transparent"
        aria-hidden="true"
      />

      <main className="flex w-full flex-1 items-center justify-center px-4 py-10 sm:px-8 sm:py-16">
        <div className="flex w-full max-w-md flex-col items-center">
          <AnimatedAgroindustryLogo
            className="mb-5 w-72 max-w-[82vw] drop-shadow-[0_2px_3px_rgba(255,255,255,0.35)]"
          />
          <LoginForm
            onSubmit={(values) => mutate(values)}
            isPending={isPending}
            error={error?.message ?? null}
          />
        </div>
      </main>

      <footer className="flex shrink-0 flex-col gap-1 px-4 py-4 text-center text-xs text-white/80 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:text-left lg:px-16 xl:px-24">
        <span>CIAgro · Central de Inteligencia Agrícola</span>
        <span>GPA Agroindustry · {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
