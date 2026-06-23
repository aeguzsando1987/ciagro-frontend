import { useEffect } from 'react'
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
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { useCreateAgroSector, useUpdateAgroSector } from '../hooks/useAgroSectors'
import type { AgroSector } from '../types'

const schema = z.object({
  sector_name: z.string().min(1, 'Requerido'),
  scian_code: z.string().optional(),
  activity_name: z.string().min(1, 'Requerido'),
  description: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

const KNOWN_FIELDS = ['sector_name', 'scian_code', 'activity_name', 'description'] as const

const EMPTY: FormValues = { sector_name: '', scian_code: '', activity_name: '', description: '' }

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si se pasa, el diálogo opera en modo edición (PATCH) sobre ese sector. */
  sector?: AgroSector | null
}

export function CreateSectorDialog({ open, onOpenChange, sector }: Props) {
  const isEdit = !!sector
  const createMutation = useCreateAgroSector()
  const updateMutation = useUpdateAgroSector()
  const mutation = isEdit ? updateMutation : createMutation

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  })

  // Precargar (edición) o limpiar (creación) cada vez que se abre el diálogo.
  useEffect(() => {
    if (!open) return
    reset(
      sector
        ? {
            sector_name: sector.sector_name ?? '',
            scian_code: sector.scian_code ?? '',
            activity_name: sector.activity_name ?? '',
            description: sector.description ?? '',
          }
        : EMPTY,
    )
  }, [open, sector, reset])

  function handleClose() {
    reset(EMPTY)
    onOpenChange(false)
  }

  async function onSubmit(values: FormValues) {
    try {
      const payload = {
        sector_name: values.sector_name,
        activity_name: values.activity_name,
        ...(values.scian_code ? { scian_code: values.scian_code } : {}),
        ...(values.description ? { description: values.description } : {}),
      }
      if (isEdit && sector) {
        await updateMutation.mutateAsync({ id: sector.id, ...payload })
        toast.success('Sector agrícola actualizado correctamente.')
      } else {
        await createMutation.mutateAsync(payload)
        toast.success('Sector agrícola creado correctamente.')
      }
      handleClose()
    } catch (err) {
      applyDrfErrors(err as never, setError, [...KNOWN_FIELDS])
      if (!(err as Record<string, unknown>)?.sector_name) {
        toast.error(
          isEdit
            ? 'No se pudo actualizar el sector. Intenta de nuevo.'
            : 'No se pudo crear el sector. Intenta de nuevo.',
        )
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar sector agrícola' : 'Nuevo sector agrícola'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Nombre del sector *" error={errors.sector_name?.message}>
            <Input {...register('sector_name')} placeholder="Ej: Granos básicos" />
          </Field>
          <Field label="Código SCIAN" error={errors.scian_code?.message}>
            <Input {...register('scian_code')} placeholder="Ej: 111140 (opcional)" />
          </Field>
          <Field label="Actividad principal *" error={errors.activity_name?.message}>
            <Input {...register('activity_name')} placeholder="Ej: Cultivo de maíz" />
          </Field>
          <Field label="Descripción" error={errors.description?.message}>
            <textarea
              {...register('description')}
              placeholder="Opcional"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isSubmitting || mutation.isPending
                ? 'Guardando…'
                : isEdit
                  ? 'Guardar cambios'
                  : 'Crear sector'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
