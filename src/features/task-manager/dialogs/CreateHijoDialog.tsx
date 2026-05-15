import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api/client'
import { applyDrfErrors } from '../hooks/useDrfErrorMap'
import { useAgroUnits } from '../hooks/useAgroUnits'
import { useRanches } from '../hooks/useRanches'
import { usePlots } from '../hooks/usePlots'
import { useCrops } from '../hooks/useCrops'
import type { MasterProgram } from '../types'

const schema = z
  .object({
    title: z.string().optional(),
    cycle: z.string().optional(),
    plot: z.string().uuid('UUID inválido').optional(),
    crop_id: z.number().optional(),
    est_start_date: z.string().min(1, 'Requerido'),
    est_finish_date: z.string().min(1, 'Requerido'),
    master_program: z.string().uuid(),
  })
  .refine((v) => v.est_start_date <= v.est_finish_date, {
    message: 'La fecha de inicio no puede ser posterior a la de fin',
    path: ['est_finish_date'],
  })

type FormValues = z.infer<typeof schema>

const KNOWN_FIELDS = [
  'title',
  'cycle',
  'plot',
  'crop_id',
  'est_start_date',
  'est_finish_date',
  'master_program',
] as const

interface CreateHijoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  master: MasterProgram
}

export function CreateHijoDialog({ open, onOpenChange, master }: CreateHijoDialogProps) {
  const queryClient = useQueryClient()

  const [selectedProducer, setSelectedProducer] = useState<string | undefined>()
  const [selectedRanch, setSelectedRanch] = useState<string | undefined>()

  const { data: producers = [], isLoading: loadingProducers } = useAgroUnits()
  const { data: ranches = [], isLoading: loadingRanches } = useRanches(selectedProducer)
  const { data: plots = [], isLoading: loadingPlots } = usePlots(selectedRanch)
  const { data: crops = [], isLoading: loadingCrops } = useCrops()

  const masterStart = master.est_start_date ?? null
  const masterEnd = master.est_finish_date ?? null

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { master_program: master.id },
  })

  const startVal = watch('est_start_date')
  const endVal = watch('est_finish_date')

  /** Detecta si el hijo cae fuera del rango del maestro (espeja lógica backend). */
  function isOutsideRange(): boolean {
    if (!masterStart || !masterEnd || !startVal || !endVal) return false
    return startVal < masterStart || endVal > masterEnd
  }

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { plot, crop_id, ...rest } = values
      const body: Record<string, unknown> = { ...rest }
      if (plot) body.plot = plot
      if (crop_id !== undefined) body.crop_id = crop_id
      const { data, error } = await apiClient.POST('/api/v1/field_ops/tasks/create/', {
        body: body as never,
      })
      if (error) {
        if (typeof error === 'object' && error !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          applyDrfErrors(error as any, setError, KNOWN_FIELDS)
          throw new Error('Corrige los errores del formulario')
        }
        throw new Error('No se pudo crear el Subprograma')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-tree', master.id] })
      reset()
      setSelectedProducer(undefined)
      setSelectedRanch(undefined)
      onOpenChange(false)
    },
  })

  function handleClose() {
    reset()
    setSelectedProducer(undefined)
    setSelectedRanch(undefined)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Nuevo Subprograma
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              → {master.title}
            </span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          {/* título opcional */}
          <div className="space-y-1">
            <Label htmlFor="ch-title">Título</Label>
            <Input id="ch-title" {...register('title')} placeholder="Ej: Lote Norte — Mango Manila" />
          </div>

          {/* ciclo */}
          <div className="space-y-1">
            <Label htmlFor="ch-cycle">Ciclo</Label>
            <Input id="ch-cycle" {...register('cycle')} placeholder="Ej: Primavera-2026" />
          </div>

          {/* cascada productor → rancho → parcela */}
          <div className="space-y-1">
            <Label>Productor *</Label>
            <Select
              disabled={loadingProducers}
              onValueChange={(v) => {
                setSelectedProducer(v)
                setSelectedRanch(undefined)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingProducers ? 'Cargando...' : 'Selecciona productor'} />
              </SelectTrigger>
              <SelectContent>
                {producers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.commercial_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Rancho *</Label>
            <Select
              disabled={!selectedProducer || loadingRanches}
              onValueChange={(v) => {
                setSelectedRanch(v)
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !selectedProducer
                      ? 'Primero selecciona un productor'
                      : loadingRanches
                        ? 'Cargando...'
                        : 'Selecciona rancho'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {ranches.map((r) => (
                  <SelectItem key={r.id} value={r.id ?? ''}>
                    {r.properties?.name ?? r.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Parcela *</Label>
            <Controller
              name="plot"
              control={control}
              render={({ field }) => (
                <Select
                  disabled={!selectedRanch || loadingPlots}
                  onValueChange={field.onChange}
                  value={field.value ?? ''}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !selectedRanch
                          ? 'Primero selecciona un rancho'
                          : loadingPlots
                            ? 'Cargando...'
                            : 'Selecciona parcela'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {plots.map((p) => (
                      <SelectItem key={p.id} value={p.id ?? ''}>
                        {p.properties?.code ?? p.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.plot && <p className="text-xs text-destructive">{errors.plot.message}</p>}
          </div>

          {/* cultivo */}
          <div className="space-y-1">
            <Label>Cultivo *</Label>
            <Controller
              name="crop_id"
              control={control}
              render={({ field }) => (
                <Select
                  disabled={loadingCrops}
                  onValueChange={(v) => field.onChange(Number(v))}
                  value={field.value != null ? String(field.value) : ''}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingCrops ? 'Cargando...' : 'Selecciona cultivo'} />
                  </SelectTrigger>
                  <SelectContent>
                    {crops.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.crop_id && <p className="text-xs text-destructive">{errors.crop_id.message}</p>}
          </div>

          {/* fechas con advertencia fuera de rango */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ch-start">Fecha inicio *</Label>
              <Input id="ch-start" type="date" {...register('est_start_date')} />
              {errors.est_start_date && (
                <p className="text-xs text-destructive">{errors.est_start_date.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="ch-end">Fecha fin *</Label>
              <Input id="ch-end" type="date" {...register('est_finish_date')} />
              {errors.est_finish_date && (
                <p className="text-xs text-destructive">{errors.est_finish_date.message}</p>
              )}
            </div>
          </div>

          {isOutsideRange() && (
            <p className="rounded bg-yellow-50 px-3 py-2 text-xs text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
              ⚠ Las fechas están fuera del rango del Programa ({masterStart} — {masterEnd}).
              El backend puede rechazar esta solicitud.
            </p>
          )}

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
              {isSubmitting ? 'Guardando...' : 'Crear Subprograma'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
