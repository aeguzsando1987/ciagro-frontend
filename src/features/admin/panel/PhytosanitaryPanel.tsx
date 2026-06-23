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
import { Trash2 } from 'lucide-react'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { applyDrfErrors } from '@/features/task-manager/hooks/useDrfErrorMap'
import { Field } from '../components/Field'
import { AssignCombobox } from '../components/AssignCombobox'
import { useCrops } from '../hooks/useCrops'
import {
  usePhytosanitaryDetail,
  useUpdatePhytosanitary,
  useCreatePhytoPhoto,
  useDeletePhytoPhoto,
} from '../hooks/usePhytosanitary'
import type { PhytosanitaryCatalog, PhytosanitaryStage } from '../types'

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
  type: z.enum(['Plaga', 'Enfermedad']).optional(),
  default_crop_id: z.string().optional(),
  description: z.string().optional(),
  min_ref_value: z.string().optional(),
  max_ref_value: z.string().optional(),
})

type FormValues = z.infer<typeof schema>
const KNOWN_FIELDS = ['name', 'type', 'default_crop_id', 'description', 'min_ref_value', 'max_ref_value'] as const

interface Props {
  phyto: PhytosanitaryCatalog
  onClose: () => void
}

export function PhytosanitaryPanel({ phyto, onClose }: Props) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [showPhotoForm, setShowPhotoForm] = useState(false)
  const [photoStage, setPhotoStage] = useState<PhytosanitaryStage | ''>('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoCaption, setPhotoCaption] = useState('')

  const user = useAuthStore((s) => s.user)
  const canEdit = (user?.role_level ?? 0) >= ROLE_LEVELS.SUPERVISOR

  const { data: detail } = usePhytosanitaryDetail(phyto.id)
  const { data: crops = [] } = useCrops()
  const updateMutation = useUpdatePhytosanitary()
  const createPhoto = useCreatePhytoPhoto()
  const deletePhoto = useDeletePhytoPhoto()

  const currentPhyto = detail ?? phyto
  const stageOptions = currentPhyto.type === 'Plaga' ? PEST_STAGES : DISEASE_STAGES

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
      name: phyto.name,
      type: phyto.type as 'Plaga' | 'Enfermedad' | undefined,
      default_crop_id: phyto.default_crop?.id != null ? String(phyto.default_crop.id) : '',
      description: phyto.description ?? '',
      min_ref_value: phyto.min_ref_value != null ? String(phyto.min_ref_value) : '',
      max_ref_value: phyto.max_ref_value != null ? String(phyto.max_ref_value) : '',
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
        id: phyto.id,
        payload: {
          name: values.name,
          type: values.type as 'Plaga' | 'Enfermedad' | undefined,
          default_crop_id: values.default_crop_id ? Number(values.default_crop_id) : null,
          description: values.description || null,
          min_ref_value: values.min_ref_value ? Number(values.min_ref_value) : null,
          max_ref_value: values.max_ref_value ? Number(values.max_ref_value) : null,
        },
      })
      toast.success('Fitosanitario actualizado correctamente.')
      setMode('view')
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      applyDrfErrors(err as any, setError, [...KNOWN_FIELDS])
      toast.error('No se pudo actualizar el fitosanitario.')
    }
  }

  async function handleAddPhoto() {
    if (!photoStage || !photoFile) return
    try {
      await createPhoto.mutateAsync({
        phytosanitary_id: phyto.id,
        stage: photoStage as PhytosanitaryStage,
        photo: photoFile,
        caption: photoCaption || undefined,
      })
      toast.success('Etapa agregada correctamente.')
      setShowPhotoForm(false)
      setPhotoStage('')
      setPhotoFile(null)
      setPhotoCaption('')
    } catch {
      toast.error('No se pudo agregar la etapa.')
    }
  }

  async function handleDeletePhoto(photoId: number) {
    try {
      await deletePhoto.mutateAsync({ photoId, phytosanitaryId: phyto.id })
      toast.success('Etapa eliminada.')
    } catch {
      toast.error('No se pudo eliminar la etapa.')
    }
  }

  const cropItems = crops.map((c) => ({ id: String(c.id), label: c.name, sublabel: c.variety ?? undefined }))

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{phyto.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detail">
          <TabsList className="w-full">
            <TabsTrigger value="detail" className="flex-1">Detalle</TabsTrigger>
            <TabsTrigger value="photos" className="flex-1">Detalle de etapas</TabsTrigger>
          </TabsList>

          {/* ── Tab Detalle ── */}
          <TabsContent value="detail" className="pt-4">
            {mode === 'view' ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">Tipo</span>
                    <p><Badge variant="outline">{currentPhyto.type ?? '—'}</Badge></p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cultivo</span>
                    <p className="font-medium">{currentPhyto.default_crop?.name ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mín. referencia</span>
                    <p>{currentPhyto.min_ref_value ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Máx. referencia</span>
                    <p>{currentPhyto.max_ref_value ?? '—'}</p>
                  </div>
                </div>
                {currentPhyto.description && (
                  <div>
                    <span className="text-muted-foreground">Descripción</span>
                    <p>{currentPhyto.description}</p>
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
                  <Field label="Tipo" error={errors.type?.message}>
                    <Controller
                      name="type"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value ?? ''} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue placeholder="Tipo..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Plaga">Plaga</SelectItem>
                            <SelectItem value="Enfermedad">Enfermedad</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>
                  <Field label="Cultivo" error={errors.default_crop_id?.message}>
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
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Mín. referencia">
                    <Input type="number" step="any" {...register('min_ref_value')} />
                  </Field>
                  <Field label="Máx. referencia">
                    <Input type="number" step="any" {...register('max_ref_value')} />
                  </Field>
                </div>
                <Field label="Descripción">
                  <textarea
                    {...register('description')}
                    rows={2}
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
          </TabsContent>

          {/* ── Tab Fotos ── */}
          <TabsContent value="photos" className="pt-4 space-y-3">
            {(currentPhyto.stage_photos ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Sin fotos de etapas aún.</p>
            )}
            {(currentPhyto.stage_photos ?? []).map((photo) => (
              <div key={photo.id} className="flex items-center gap-3 border rounded p-2">
                <img src={photo.photo} alt={photo.stage_display} className="h-14 w-14 rounded object-cover border" />
                <div className="flex-1 min-w-0">
                  <Badge variant="outline" className="mb-1">{photo.stage_display}</Badge>
                  {photo.caption && <p className="text-xs text-muted-foreground truncate">{photo.caption}</p>}
                </div>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeletePhoto(photo.id)}
                    disabled={deletePhoto.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}

            {canEdit && !showPhotoForm && (
              <Button variant="outline" size="sm" className="w-full" onClick={() => setShowPhotoForm(true)}>
                + Agregar etapa
              </Button>
            )}

            {showPhotoForm && (
              <div className="border rounded p-3 space-y-2">
                <Field label="Etapa">
                  <Select value={photoStage} onValueChange={(v) => setPhotoStage(v as PhytosanitaryStage)}>
                    <SelectTrigger><SelectValue placeholder="Selecciona etapa..." /></SelectTrigger>
                    <SelectContent>
                      {stageOptions.map((s) => (
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
                    onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                </Field>
                <Field label="Descripción (opcional)">
                  <Input value={photoCaption} onChange={(e) => setPhotoCaption(e.target.value)} placeholder="Ej: Larva recién eclosionada" />
                </Field>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowPhotoForm(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!photoStage || !photoFile || createPhoto.isPending}
                    onClick={handleAddPhoto}
                  >
                    {createPhoto.isPending ? 'Subiendo...' : 'Añadir etapa'}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
