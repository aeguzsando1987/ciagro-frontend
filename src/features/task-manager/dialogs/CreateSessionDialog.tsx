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
import { useEvaluations } from '../hooks/useEvaluations'
import { useDatacentralUsers } from '../hooks/useDatacentralUsers'
import type { MasterProgram } from '../types'

type SessionType = 'aspersion' | 'phyto'

/* ─── Schemas ─────────────────────────────────────────────────────── */

const aspersionSchema = z.object({
  program_id: z.string().uuid(),
  aspersion_date: z.string().min(1, 'Requerido'),
  evaluation_id: z.string().uuid('Selecciona una evaluación').optional().or(z.literal('')),
  est_start_date: z.string().optional(),
  est_finish_date: z.string().optional(),
  assigned_to_id: z.string().uuid().optional(),
})

const phytoSchema = z.object({
  field_task_id: z.string().uuid(),
  estimated_start_date: z.string().min(1, 'Requerido'),
  estimated_end_date: z.string().optional(),
  assigned_to_id: z.string().uuid().optional(),
})

type AspersionValues = z.infer<typeof aspersionSchema>
type PhytoValues = z.infer<typeof phytoSchema>

const ASPERSION_FIELDS = ['program_id', 'aspersion_date', 'evaluation_id', 'est_start_date', 'est_finish_date'] as const
const PHYTO_FIELDS = ['field_task_id', 'estimated_start_date', 'estimated_end_date'] as const

/* ─── Component ────────────────────────────────────────────────────── */

interface CreateSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Programa Hijo al que pertenece la sesión */
  programa: { id: string; master_program: string | null | undefined; title: string | null | undefined }
  /** Maestro padre (para invalidar tree query) */
  master: MasterProgram
  /** DataCentral activo — para listar usuarios responsables */
  datacentralId: string
}

export function CreateSessionDialog({ open, onOpenChange, programa, master, datacentralId }: CreateSessionDialogProps) {
  const queryClient = useQueryClient()
  const [sessionType, setSessionType] = useState<SessionType>('aspersion')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Nueva Sesión
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              → {programa.title ?? programa.id}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="mb-2 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={sessionType === 'aspersion' ? 'default' : 'outline'}
            onClick={() => setSessionType('aspersion')}
          >
            Aspersión
          </Button>
          <Button
            type="button"
            size="sm"
            variant={sessionType === 'phyto' ? 'default' : 'outline'}
            onClick={() => setSessionType('phyto')}
          >
            Fitosanitario
          </Button>
        </div>

        {sessionType === 'aspersion' ? (
          <AspersionForm
            programaId={programa.id}
            masterId={master.id}
            datacentralId={datacentralId}
            queryClient={queryClient}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <PhytoForm
            programaId={programa.id}
            masterId={master.id}
            datacentralId={datacentralId}
            queryClient={queryClient}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ─── Aspersión form ──────────────────────────────────────────────── */

function AspersionForm({
  programaId,
  masterId,
  datacentralId,
  queryClient,
  onClose,
}: {
  programaId: string
  masterId: string
  datacentralId: string
  queryClient: ReturnType<typeof useQueryClient>
  onClose: () => void
}) {
  const { data: evaluations = [], isLoading: loadingEvals } = useEvaluations('ASPERSION')
  const { data: dcUsers = [] } = useDatacentralUsers(datacentralId)

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AspersionValues>({
    resolver: zodResolver(aspersionSchema),
    defaultValues: { program_id: programaId },
  })

  const mutation = useMutation({
    mutationFn: async (values: AspersionValues) => {
      const body = {
        program_id: values.program_id,
        aspersion_date: values.aspersion_date,
        ...(values.evaluation_id ? { evaluation_id: values.evaluation_id } : {}),
        ...(values.est_start_date ? { est_start_date: values.est_start_date } : {}),
        ...(values.est_finish_date ? { est_finish_date: values.est_finish_date } : {}),
        ...(values.assigned_to_id ? { assigned_to_id: values.assigned_to_id } : {}),
      }
      const { data, error } = await apiClient.POST(
        '/api/v1/monitoring/aspersion/headers/',
        { body: body as never }
      )
      if (error) {
        if (typeof error === 'object' && error !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          applyDrfErrors(error as any, setError, ASPERSION_FIELDS)
          throw new Error('Corrige los errores del formulario')
        }
        throw new Error('No se pudo crear la sesión de aspersión')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-tree', masterId] })
      reset()
      onClose()
    },
  })

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="as-date">Fecha de aspersión *</Label>
        <Input id="as-date" type="date" {...register('aspersion_date')} />
        {errors.aspersion_date && (
          <p className="text-xs text-destructive">{errors.aspersion_date.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label>Evaluación</Label>
        <Controller
          name="evaluation_id"
          control={control}
          render={({ field }) => (
            <Select
              disabled={loadingEvals}
              onValueChange={field.onChange}
              value={field.value ?? ''}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingEvals ? 'Cargando...' : 'Sin evaluación (opcional)'} />
              </SelectTrigger>
              <SelectContent>
                {evaluations.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="as-start">Inicio estimado</Label>
          <Input id="as-start" type="date" {...register('est_start_date')} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="as-end">Fin estimado</Label>
          <Input id="as-end" type="date" {...register('est_finish_date')} />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Responsable</Label>
        <Controller
          name="assigned_to_id"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin asignar</SelectItem>
                {dcUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {errors.root && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errors.root.message}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Crear Sesión'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/* ─── Fitosanitario form ──────────────────────────────────────────── */

function PhytoForm({
  programaId,
  masterId,
  datacentralId,
  queryClient,
  onClose,
}: {
  programaId: string
  masterId: string
  datacentralId: string
  queryClient: ReturnType<typeof useQueryClient>
  onClose: () => void
}) {
  const { data: dcUsers = [] } = useDatacentralUsers(datacentralId)
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PhytoValues>({
    resolver: zodResolver(phytoSchema),
    defaultValues: { field_task_id: programaId },
  })

  const mutation = useMutation({
    mutationFn: async (values: PhytoValues) => {
      const { data, error } = await apiClient.POST(
        '/api/v1/monitoring/phyto/headers/create/',
        { body: values as never }
      )
      if (error) {
        if (typeof error === 'object' && error !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          applyDrfErrors(error as any, setError, PHYTO_FIELDS)
          throw new Error('Corrige los errores del formulario')
        }
        throw new Error('No se pudo crear la sesión fitosanitaria')
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-tree', masterId] })
      reset()
      onClose()
    },
  })

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="ph-start">Fecha estimada de inicio *</Label>
        <Input id="ph-start" type="date" {...register('estimated_start_date')} />
        {errors.estimated_start_date && (
          <p className="text-xs text-destructive">{errors.estimated_start_date.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="ph-end">Fecha estimada de fin</Label>
        <Input id="ph-end" type="date" {...register('estimated_end_date')} />
      </div>

      <div className="space-y-1">
        <Label>Responsable</Label>
        <Controller
          name="assigned_to_id"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <SelectTrigger>
                <SelectValue placeholder="Sin asignar (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sin asignar</SelectItem>
                {dcUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {errors.root && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {errors.root.message}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Crear Sesión'}
        </Button>
      </DialogFooter>
    </form>
  )
}
