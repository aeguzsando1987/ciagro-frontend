import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
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
import { useRanches } from '../hooks/useRanches'
import { usePlots } from '../hooks/usePlots'
import { useCrops, cropLabel } from '../hooks/useCrops'
import { SEASONS, CYCLE_YEARS, buildCycle, isSeason2AfterSeason1 } from '../cycle'
import type { MasterProgram } from '../types'

/** Valor centinela para "sin temporada 2" — Radix Select no admite value="". */
const NO_SEASON2 = '__none__'

const schema = z
  .object({
    voucher_code: z.string().optional(),
    title: z.string().min(1, 'Requerido'),
    season1: z.string().min(1, 'Selecciona la temporada'),
    season2: z.string().optional(),
    year: z.string().min(1, 'Selecciona el año'),
    plot: z.string().uuid('UUID inválido').optional(),
    crop_id: z.number().optional(),
    est_start_date: z.string().min(1, 'Requerido'),
    est_finish_date: z.string().min(1, 'Requerido'),
  })
  .refine((v) => v.est_start_date <= v.est_finish_date, {
    message: 'La fecha de inicio no puede ser posterior a la de fin',
    path: ['est_finish_date'],
  })
  .refine((v) => isSeason2AfterSeason1(v.season1, v.season2), {
    message: 'La temporada 2 debe ser posterior a la temporada 1',
    path: ['season2'],
  })

type FormValues = z.infer<typeof schema>

const KNOWN_FIELDS = [
  'voucher_code', 'title', 'plot', 'crop_id',
  'est_start_date', 'est_finish_date',
] as const

interface CreateHijoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  master: MasterProgram
  /** Nombre del productor del Maestro — se hereda y se muestra de solo-lectura. */
  producerName: string
}

/**
 * Diálogo de creación de Subprograma (caso de uso §3).
 *
 * El productor NO se selecciona: se hereda del Programa Maestro (§3.4, §4 NOTA)
 * y se muestra de solo-lectura. La cascada es Rancho → Parcela, con los ranchos
 * del productor del Maestro. El ciclo se captura con 3 controles (§3.5.4) y el
 * cultivo se elige concatenado (§3.5.6). El status inicial lo asigna el backend.
 */
export function CreateHijoDialog({ open, onOpenChange, master, producerName }: CreateHijoDialogProps) {
  const queryClient = useQueryClient()
  const [selectedRanch, setSelectedRanch] = useState<string | undefined>()

  // Ranchos del productor del Maestro (master.agro_unit). El scope lo aplica
  // el backend; no hay selector de productor.
  const { data: ranches = [], isLoading: loadingRanches } = useRanches(master.agro_unit)
  const { data: plots = [], isLoading: loadingPlots } = usePlots(selectedRanch)
  const { data: crops = [], isLoading: loadingCrops } = useCrops()

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const cycle = buildCycle(values.season1, values.season2, values.year)
      // Solo se envían los campos con valor: un string vacío en una fecha o un
      // UUID provoca un 400 de DRF por formato (bug corregido del flujo previo).
      const body: Record<string, unknown> = {
        master_program: master.id,
        title: values.title,
        est_start_date: values.est_start_date,
        est_finish_date: values.est_finish_date,
      }
      if (values.voucher_code) body.voucher_code = values.voucher_code
      if (cycle) body.cycle = cycle
      if (values.plot) body.plot = values.plot
      if (values.crop_id !== undefined) body.crop_id = values.crop_id

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
      setSelectedRanch(undefined)
      onOpenChange(false)
    },
  })

  function handleClose() {
    reset()
    setSelectedRanch(undefined)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo Subprograma</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
          {/* Contexto heredado del Maestro (solo lectura) */}
          <dl className="grid gap-1 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Programa Maestro</dt>
              <dd className="font-medium">{master.title}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Productor (heredado)</dt>
              <dd>{producerName}</dd>
            </div>
          </dl>

          {/* voucher + título */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ch-voucher">Voucher / Código</Label>
              <Input id="ch-voucher" {...register('voucher_code')} placeholder="Opcional" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ch-title">Título *</Label>
              <Input id="ch-title" {...register('title')} placeholder="Ej: Lote Norte" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
          </div>

          {/* ciclo: temporada1 + temporada2 (opcional) + año */}
          <div className="space-y-1">
            <Label>Ciclo de cosecha *</Label>
            <div className="grid grid-cols-3 gap-2">
              <Controller
                name="season1"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger><SelectValue placeholder="Temporada 1" /></SelectTrigger>
                    <SelectContent>
                      {SEASONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                name="season2"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={(v) => field.onChange(v === NO_SEASON2 ? '' : v)}
                    value={field.value || NO_SEASON2}
                  >
                    <SelectTrigger><SelectValue placeholder="Temporada 2" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_SEASON2}>— Sin temporada 2 —</SelectItem>
                      {SEASONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                name="year"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger><SelectValue placeholder="Año" /></SelectTrigger>
                    <SelectContent>
                      {CYCLE_YEARS.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            {errors.season1 && <p className="text-xs text-destructive">{errors.season1.message}</p>}
            {errors.season2 && <p className="text-xs text-destructive">{errors.season2.message}</p>}
            {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
          </div>

          {/* cascada rancho → parcela */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Rancho</Label>
              <Select
                disabled={loadingRanches}
                value={selectedRanch ?? ''}
                onValueChange={(v) => setSelectedRanch(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingRanches ? 'Cargando...' : 'Selecciona rancho'} />
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
              <Label>Parcela</Label>
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
                            ? 'Primero el rancho'
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
          </div>

          {/* cultivo (concatenado name + variety) */}
          <div className="space-y-1">
            <Label>Cultivo</Label>
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
                    <SelectValue placeholder={loadingCrops ? 'Cargando...' : 'Selecciona cultivo (opcional)'} />
                  </SelectTrigger>
                  <SelectContent>
                    {crops.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {cropLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {/* fechas estimadas */}
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
