import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { apiClient } from '@/lib/api/client'
import { WORK_ROLES_QUERY_KEY } from '../hooks/useUserCatalogs'

interface CreateWorkRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se invoca con el id del rol laboral recién creado, para auto-seleccionarlo. */
  onCreated?: (workRoleId: number) => void
}

/**
 * Alta rápida de un rol laboral (WorkRole) desde el formulario de creación de usuario.
 * Caso de uso §1.6.6.2: el admin puede crear el rol laboral sin abandonar el alta.
 * POST /api/v1/users/work-roles/create/.
 */
export function CreateWorkRoleDialog({ open, onOpenChange, onCreated }: CreateWorkRoleDialogProps) {
  const queryClient = useQueryClient()
  const [workName, setWorkName] = useState('')
  const [description, setDescription] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await apiClient.POST('/api/v1/users/work-roles/create/', {
        body: {
          work_name: workName,
          ...(description ? { activity_description: description } : {}),
        } as never,
      })
      if (error) throw new Error('No se pudo crear el rol laboral')
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: WORK_ROLES_QUERY_KEY })
      toast.success('El rol laboral se creó correctamente.')
      if (data && typeof data.id === 'number') onCreated?.(data.id)
      handleClose()
    },
    onError: (err) => toast.error(err.message),
  })

  function handleClose() {
    setWorkName('')
    setDescription('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo rol laboral</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="wr-name">Nombre del rol *</Label>
            <Input
              id="wr-name"
              value={workName}
              onChange={(e) => setWorkName(e.target.value)}
              placeholder="Ej: Ingeniero agrónomo"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wr-desc">Descripción de la actividad</Label>
            <Input
              id="wr-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={!workName.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Guardando…' : 'Crear rol'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
