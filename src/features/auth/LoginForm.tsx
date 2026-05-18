import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
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
        <div className="flex w-full max-w-sm flex-col items-center gap-6">
            <img
                src="/tierra_inteligente.svg"
                alt="Tierra Inteligente"
                className="w-72"
                draggable={false}
            />
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="text-2xl">CIAgro</CardTitle>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="username"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Usuario</FormLabel>
                                    <FormControl>
                                        <Input placeholder="usuario" autoComplete="username" {...field} />
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
                                        <PasswordInput placeholder="••••••••" autoComplete="current-password" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}

                        <Button type="submit" className="w-full" disabled={isPending}>
                            {isPending ? 'Ingresando…' : 'Entrar'}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
        </div>
    )
}