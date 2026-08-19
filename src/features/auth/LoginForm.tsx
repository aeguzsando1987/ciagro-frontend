import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GpaLoader } from '@/components/ui/gpa-loader'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from './PasswordInput'
import { loginSchema, type LoginFormValues } from './loginSchema'

interface LoginFormProps {
  onSubmit: (values: LoginFormValues) => void
  isPending?: boolean
  error?: string | null
}

/**
 * Formulario de login (step 1.1 product-doc).
 * Consume POST /api/v1/auth/login/ via onSubmit - la mutación vive en useLogin (step 1.3)
 */
export function LoginForm({ onSubmit, isPending = false, error }: LoginFormProps) {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  })

  return (
    <Card className="w-full max-w-md border-white/75 bg-white/95 shadow-card backdrop-blur-[2px]">
      <CardHeader className="gap-0 px-6 pb-5 pt-6 sm:px-8 sm:pt-8">
        <h1 className="text-[28px] font-semibold leading-9 tracking-tight text-foreground">
          Bienvenido a CIAgro
        </h1>
        <CardDescription className="mt-2">Accede a tu cuenta para continuar</CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuario</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ingresa tu usuario"
                      autoComplete="username"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contraseña</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="Ingresa tu contraseña"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger-foreground"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isPending}>
              {isPending && <GpaLoader size="xs" />}
              {isPending ? 'Ingresando…' : 'Iniciar sesión'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
