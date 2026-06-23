import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnimatedTabs as Tabs } from '@/components/ui/animated-tabs'
import { apiClient } from '@/lib/api/client'
import { tokens } from '@/lib/auth/tokens'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { PasswordInput } from '@/features/auth/PasswordInput'
import { Field } from '@/features/admin/components/Field'

const profileSchema = z.object({
  email: z.string().email('Correo inválido'),
})

const passwordSchema = z
  .object({
    old_password: z.string().min(1, 'Requerido'),
    new_password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm_password: z.string().min(1, 'Requerido'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  })

type ProfileValues = z.infer<typeof profileSchema>
type PasswordValues = z.infer<typeof passwordSchema>

interface Props {
  onClose: () => void
}

export function ProfileModal({ onClose }: Props) {
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { email: user?.email ?? '' },
  })

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { old_password: '', new_password: '', confirm_password: '' },
  })

  async function onSaveProfile(values: ProfileValues) {
    const { data, error } = await apiClient.PATCH('/api/v1/users/me/', {
      body: { email: values.email } as never,
    })
    if (error) {
      const msg =
        (error as Record<string, unknown>)['email'] ??
        (error as Record<string, unknown>)['detail'] ??
        'No se pudo actualizar el correo'
      profileForm.setError('email', {
        message: Array.isArray(msg) ? String(msg[0]) : String(msg),
      })
      return
    }
    if (user && data) {
      setUser({ ...user, email: (data as { email?: string }).email ?? values.email })
    }
    toast.success('Correo actualizado correctamente.')
    onClose()
  }

  async function onChangePassword(values: PasswordValues) {
    setPasswordError(null)
    const baseUrl = import.meta.env.VITE_API_BASE_URL as string
    const res = await fetch(`${baseUrl}/auth/change-password/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokens.getAccess() ?? ''}`,
      },
      body: JSON.stringify({
        old_password: values.old_password,
        new_password: values.new_password,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const detail =
        (body as Record<string, unknown>)['old_password'] ??
        (body as Record<string, unknown>)['new_password'] ??
        (body as Record<string, unknown>)['detail'] ??
        'Error al cambiar la contraseña'
      setPasswordError(Array.isArray(detail) ? String(detail[0]) : String(detail))
      return
    }
    toast.success('Contraseña actualizada correctamente.')
    passwordForm.reset()
    onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile">
          <TabsList className="w-full">
            <TabsTrigger value="profile" className="flex-1">Datos</TabsTrigger>
            <TabsTrigger value="security" className="flex-1">Seguridad</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="pt-4">
            <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
              <Field label="Correo electrónico *" error={profileForm.formState.errors.email?.message}>
                <Input
                  type="email"
                  {...profileForm.register('email')}
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                  {profileForm.formState.isSubmitting ? 'Guardando...' : 'Guardar'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="security" className="pt-4">
            <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
              <Field
                label="Contraseña actual *"
                error={passwordForm.formState.errors.old_password?.message}
              >
                <PasswordInput
                  autoComplete="current-password"
                  {...passwordForm.register('old_password')}
                />
              </Field>
              <Field
                label="Nueva contraseña *"
                error={passwordForm.formState.errors.new_password?.message}
              >
                <PasswordInput
                  autoComplete="new-password"
                  {...passwordForm.register('new_password')}
                />
              </Field>
              <Field
                label="Confirmar nueva contraseña *"
                error={passwordForm.formState.errors.confirm_password?.message}
              >
                <PasswordInput
                  autoComplete="new-password"
                  {...passwordForm.register('confirm_password')}
                />
              </Field>
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                  {passwordForm.formState.isSubmitting ? 'Cambiando...' : 'Cambiar contraseña'}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
