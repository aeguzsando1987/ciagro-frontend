import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { AssignCombobox } from '../components/AssignCombobox'
import { useCrops } from '../hooks/useCrops'
import { useCreatePhytosanitary, useCreatePhytoPhoto } from '../hooks/usePhytosanitary'
import type { PhytosanitaryStage } from '../types'

const PEST_STAGES: { value: PhytosanitaryStage; label: string }[] = [
  { value: 'huevesillo', label: 'Huevesillo' },
  { value: 'larva', label: 'Larva / Joven' },
  { value: 'pupa', label: 'Pupa' },
  { value: 'adulto', label: 'Adulto' },
  { value: 'adulto_alas', label: 'Adulto con alas' },
]

const DISEASE_STAGES: { value: PhytosanitaryStage; label: string }[] = [
  { value: 'inicio', label: 'Inicio' },
  { value: 'desarrollo', label: 'Desarrollo' },
  { value: 'avanzado', label: 'Avanzado' },
  { value: 'terminal', label: 'Terminal' },
]

const schema = z.object({
  name: z.string().min(1, 'Requerido'),
  type: z.enum(['Plaga', 'Enfermedad'], { required_error: 'Requerido' }),
  default_crop_id: z.string().optional(),
  description: z.string().optional(),
  min_ref_value: z.string().optional(),
  max_ref_value: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

type StageEntry = {
  stage: PhytosanitaryStage
  photo: File
  caption: string
}

const KNOWN_FIELDS = ['name', 'type', 'default_crop_id', 'description', 'min_ref_value', 'max_ref_value'] as const

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreatePhytosanitaryDialog({ open, onOpenChange }: Props) {
  const createPhyto = useCreatePhytosanitary()
  const createPhoto = useCreatePhytoPhoto()
  const { data: crops = [] } = useCrops()

  const [stages, setStages] = useState<StageEntry[]>([])
  const [stageForm, setStageForm] = useState<{
    stage: PhytosanitaryStage | ''
    photo: File | null
    caption: string
  }>({ stage: '', photo: null, caption: '' })
  const [showStageForm, setShowStageForm] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', type: undefined, default_crop_id: '', description: '', min_ref_value: '', max_ref_value: '' },
  })

  const selectedType = watch('type')

  const availableStages = selectedType === 'Plaga' ? PEST_STAGES : selectedType === 'Enfermedad' ? DISEASE_STAGES : []

  function handleClose() {
    reset()
    setStages([])
    setStageForm({ stage: '', photo: null, caption: '' })
    setShowStageForm(false)
    onOpenChange(false)
  }

  function addStageEntry() {
    if (!stageForm.stage || !stageForm.photo) return
    setStages((prev) => [...prev, { stage: stageForm.stage as PhytosanitaryStage, photo: stageForm.photo!, caption: stageForm.caption }])
    setStageForm({ stage: '', photo: null, caption: '' })
    setShowStageForm(false)
  }

  function removeStage(idx: number) {
    setStages((prev) => prev.filter((_, i) => i !== idx))
  }

  async function onSubmit(values: FormValues) {
    try {
      const phyto = await createPhyto.mutateAsync({
        name: values.name,
        type: values.type as 'Plaga' | 'Enfermedad',
        default_crop_id: values.default_crop_id ? Number(values.default_crop_id) : null,
        description: values.description || null,
        min_ref_value: values.min_ref_value ? Number(values.min_ref_value) : null,
        max_ref_value: values.max_ref_value ? Number(values.max_ref_value) : null,
      })

      let succeeded = 0
      let failed = 0
      for (const entry of stages) {
        try {
          await createPhoto.mutateAsync({
            phytosanitary_id: phyto.id,
            stage: entry.stage,
            photo: entry.photo,
            caption: entry.caption || undefined,
          })
          succeeded++
        } catch {
          failed++
        }
      }

      if (stages.length === 0) {
        toast.success('El registro del fitosanitario se almacenó correctamente.')
      } else if (failed === 0) {
        toast.success(`Fitosanitario y ${succeeded} etapa(s) creado(s) correctamente.`)
      } else {
        toast.warning(`Fitosanitario creado. ${succeeded} de ${stages.length} etapa(s) guardada(s). ${failed} fallaron.`)
      }
      handleClose()
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo crear el fitosanitario. Revisa los campos e intenta de nuevo.')
    }
  }

  const cropItems = crops.map((c) => ({ id: String(c.id), label: c.name, sublabel: c.variety ?? undefined }))

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuevo fitosanitario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Nombre *" error={errors.name?.message}>
            <Input {...register('name')} placeholder="Ej: Antracnosis" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo *" error={errors.type?.message}>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Plaga">Plaga</SelectItem>
                      <SelectItem value="Enfermedad">Enfermedad</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label="Cultivo asociado" error={errors.default_crop_id?.message}>
              <Controller
                name="default_crop_id"
                control={control}
                render={({ field }) => (
                  <AssignCombobox
                    items={cropItems}
                    placeholder="Buscar cultivo..."
                    value={field.value ?? ''}
                    onChange={field.onChange}
                  />
                )}
              />
            </Field>
          </div>
          <Field label="Descripción" error={errors.description?.message}>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Descripción corta..."
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Mín. referencia" error={errors.min_ref_value?.message}>
              <Input type="number" step="any" {...register('min_ref_value')} placeholder="0" />
            </Field>
            <Field label="Máx. referencia" error={errors.max_ref_value?.message}>
              <Input type="number" step="any" {...register('max_ref_value')} placeholder="0" />
            </Field>
          </div>

          {/* Sub-form de etapas de desarrollo */}
          <div className="border rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Etapas de desarrollo ({stages.length})</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedType}
                onClick={() => setShowStageForm(true)}
              >
                + Agregar etapa
              </Button>
            </div>

            {stages.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm bg-muted rounded px-2 py-1">
                <span>{availableStages.find((a) => a.value === s.stage)?.label ?? s.stage} — {s.photo.name}</span>
                <button type="button" onClick={() => removeStage(idx)} className="text-destructive hover:underline text-xs">
                  Quitar
                </button>
              </div>
            ))}

            {showStageForm && (
              <div className="border rounded p-2 space-y-2 bg-background">
                <Field label="Etapa">
                  <Select
                    value={stageForm.stage}
                    onValueChange={(v) => setStageForm((p) => ({ ...p, stage: v as PhytosanitaryStage }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona etapa..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStages.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Foto *">
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-muted file:text-foreground cursor-pointer"
                    onChange={(e) => setStageForm((p) => ({ ...p, photo: e.target.files?.[0] ?? null }))}
                  />
                </Field>
                <Field label="Descripción (opcional)">
                  <Input
                    value={stageForm.caption}
                    onChange={(e) => setStageForm((p) => ({ ...p, caption: e.target.value }))}
                    placeholder="Ej: Larva recién eclosionada"
                  />
                </Field>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowStageForm(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!stageForm.stage || !stageForm.photo}
                    onClick={addStageEntry}
                  >
                    Añadir etapa
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
