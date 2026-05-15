import { Button } from '@/components/ui/button'
import { useLogout } from '@/features/auth/useLogout'

/**
 * Pantalla para usuarios sin DataCentrals asignadas (datacentrals.length === 0).
 * No redirige a /login — solo permite logout. El usuario debe contactar al admin.
 */
export function NoAccessScreen() {
  const { mutate: logout, isPending } = useLogout()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">Sin acceso</h1>
      <p className="max-w-sm text-muted-foreground">
        Tu cuenta no tiene ningun workspace asignado. Contacta a tu administrador para que te
        asigne acceso a una organizacion.
      </p>
      <Button variant="outline" onClick={() => logout()} disabled={isPending}>
        {isPending ? 'Cerrando sesion...' : 'Cerrar sesion'}
      </Button>
    </div>
  )
}
