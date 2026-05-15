import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiClient } from '@/lib/api/client'
import { applyDrfErrors } from '../hooks/useDrfErrorMap'
import { useAgroUnits } from '../hooks/useAgroUnits'

const schema = z
  .object({
    title: z.string().min(1, 'Requerido'),
    code: z.string().min(1, 'Requerido'),
    agro_unit: z.string().uuid('Selecciona un productor'),
    est_start_date: z.string().min(1, 'Requerido'),
    est_finish_date: z.string().min(1, 'Requerido'),
    notes: z.string().optional(),
  })
  .refine((v) => v.est_start_date <= v.est_finish_date, {
    message: 'La fecha de inicio no puede ser posterior a la de fin',
    path: ['est_finish_date'],
  })

type FormValues = z.infer<typeof schema>

const KNOWN_FIELDS = ['title', 'code', 'agro_unit', 'est_start_date', 'est_finish_date', 'notes'] as const

interface CreateMasterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** dc UUID para invalidar la query de masters al crear */
  datacentral: string
}

export function CreateMasterDialog({ open, onOpenChange, datacentral }: CreateMasterDialogProps) {
  const queryClient = useQueryClient()
  // Productores/asociaciones del workspace activo (scope aplicado por el backend).
  const { data: producers = [], isLoading: loadingProducers } = useAgroUnits(datacentral)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data, error } = await apiClient.POST(
        '/api/v1/field_ops/master-programs/create/',
        { body: values as never }
      )
      if (error) {
        if (typeof error === 'object' && error !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          applyDrfErrors(error as any, setError, KNOWN_FIELDS)
          throw new Error('Corrige los errores del formulario')
        }
        throw new Error('No se pudo crear el Programa')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-programs', datacentral] })
      reset()
      onOpenChange(false)
    },
  })

  function onSubmit(values: FormValues) {
    mutation.mutate(values)
  }

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Programa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* título */}
          <div className="space-y-1">
            <Label htmlFor="cm-title">Título *</Label>
            <Input id="cm-title" {...register('title')} placeholder="Ej: Programa Primavera 2026" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          {/* código */}
          <div className="space-y-1">
            <Label htmlFor="cm-code">Código / Folio *</Label>
            <Input id="cm-code" {...register('code')} placeholder="Ej: PROG-2026-A" />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>

          {/* productor */}
          <div className="space-y-1">
            <Label htmlFor="cm-agro-unit">Productor *</Label>
            <Select
              disabled={loadingProducers}
              onValueChange={(v) => setValue('agro_unit', v, { shouldValidate: true })}
            >
              <SelectTrigger id="cm-agro-unit">
                <SelectValue placeholder={loadingProducers ? 'Cargando...' : 'Selecciona un productor'} />
              </SelectTrigger>
              <SelectContent>
                {producers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.agro_unit && <p className="text-xs text-destructive">{errors.agro_unit.message}</p>}
          </div>

          {/* fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cm-start">Fecha inicio *</Label>
              <Input id="cm-start" type="date" {...register('est_start_date')} />
              {errors.est_start_date && (
                <p className="text-xs text-destructive">{errors.est_start_date.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="cm-end">Fecha fin *</Label>
              <Input id="cm-end" type="date" {...register('est_finish_date')} />
              {errors.est_finish_date && (
                <p className="text-xs text-destructive">{errors.est_finish_date.message}</p>
              )}
            </div>
          </div>

          {/* notas */}
          <div className="space-y-1">
            <Label htmlFor="cm-notes">Notas</Label>
            <Input id="cm-notes" {...register('notes')} placeholder="Aclaraciones opcionales..." />
          </div>

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
              {isSubmitting ? 'Guardando...' : 'Crear Programa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
