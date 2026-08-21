import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Search } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useProducers } from '../hooks/useProducers'
import { useRanches } from '../hooks/useRanches'
import { usePlots } from '../hooks/usePlots'
import {
  useAssignmentScope,
  useUpdateAssignmentScope,
  type AccessMode,
} from '../hooks/useAssignmentScope'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  assignmentId: number | null
  username: string
  datacentralId: string
  datacentralName: string
}

const TODOS = '__todos__'

/**
 * Alcance de un usuario dentro de una CIAgro.
 *
 * Dos modos excluyentes: acceso completo (ve todo el alcance de la CIAgro, y las
 * parcelas quedan tácitas) o delimitado (solo las parcelas elegidas, con el rancho y
 * la agrounidad implícitos).
 *
 * El selector solo aparece en modo delimitado: en modo completo no hay nada que
 * elegir, y mostrarlo sugeriría que la selección importa cuando se ignora.
 */
export function UserScopeDialog({
  open,
  onOpenChange,
  assignmentId,
  username,
  datacentralId,
  datacentralName,
}: Props) {
  const scope = useAssignmentScope(open ? assignmentId : null)
  const guardar = useUpdateAssignmentScope()

  const [modo, setModo] = useState<AccessMode>('full')
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set())
  const [filtroProductor, setFiltroProductor] = useState<string>(TODOS)
  const [filtroRancho, setFiltroRancho] = useState<string>(TODOS)
  const [busqueda, setBusqueda] = useState('')

  const productores = useProducers(open ? datacentralId : null)
  const idsProductores = useMemo(
    () => (productores.data ?? []).map((p) => p.id),
    [productores.data]
  )
  // Todas las parcelas de la CIAgro de una vez: cuelgan de varios productores, así que
  // se piden con `producer_in` en lugar de una petición por productor.
  const parcelas = usePlots(open ? { producerIds: idsProductores } : {})
  // El filtro de rancho depende del productor elegido; sin productor no se ofrece.
  const ranchos = useRanches(
    open && filtroProductor !== TODOS ? filtroProductor : null
  )

  // Al abrir se parte del alcance guardado, no de un estado en blanco: el modal es de
  // edición, y arrancar vacío haría creer que no había nada configurado.
  useEffect(() => {
    if (!open || !scope.data) return
    setModo((scope.data.access_mode as AccessMode) ?? 'full')
    setSeleccionadas(new Set((scope.data.plots ?? []).map((p) => p.id)))
    setFiltroProductor(TODOS)
    setFiltroRancho(TODOS)
    setBusqueda('')
  }, [open, scope.data])

  // Cambiar de productor invalida el rancho elegido, que pertenecía al anterior.
  useEffect(() => {
    setFiltroRancho(TODOS)
  }, [filtroProductor])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return (parcelas.data ?? []).filter((p) => {
      if (filtroProductor !== TODOS && p.producer_id !== filtroProductor) return false
      if (filtroRancho !== TODOS && p.ranch !== filtroRancho) return false
      if (texto && !`${p.code ?? ''} ${p.description ?? ''}`.toLowerCase().includes(texto))
        return false
      return true
    })
  }, [parcelas.data, filtroProductor, filtroRancho, busqueda])

  /** Agrupa Agrounidad -> Rancho, que es la jerarquía con la que el gerente piensa. */
  const agrupadas = useMemo(() => {
    const porProductor = new Map<
      string,
      { nombre: string; ranchos: Map<string, { nombre: string; parcelas: typeof visibles }> }
    >()
    for (const p of visibles) {
      const productorId = p.producer_id ?? 'sin-productor'
      const productorNombre = p.producer_name ?? 'Sin agrounidad'
      const ranchoId = p.ranch ?? 'sin-rancho'
      const ranchoNombre = p.ranch_name ?? 'Sin rancho'
      if (!porProductor.has(productorId)) {
        porProductor.set(productorId, { nombre: productorNombre, ranchos: new Map() })
      }
      const grupo = porProductor.get(productorId)!
      if (!grupo.ranchos.has(ranchoId)) {
        grupo.ranchos.set(ranchoId, { nombre: ranchoNombre, parcelas: [] })
      }
      grupo.ranchos.get(ranchoId)!.parcelas.push(p)
    }
    return porProductor
  }, [visibles])

  function alternar(plotId: string) {
    setSeleccionadas((previas) => {
      const siguiente = new Set(previas)
      if (siguiente.has(plotId)) siguiente.delete(plotId)
      else siguiente.add(plotId)
      return siguiente
    })
  }

  function alternarRancho(idsDelRancho: string[], todasPuestas: boolean) {
    setSeleccionadas((previas) => {
      const siguiente = new Set(previas)
      for (const id of idsDelRancho) {
        if (todasPuestas) siguiente.delete(id)
        else siguiente.add(id)
      }
      return siguiente
    })
  }

  const sinParcelasEnLaCIAgro = !parcelas.isLoading && (parcelas.data ?? []).length === 0
  const delimitadoSinSeleccion = modo === 'restricted' && seleccionadas.size === 0

  async function onGuardar() {
    if (assignmentId == null) return
    try {
      await guardar.mutateAsync({
        assignmentId,
        accessMode: modo,
        plotIds: modo === 'restricted' ? [...seleccionadas] : [...seleccionadas],
      })
      toast.success(
        modo === 'full'
          ? `${username} tiene acceso completo a ${datacentralName}.`
          : `${username} queda delimitado a ${seleccionadas.size} parcela(s).`
      )
      onOpenChange(false)
    } catch {
      toast.error('No se pudo guardar el alcance.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Alcance de {username}</DialogTitle>
          <DialogDescription>
            Define qué puede ver este usuario dentro de <strong>{datacentralName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {scope.isLoading ? (
          <LoadingState label="Cargando alcance…" />
        ) : scope.isError ? (
          <ErrorState
            title="No se pudo cargar el alcance"
            onRetry={() => void scope.refetch()}
          />
        ) : (
          <div className="space-y-4">
            <RadioGroup
              value={modo}
              onValueChange={(v) => setModo(v as AccessMode)}
              className="space-y-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <RadioGroupItem value="full" id="modo-full" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Acceso completo</span>
                  <span className="block text-xs text-muted-foreground">
                    Ve todas las parcelas de los ranchos de las agrounidades de esta CIAgro,
                    incluidas las que se agreguen después.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3">
                <RadioGroupItem value="restricted" id="modo-restricted" className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">Delimitado por parcela</span>
                  <span className="block text-xs text-muted-foreground">
                    Solo las parcelas que elijas. El rancho y la agrounidad se deducen de
                    ellas.
                  </span>
                </span>
              </label>
            </RadioGroup>

            {modo === 'restricted' && (
              <div className="space-y-3">
                {parcelas.isLoading ? (
                  <LoadingState compact label="Cargando parcelas…" />
                ) : parcelas.isError ? (
                  <ErrorState
                    title="No se pudieron cargar las parcelas"
                    onRetry={() => void parcelas.refetch()}
                  />
                ) : sinParcelasEnLaCIAgro ? (
                  // Distinto de "no hay resultados con estos filtros": aquí no hay nada
                  // que asignar, y sin este aviso el modal parecería roto.
                  <EmptyState
                    title="Esta CIAgro no tiene parcelas"
                    description="Sus agrounidades aún no tienen ranchos con parcelas registradas, así que no hay nada que delimitar."
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Select value={filtroProductor} onValueChange={setFiltroProductor}>
                        <SelectTrigger className="w-[190px]">
                          <SelectValue placeholder="Agrounidad" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TODOS}>Todas las agrounidades</SelectItem>
                          {(productores.data ?? []).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.commercial_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={filtroRancho}
                        onValueChange={setFiltroRancho}
                        disabled={filtroProductor === TODOS}
                      >
                        <SelectTrigger className="w-[190px]">
                          <SelectValue
                            placeholder={
                              filtroProductor === TODOS ? 'Elige una agrounidad' : 'Rancho'
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TODOS}>Todos los ranchos</SelectItem>
                          {(ranchos.data ?? []).map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name ?? r.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="relative min-w-[170px] flex-1">
                        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Buscar parcela…"
                          className="pl-8"
                        />
                      </div>
                    </div>

                    <div className="max-h-[320px] space-y-3 overflow-y-auto rounded-lg border p-3">
                      {visibles.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          Ninguna parcela coincide con estos filtros.
                        </p>
                      ) : (
                        [...agrupadas.entries()].map(([productorId, grupo]) => (
                          <div key={productorId} className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {grupo.nombre}
                            </p>
                            {[...grupo.ranchos.entries()].map(([ranchoId, rancho]) => {
                              const ids = rancho.parcelas.map((p) => p.id)
                              const todas = ids.every((id) => seleccionadas.has(id))
                              return (
                                <div key={ranchoId} className="pl-3">
                                  <label className="flex cursor-pointer items-center gap-2 py-1 text-sm font-medium">
                                    <Checkbox
                                      checked={todas}
                                      onCheckedChange={() => alternarRancho(ids, todas)}
                                    />
                                    {rancho.nombre}
                                    <span className="text-xs font-normal text-muted-foreground">
                                      ({rancho.parcelas.length})
                                    </span>
                                  </label>
                                  <div className="pl-6">
                                    {rancho.parcelas.map((p) => (
                                      <label
                                        key={p.id}
                                        className="flex cursor-pointer items-center gap-2 py-1 text-sm"
                                      >
                                        <Checkbox
                                          checked={seleccionadas.has(p.id)}
                                          onCheckedChange={() => alternar(p.id)}
                                        />
                                        <span>{p.code}</span>
                                        {p.description && (
                                          <span className="text-xs text-muted-foreground">
                                            {p.description}
                                          </span>
                                        )}
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ))
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {seleccionadas.size} parcela(s) seleccionada(s)
                      {visibles.length !== (parcelas.data ?? []).length &&
                        ` · mostrando ${visibles.length} de ${(parcelas.data ?? []).length}`}
                    </p>
                  </>
                )}

                {delimitadoSinSeleccion && (
                  // Es un estado válido en la base de datos, pero deja al usuario sin ver
                  // absolutamente nada. Se avisa antes de guardar, no después.
                  <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      Sin ninguna parcela seleccionada, <strong>{username}</strong> no verá
                      nada dentro de {datacentralName}.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onGuardar} disabled={guardar.isPending || scope.isLoading}>
            {guardar.isPending ? 'Guardando…' : 'Guardar alcance'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
