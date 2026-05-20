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
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { useUpdateCrop } from '../hooks/useCrops'
import type { CropCatalog } from '../types'

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  code: z.string().optional(),
  variety: z.string().optional(),
  description: z.string().optional(),
  photo: z.instanceof(FileList).optional().nullable(),
})

type FormValues = z.infer<typeof schema>
const KNOWN_FIELDS = ['name', 'code', 'variety', 'description', 'photo'] as const

interface Props {
  crop: CropCatalog
  onClose: () => void
}

export function CropPanel({ crop, onClose }: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const user = useAuthStore((s) => s.user)
  const canEdit = (user?.role_level ?? 0) >= ROLE_LEVELS.SUPERVISOR

  const mutation = useUpdateCrop()

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: crop.name,
      code: crop.code ?? '',
      variety: crop.variety ?? '',
      description: crop.description ?? '',
    },
  })

  function handleClose() {
    reset()
    setMode('view')
    onClose()
  }

  async function onSubmit(values: FormValues) {
    try {
      const photo = values.photo?.[0] ?? null
      await mutation.mutateAsync({
        id: crop.id,
        payload: {
          name: values.name,
          code: values.code || null,
          variety: values.variety || null,
          description: values.description || null,
          photo,
        },
      })
      toast.success('Cultivo actualizado correctamente.')
      setMode('view')
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo actualizar el cultivo.')
    }
  }

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{crop.name}</DialogTitle>
        </DialogHeader>

        {mode === 'view' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Código</span><p className="font-medium">{crop.code ?? '—'}</p></div>
              <div><span className="text-muted-foreground">Variedad</span><p className="font-medium">{crop.variety ?? '—'}</p></div>
            </div>
            {crop.description && (
              <div className="text-sm">
                <span className="text-muted-foreground">Descripción</span>
                <p>{crop.description}</p>
              </div>
            )}
            {crop.photo && (
              <div>
                <span className="text-sm text-muted-foreground">Imagen</span>
                <img src={crop.photo} alt={crop.name} className="mt-1 max-h-40 rounded border object-cover" />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>Cerrar</Button>
              {canEdit && <Button onClick={() => setMode('edit')}>Editar</Button>}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Field label="Nombre *" error={errors.name?.message}>
              <Input {...register('name')} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Código" error={errors.code?.message}>
                <Input {...register('code')} />
              </Field>
              <Field label="Variedad" error={errors.variety?.message}>
                <Input {...register('variety')} />
              </Field>
            </div>
            <Field label="Descripción" error={errors.description?.message}>
              <textarea
                {...register('description')}
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </Field>
            <Field label="Imagen (opcional)">
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-muted file:text-foreground cursor-pointer"
                {...register('photo')}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); setMode('view') }} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
