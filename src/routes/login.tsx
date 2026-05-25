import { createRoute } from '@tanstack/react-router'
import { rootRoute } from './__root'
import { LoginForm } from '@/features/auth/LoginForm'
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
    <div
      className="flex min-h-dvh items-center justify-center p-8"
      style={{
        backgroundImage: 'url(/backgrounds/ciagro_bg_1.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <LoginForm
        onSubmit={(values) => mutate(values)}
        isPending={isPending}
        error={error?.message ?? null}
      />
    </div>
  )
}