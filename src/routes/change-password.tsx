import { createRoute } from '@tanstack/react-router'
import { authenticatedRoute } from './_authenticated'
import { ChangePasswordForm } from '@/features/auth/ChangePasswordForm'
import { useChangePassword } from '@/features/auth/useChangePassword'

/**
 * Ruta protegida /change-password — cambio de contraseña forzado (Paso 1.2 product-doc).
 * Solo accesible si requires_password_change=true (guard en _authenticated, Tarea 1.9).
 */
export const changePasswordRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/change-password',
  component: ChangePasswordPage,
})

function ChangePasswordPage() {
  const { mutate, isPending, error } = useChangePassword()

  return (
    <div className="flex min-h-dvh items-center justify-center p-8">
      <ChangePasswordForm
        onSubmit={(values) => mutate(values)}
        isPending={isPending}
        error={error?.message ?? null}
      />
    </div>
  )
}
