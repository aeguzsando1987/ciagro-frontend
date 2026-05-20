import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api/client'
import { tokens } from '@/lib/auth/tokens'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { PasswordInput } from '@/features/auth/PasswordInput'
import { Field } from '../components/Field'
import { USERS_QUERY_KEY } from '../hooks/useUsers'
import { useUserRoles, useWorkRoles } from '../hooks/useUserCatalogs'
import { useCountries, useStates } from '../hooks/useGeography'
import type { UserDetail, UserStatus } from '../types'

/** Etiquetas legibles de los estados de negocio del usuario. */
const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Activo',
  disabled: 'Desactivado',
  pending_activation: 'Pendiente de activación',
}

/** Edición de usuario por admin. Sin username ni password (no editables por aquí). */
const schema = z.object({
  email: z.string().email('Correo inválido'),
  status: z.enum(['active', 'disabled', 'pending_activation']),
  user_role: z.string().optional(),
  first_name: z.string().min(1, 'Requerido'),
  last_name: z.string().min(1, 'Requerido'),
  phone: z.string().optional(),
  personal_email: z.string().email('Correo inválido').optional().or(z.literal('')),
  photo_url: z.string().url('URL inválida').optional().or(z.literal('')),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  work_role: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const setPasswordSchema = z
  .object({
    new_password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirm_password: z.string().min(1, 'Requerido'),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  })

type SetPasswordValues = z.infer<typeof setPasswordSchema>

const KNOWN_FIELDS = [
  'email', 'status', 'user_role', 'first_name', 'last_name', 'phone',
  'personal_email', 'photo_url', 'address_line_1', 'address_line_2', 'city',
  'postal_code', 'country', 'state', 'work_role',
] as const

interface UserModalProps {
  user: UserDetail
  onClose: () => void
}

export function UserModal({ user, onClose }: UserModalProps) {
  const queryClient = useQueryClient()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const currentUser = useAuthStore((s) => s.user)
  const canSetPassword = (currentUser?.role_level ?? 0) >= ROLE_LEVELS.SUPER_ADMIN

  const { data: roles = [] } = useUserRoles()
  const { data: workRoles = [] } = useWorkRoles()
  const { data: countries = [] } = useCountries()

  const ind = user.individual
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: user.email,
      status: user.status as UserStatus,
      user_role: user.user_role ? String(user.user_role.id) : undefined,
      first_name: ind?.first_name ?? '',
      last_name: ind?.last_name ?? '',
      phone: ind?.phone ?? '',
      personal_email: ind?.personal_email ?? '',
      photo_url: ind?.photo_url ?? '',
      address_line_1: ind?.address_line_1 ?? '',
      address_line_2: ind?.address_line_2 ?? '',
      city: ind?.city ?? '',
      postal_code: ind?.postal_code ?? '',
      country: ind?.country != null ? String(ind.country) : undefined,
      state: ind?.state != null ? String(ind.state) : undefined,
      work_role: ind?.work_role != null ? String(ind.work_role) : undefined,
    },
  })

  const {
    register: registerPwd,
    handleSubmit: handleSubmitPwd,
    formState: { errors: pwdErrors, isSubmitting: isPwdSubmitting },
    reset: resetPwd,
  } = useForm<SetPasswordValues>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { new_password: '', confirm_password: '' },
  })

  const setPasswordMutation = useMutation({
    mutationFn: async (values: SetPasswordValues) => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL as string
      const res = await fetch(`${baseUrl}/users/${user.id}/set-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens.getAccess() ?? ''}`,
        },
        body: JSON.stringify({
          new_password: values.new_password,
          confirm_password: values.confirm_password,
        }),
      })
      if (!res.ok) throw await res.json().catch(() => ({}))
    },
    onSuccess: () => {
      toast.success('Contraseña actualizada. El usuario deberá cambiarla en su próximo login.')
      resetPwd()
    },
    onError: () => {
      toast.error('No se pudo actualizar la contraseña.')
    },
  })

  // Cascada país → estado, igual que en el alta.
  const selectedCountryIso2 =
    countries.find((c) => String(c.id) === watch('country'))?.iso_2 ?? null
  const { data: states = [] } = useStates(selectedCountryIso2)

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const body: Record<string, unknown> = {
        email: values.email,
        status: values.status,
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone ?? '',
        personal_email: values.personal_email ?? '',
        photo_url: values.photo_url ?? '',
        address_line_1: values.address_line_1 ?? '',
        address_line_2: values.address_line_2 ?? '',
        city: values.city ?? '',
        postal_code: values.postal_code ?? '',
        user_role: values.user_role ? Number(values.user_role) : null,
        country: values.country ? Number(values.country) : null,
        state: values.state ? Number(values.state) : null,
        work_role: values.work_role ? Number(values.work_role) : null,
      }
      const { data, error } = await apiClient.PATCH('/api/v1/users/{id}/update/', {
        params: { path: { id: user.id } },
        body: body as never,
      })
      if (error) {
        if (typeof error === 'object' && error !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          applyDrfErrors(error as any, setError, KNOWN_FIELDS)
          throw new Error('Corrige los errores del formulario')
        }
        throw new Error('No se pudo actualizar el usuario')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
      toast.success('El usuario se actualizó correctamente.')
      setMode('view')
    },
  })

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {user.username}
            <Badge variant="outline">{STATUS_LABELS[user.status as UserStatus]}</Badge>
          </DialogTitle>
        </DialogHeader>

        {mode === 'view' ? (
          <ViewBody user={user} onEdit={() => setMode('edit')} onClose={onClose} />
        ) : (
          <>
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Cuenta</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Correo *" error={errors.email?.message}>
                  <Input type="email" {...register('email')} />
                </Field>
                <Field label="Estado" error={errors.status?.message}>
                  <Select
                    value={watch('status')}
                    onValueChange={(v) => setValue('status', v as UserStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABELS) as UserStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Rol de acceso" error={errors.user_role?.message}>
                  <Select value={watch('user_role')} onValueChange={(v) => setValue('user_role', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin rol" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.role_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Perfil</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre *" error={errors.first_name?.message}>
                  <Input {...register('first_name')} />
                </Field>
                <Field label="Apellido *" error={errors.last_name?.message}>
                  <Input {...register('last_name')} />
                </Field>
                <Field label="Teléfono" error={errors.phone?.message}>
                  <Input {...register('phone')} />
                </Field>
                <Field label="Correo personal" error={errors.personal_email?.message}>
                  <Input type="email" {...register('personal_email')} />
                </Field>
                <Field label="Foto de perfil (URL)" error={errors.photo_url?.message}>
                  <Input {...register('photo_url')} placeholder="https://..." />
                </Field>
                <Field label="Rol laboral" error={errors.work_role?.message}>
                  <Select value={watch('work_role')} onValueChange={(v) => setValue('work_role', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin rol laboral" />
                    </SelectTrigger>
                    <SelectContent>
                      {workRoles.map((w) => (
                        <SelectItem key={w.id} value={String(w.id)}>
                          {w.work_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Ubicación</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="País" error={errors.country?.message}>
                  <Select
                    value={watch('country')}
                    onValueChange={(v) => {
                      setValue('country', v)
                      setValue('state', undefined)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un país" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Estado" error={errors.state?.message}>
                  <Select
                    value={watch('state')}
                    onValueChange={(v) => setValue('state', v)}
                    disabled={!selectedCountryIso2}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={selectedCountryIso2 ? 'Selecciona un estado' : 'Elige país primero'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Ciudad" error={errors.city?.message}>
                  <Input {...register('city')} />
                </Field>
                <Field label="Código postal" error={errors.postal_code?.message}>
                  <Input {...register('postal_code')} />
                </Field>
                <Field label="Dirección línea 1" error={errors.address_line_1?.message}>
                  <Input {...register('address_line_1')} />
                </Field>
                <Field label="Dirección línea 2" error={errors.address_line_2?.message}>
                  <Input {...register('address_line_2')} />
                </Field>
              </div>
            </section>

            {errors.root && (
              <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errors.root.message}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset()
                  setMode('view')
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </form>

          {canSetPassword && (
            <form
              onSubmit={handleSubmitPwd((v) => setPasswordMutation.mutate(v))}
              className="space-y-3 border-t pt-4"
            >
              <h3 className="text-sm font-semibold text-muted-foreground">Contraseña</h3>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nueva contraseña *" error={pwdErrors.new_password?.message}>
                  <PasswordInput autoComplete="new-password" {...registerPwd('new_password')} />
                </Field>
                <Field label="Confirmar contraseña *" error={pwdErrors.confirm_password?.message}>
                  <PasswordInput autoComplete="new-password" {...registerPwd('confirm_password')} />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="secondary" size="sm" disabled={isPwdSubmitting}>
                  {isPwdSubmitting ? 'Cambiando...' : 'Cambiar contraseña'}
                </Button>
              </div>
            </form>
          )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Modo lectura: ficha del usuario con sus datos y workspaces. */
function ViewBody({
  user,
  onEdit,
  onClose,
}: {
  user: UserDetail
  onEdit: () => void
  onClose: () => void
}) {
  const ind = user.individual
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Row label="Correo" value={user.email} />
        <Row label="Rol de acceso" value={user.user_role?.role_name ?? '—'} />
        <Row label="Nombre" value={ind ? `${ind.first_name} ${ind.last_name}` : '—'} />
        <Row label="Teléfono" value={ind?.phone || '—'} />
        <Row label="Correo personal" value={ind?.personal_email || '—'} />
        <Row label="Ciudad" value={ind?.city || '—'} />
        <Row label="Código postal" value={ind?.postal_code || '—'} />
        <Row
          label="Dirección"
          value={[ind?.address_line_1, ind?.address_line_2].filter(Boolean).join(', ') || '—'}
        />
      </dl>

      <div>
        <p className="mb-1 text-sm font-semibold text-muted-foreground">Workspaces</p>
        {user.datacentrals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin workspaces asignados.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {user.datacentrals.map((dc) => (
              <Badge key={dc.id} variant="secondary">
                {dc.name}
                {dc.is_owner && ' (owner)'}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cerrar
        </Button>
        <Button type="button" onClick={onEdit}>
          Editar
        </Button>
      </DialogFooter>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
