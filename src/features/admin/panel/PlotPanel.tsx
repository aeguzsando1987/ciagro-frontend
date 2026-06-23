import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
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
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AnimatedTabs as Tabs } from '@/components/ui/animated-tabs'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { PlotMiniMap } from '@/features/task-manager/panel/PlotMiniMap'
import { Field } from '../components/Field'
import { PlotVerticesImport } from '../components/PlotVerticesImport'
import { useUpdatePlot, useDeletePlot, usePlotDetail } from '../hooks/usePlots'
import type { PlotFlat } from '../types'

const schema = z.object({
  description: z.string().optional(),
  tech_spraying: z.enum(['yes', 'no']).optional(),
  comments: z.string().optional(),
  status: z.enum(['active', 'inactive', 'deprecated']).optional(),
})

type FormValues = z.infer<typeof schema>
const KNOWN_FIELDS = ['description', 'tech_spraying', 'comments', 'status'] as const

interface Props {
  plot: PlotFlat
  onClose: () => void
}

export function PlotPanel({ plot, onClose }: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const user = useAuthStore((s) => s.user)
  const roleLevel = user?.role_level ?? 0
  const canEdit = roleLevel >= ROLE_LEVELS.MANAGER
  const canDelete = roleLevel >= ROLE_LEVELS.SUPER_ADMIN

  // Refrescar detalle tras importar vértices
  const { data: detail } = usePlotDetail(plot.id)
  const current = detail ?? plot

  const updateMutation = useUpdatePlot()
  const deleteMutation = useDeletePlot()

  const {
    register,
    handleSubmit,
    control,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: plot.description ?? '',
      tech_spraying: plot.tech_spraying ? 'yes' : 'no',
      comments: plot.comments ?? '',
      status: plot.status ?? 'active',
    },
  })

  function handleClose() {
    reset()
    setMode('view')
    onClose()
  }

  async function onSubmit(values: FormValues) {
    try {
      await updateMutation.mutateAsync({
        id: plot.id,
        payload: {
          description: values.description || undefined,
          tech_spraying: values.tech_spraying === 'yes',
          comments: values.comments || undefined,
          status: values.status,
        },
      })
      toast.success('Parcela actualizada.')
      setMode('view')
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo actualizar la parcela.')
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar la parcela "${plot.code}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteMutation.mutateAsync(plot.id)
      toast.success('Parcela eliminada.')
      handleClose()
    } catch {
      toast.error('No se pudo eliminar la parcela.')
    }
  }

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {plot.code}
            <Badge variant="outline" className="text-xs font-normal">
              {current.status ?? 'active'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detail">
          <TabsList>
            <TabsTrigger value="detail">Detalle</TabsTrigger>
            <TabsTrigger value="map">Mapa</TabsTrigger>
            <TabsTrigger value="vertices">Vértices</TabsTrigger>
          </TabsList>

          {/* ── Tab Detalle ── */}
          <TabsContent value="detail" className="space-y-4 pt-3">
            {current.total_area && (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Área: <span className="font-medium text-foreground">{current.total_area} ha</span>
                {current.centroid && (
                  <span className="ml-3">
                    Centroide:{' '}
                    <span className="font-medium text-foreground">
                      {Number(current.centroid.coordinates?.[1]).toFixed(5)},{' '}
                      {Number(current.centroid.coordinates?.[0]).toFixed(5)}
                    </span>
                  </span>
                )}
              </div>
            )}

            {mode === 'view' ? (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">Descripción</span>
                  <span>{current.description || '—'}</span>
                  <span className="text-muted-foreground">Aspersión técnica</span>
                  <span>{current.tech_spraying ? 'Sí' : 'No'}</span>
                  <span className="text-muted-foreground">Comentarios</span>
                  <span>{current.comments || '—'}</span>
                </div>
                {canEdit && (
                  <div className="flex justify-end pt-2">
                    <Button size="sm" variant="outline" onClick={() => setMode('edit')}>
                      Editar
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Field label="Descripción" error={errors.description?.message}>
                  <Input {...register('description')} />
                </Field>
                <Field label="Aspersión técnica" error={errors.tech_spraying?.message}>
                  <Controller
                    name="tech_spraying"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value ?? 'no'} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Sí</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <Field label="Comentarios" error={errors.comments?.message}>
                  <Input {...register('comments')} />
                </Field>
                <Field label="Estatus" error={errors.status?.message}>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value ?? 'active'} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Activo</SelectItem>
                          <SelectItem value="inactive">Inactivo</SelectItem>
                          <SelectItem value="deprecated">Depreciado</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setMode('view')}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? 'Guardando…' : 'Guardar'}
                  </Button>
                </div>
              </form>
            )}
          </TabsContent>

          {/* ── Tab Mapa ── */}
          <TabsContent value="map" className="pt-3 space-y-3">
            {current.total_area || current.centroid ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {current.total_area && (
                  <div className="rounded-md border px-3 py-2 space-y-0.5">
                    <p className="text-xs text-muted-foreground">Área</p>
                    <p className="font-semibold">{current.total_area} ha</p>
                    <p className="text-xs text-muted-foreground">
                      {(parseFloat(current.total_area) * 10_000).toLocaleString('es-MX', {
                        maximumFractionDigits: 0,
                      })}{' '}
                      m²
                    </p>
                  </div>
                )}
                {current.centroid?.coordinates && (
                  <div className="rounded-md border px-3 py-2 space-y-0.5">
                    <p className="text-xs text-muted-foreground">Centroide</p>
                    <p className="font-mono text-xs">
                      {Number(current.centroid.coordinates[1]).toFixed(6)}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {Number(current.centroid.coordinates[0]).toFixed(6)}
                    </p>
                  </div>
                )}
              </div>
            ) : null}
            <PlotMiniMap plotId={plot.id} showTooltip />
          </TabsContent>

          {/* ── Tab Vértices ── */}
          <TabsContent value="vertices" className="pt-3">
            {canEdit ? (
              <PlotVerticesImport plotId={plot.id} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Se requiere rol Gerente o superior para importar vértices.
              </p>
            )}
          </TabsContent>
        </Tabs>

        {canDelete && (
          <DialogFooter className="border-t pt-3 mt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar parcela'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
