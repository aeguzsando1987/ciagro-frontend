import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { PasswordInput } from './PasswordInput'
import { changePasswordSchema, type ChangePasswordFormValues } from './changePasswordSchema'

interface ChangePasswordFormProps {
  onSubmit: (values: ChangePasswordFormValues) => void
  isPending?: boolean
  error?: string | null
}

/**
 * Formulario de cambio de contraseña forzado (Paso 1.2 product-doc).
 * Consume POST /api/v1/auth/change-password/ via useChangePassword (Tarea 1.8).
 */
export function ChangePasswordForm({ onSubmit, isPending = false, error }: ChangePasswordFormProps) {
  const form = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { old_password: '', new_password: '', new_password_confirm: '' },
    mode: 'onChange',
  })

  const newPassword = form.watch('new_password')
  const confirmPassword = form.watch('new_password_confirm')
  const showMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Cambiar contraseña</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Tu administrador requiere que cambies tu contraseña antes de continuar.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="old_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña actual</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="••••••••" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="new_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nueva contraseña</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="••••••••" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="new_password_confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmar nueva contraseña</FormLabel>
                  <FormControl>
                    <PasswordInput placeholder="••••••••" autoComplete="new-password" {...field} />
                  </FormControl>
                  {showMismatch && (
                    <p className="text-sm text-destructive">Las contraseñas no coinciden</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
