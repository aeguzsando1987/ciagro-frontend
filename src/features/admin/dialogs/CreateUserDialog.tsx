import { useEffect, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api/client'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { USERS_QUERY_KEY } from '../hooks/useUsers'
import { useUserRoles, useWorkRoles } from '../hooks/useUserCatalogs'
import { useCountries, useStates } from '../hooks/useGeography'
import { CreateWorkRoleDialog } from './CreateWorkRoleDialog'
import { CountryCombobox } from '../components/CountryCombobox'

/**
 * Esquema del formulario de alta de usuario. Solo username/email/password y
 * nombre/apellido son obligatorios — el resto del perfil Individual es opcional
 * (caso de uso §1.6.5). Los ids de FK viajan como string en el form (Radix Select
 * exige string) y se convierten a número en el payload.
 */
const schema = z.object({
  username: z.string().min(1, 'Requerido'),
  email: z.string().email('Correo inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  user_role: z.string().optional(),
  first_name: z.string().min(1, 'Requerido'),
  last_name: z.string().min(1, 'Requerido'),
  phone: z.string().optional(),
  personal_email: z.string().email('Correo inválido').optional().or(z.literal('')),
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
  photo_url: z.string().url('URL inválida').optional().or(z.literal('')),
  country: z.string().optional(),
  state: z.string().optional(),
  work_role: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

/** Campos que el backend (AdminRegisterSerializer) reconoce, para mapear errores DRF. */
const KNOWN_FIELDS = [
  'username', 'email', 'password', 'user_role', 'first_name', 'last_name',
  'phone', 'personal_email', 'address_line_1', 'address_line_2', 'city',
  'postal_code', 'photo_url', 'country', 'state', 'work_role',
] as const

interface CreateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const queryClient = useQueryClient()
  const [workRoleDialogOpen, setWorkRoleDialogOpen] = useState(false)

  const { data: roles = [] } = useUserRoles()
  const { data: workRoles = [] } = useWorkRoles()
  const { data: countries = [] } = useCountries()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  // Cascada país → estado: los estados se filtran por el ISO-2 del país elegido.
  const selectedCountryId = watch('country')
  const selectedCountryIso2 =
    countries.find((c) => String(c.id) === selectedCountryId)?.iso_2 ?? null
  const { data: states = [] } = useStates(selectedCountryIso2)

  // Preselecciona México al abrir el diálogo (cuando los países ya están cargados).
  // Si el usuario ya eligió un país (edición) no se sobreescribe.
  useEffect(() => {
    if (!open || countries.length === 0) return
    if (watch('country')) return
    const mx = countries.find((c) => c.iso_2 === 'MX')
    if (mx) setValue('country', String(mx.id))
  }, [open, countries]) // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // El payload omite los opcionales vacíos: enviar "" haría que DRF rechace
      // los campos de FK o de formato (mismo criterio que el Task Manager).
      const body: Record<string, unknown> = {
        username: values.username,
        email: values.email,
        password: values.password,
        first_name: values.first_name,
        last_name: values.last_name,
      }
      if (values.user_role) body.user_role = Number(values.user_role)
      if (values.phone) body.phone = values.phone
      if (values.personal_email) body.personal_email = values.personal_email
      if (values.address_line_1) body.address_line_1 = values.address_line_1
      if (values.address_line_2) body.address_line_2 = values.address_line_2
      if (values.city) body.city = values.city
      if (values.postal_code) body.postal_code = values.postal_code
      if (values.photo_url) body.photo_url = values.photo_url
      if (values.country) body.country = Number(values.country)
      if (values.state) body.state = Number(values.state)
      if (values.work_role) body.work_role = Number(values.work_role)

      const { data, error } = await apiClient.POST('/api/v1/auth/register/', {
        body: body as never,
      })
      if (error) {
        if (typeof error === 'object' && error !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          applyDrfErrors(error as any, setError, KNOWN_FIELDS)
          throw new Error('Corrige los errores del formulario')
        }
        throw new Error('No se pudo crear el usuario')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_QUERY_KEY })
      toast.success('El usuario se creó correctamente.')
      reset()
      onOpenChange(false)
    },
  })

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-5">
          {/* ── Cuenta ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Cuenta</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Usuario *" error={errors.username?.message}>
                <Input {...register('username')} placeholder="usuario01" />
              </Field>
              <Field label="Correo *" error={errors.email?.message}>
                <Input type="email" {...register('email')} placeholder="correo@dominio.com" />
              </Field>
              <Field label="Contraseña *" error={errors.password?.message}>
                <Input type="password" {...register('password')} placeholder="••••••••" />
              </Field>
              <Field label="Rol de acceso" error={errors.user_role?.message}>
                <Select value={watch('user_role')} onValueChange={(v) => setValue('user_role', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
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

          {/* ── Perfil ───────────────────────────────────────────── */}
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
                <Input {...register('phone')} placeholder="Ej: +52 3312345678 (opcional)" />
              </Field>
              <Field label="Correo personal" error={errors.personal_email?.message}>
                <Input type="email" {...register('personal_email')} />
              </Field>
              <Field label="Foto de perfil (URL)" error={errors.photo_url?.message}>
                <Input {...register('photo_url')} placeholder="https://..." />
              </Field>
              <Field label="Rol laboral" error={errors.work_role?.message}>
                <div className="flex gap-2">
                  <Select value={watch('work_role')} onValueChange={(v) => setValue('work_role', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un rol laboral" />
                    </SelectTrigger>
                    <SelectContent>
                      {workRoles.map((w) => (
                        <SelectItem key={w.id} value={String(w.id)}>
                          {w.work_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWorkRoleDialogOpen(true)}
                  >
                    + Crear
                  </Button>
                </div>
              </Field>
            </div>
          </section>

          {/* ── Ubicación ────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Ubicación</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="País" error={errors.country?.message}>
                <CountryCombobox
                  countries={countries}
                  value={watch('country')}
                  onChange={(v) => {
                    setValue('country', v)
                    setValue('state', undefined) // el estado depende del país
                  }}
                />
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
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando…' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <CreateWorkRoleDialog
        open={workRoleDialogOpen}
        onOpenChange={setWorkRoleDialogOpen}
        onCreated={(id) => setValue('work_role', String(id))}
      />
    </Dialog>
  )
}
