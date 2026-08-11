/**
 * Modal de búsqueda avanzada del explorador (fase AS).
 *
 * Estructura del use case: rango de fechas + productor + rancho + parcela + tipo, con
 * cascada real (los ranchos ofrecidos son los de los productores elegidos; las
 * parcelas, las de esos ranchos). Se añadió el selector de organización, acordado con
 * el desarrollador, para acotar cuando el usuario ve varias.
 *
 * El estado se edita en un borrador local y solo viaja a la URL al pulsar "Aplicar":
 * así el usuario puede componer la búsqueda sin que el árbol se recargue a cada clic.
 */
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDataCentralMains } from '@/features/admin/hooks/useDataCentrals'
import { MultiSelectSearch, useDebouncedValue } from './MultiSelectSearch'
import {
  DATE_MODE_LABELS,
  SESSION_KINDS,
  SESSION_KIND_LABELS,
  type AdvancedSearchCriteria,
  type DateMode,
} from '../lib/advancedSearch'
import {
  usePlotOptions,
  useProducerOptions,
  useRanchOptions,
} from '../hooks/useSearchOptions'
import type { SessionKind } from '../types'

interface AdvancedSearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  criteria: AdvancedSearchCriteria
  onApply: (criteria: AdvancedSearchCriteria) => void
}

export function AdvancedSearchModal({
  open,
  onOpenChange,
  criteria,
  onApply,
}: AdvancedSearchModalProps) {
  const [draft, setDraft] = useState(criteria)
  const [producerSearch, setProducerSearch] = useState('')
  const [ranchSearch, setRanchSearch] = useState('')
  const [plotSearch, setPlotSearch] = useState('')

  // Al reabrir, el borrador parte de lo que hoy está aplicado (la URL manda).
  useEffect(() => {
    if (open) setDraft(criteria)
  }, [open, criteria])

  const orgs = useDataCentralMains()
  const producers = useProducerOptions(draft.org, useDebouncedValue(producerSearch))
  const ranches = useRanchOptions(draft.producers, useDebouncedValue(ranchSearch))
  const plots = usePlotOptions(draft.ranches, useDebouncedValue(plotSearch))

  /**
   * Al QUITAR algo de un nivel se limpian los de abajo; al añadir, no.
   *
   * Quitar un productor puede dejar huérfano un rancho suyo, y esa incoherencia se
   * combina con AND en el backend: cero resultados sin que el usuario entienda por
   * qué. Añadir, en cambio, solo ensancha la búsqueda, así que borrar la selección de
   * abajo sería trabajo perdido para quien está componiendo su filtro.
   *
   * El componente no conoce la relación rancho→productor (las opciones son id y
   * etiqueta), por eso la regla es esta y no un recorte selectivo.
   */
  function isAdditive(previous: string[], next: string[]): boolean {
    const nextSet = new Set(next)
    return previous.every((id) => nextSet.has(id))
  }

  function setProducers(ids: string[]) {
    setDraft((prev) =>
      isAdditive(prev.producers, ids)
        ? { ...prev, producers: ids }
        : { ...prev, producers: ids, ranches: [], plots: [] }
    )
  }

  function setRanches(ids: string[]) {
    setDraft((prev) =>
      isAdditive(prev.ranches, ids)
        ? { ...prev, ranches: ids }
        : { ...prev, ranches: ids, plots: [] }
    )
  }

  function setOrg(value: string) {
    setDraft((prev) => ({
      ...prev,
      org: value || null,
      producers: [],
      ranches: [],
      plots: [],
    }))
  }

  function toggleKind(kind: SessionKind) {
    setDraft((prev) => ({
      ...prev,
      types: prev.types.includes(kind)
        ? prev.types.filter((value) => value !== kind)
        : [...prev.types, kind],
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Búsqueda avanzada de sesiones
          </DialogTitle>
          <DialogDescription className="sr-only">
            Filtra las sesiones por rango de fechas, organización, productor, rancho, parcela y
            tipo. Los resultados se muestran en el explorador.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* ─ Fechas ─────────────────────────────────────────────────── */}
          <section className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Desde</span>
              <Input
                type="date"
                value={draft.from}
                onChange={(event) => setDraft((prev) => ({ ...prev, from: event.target.value }))}
                className="h-8 w-40 text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Hasta</span>
              <Input
                type="date"
                value={draft.to}
                onChange={(event) => setDraft((prev) => ({ ...prev, to: event.target.value }))}
                className="h-8 w-40 text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Tipo de fecha</span>
              <select
                value={draft.dateMode}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, dateMode: event.target.value as DateMode }))
                }
                className="h-8 rounded-md border bg-background px-2 text-xs"
              >
                {(Object.keys(DATE_MODE_LABELS) as DateMode[]).map((mode) => (
                  <option key={mode} value={mode}>
                    {DATE_MODE_LABELS[mode]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-xs font-medium">Organización</span>
              <select
                value={draft.org ?? ''}
                onChange={(event) => setOrg(event.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-xs"
              >
                <option value="">Todas las visibles</option>
                {(orgs.data ?? []).map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          {/* ─ Cascada geográfica ─────────────────────────────────────── */}
          <section className="grid gap-4 sm:grid-cols-3">
            <MultiSelectSearch
              label="Productor"
              placeholder="Ej. Crampie"
              options={producers.data ?? []}
              selected={draft.producers}
              onChange={setProducers}
              search={producerSearch}
              onSearchChange={setProducerSearch}
              isLoading={producers.isLoading}
            />
            <MultiSelectSearch
              label="Rancho"
              placeholder="Ej. La tij"
              options={ranches.data ?? []}
              selected={draft.ranches}
              onChange={setRanches}
              search={ranchSearch}
              onSearchChange={setRanchSearch}
              isLoading={ranches.isLoading}
            />
            <MultiSelectSearch
              label="Parcela"
              placeholder="Ej. P-00"
              options={plots.data ?? []}
              selected={draft.plots}
              onChange={(ids) => setDraft((prev) => ({ ...prev, plots: ids }))}
              search={plotSearch}
              onSearchChange={setPlotSearch}
              isLoading={plots.isLoading}
              disabledHint={
                draft.ranches.length === 0
                  ? 'Elige al menos un rancho para listar sus parcelas. Sin selección se incluyen todas.'
                  : undefined
              }
            />
          </section>

          {/* ─ Tipos ──────────────────────────────────────────────────── */}
          <section className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Tipo de sesión</span>
            <div className="flex flex-wrap gap-3">
              {SESSION_KINDS.map((kind) => (
                <label key={kind} className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.types.includes(kind)}
                    onChange={() => toggleKind(kind)}
                    className="h-3.5 w-3.5"
                  />
                  {SESSION_KIND_LABELS[kind]}
                </label>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Sin selección se incluyen los cuatro tipos.
            </p>
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => onApply(draft)}>
            Aplicar filtro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
