import { useNavigate, useParams, useSearch } from '@tanstack/react-router'
import type { ProgramaStatus } from '@/features/task-manager/types'

/** Opciones de status renderizadas en el dropdown. Todas las del enum del backend. */
const STATUS_OPTIONS: { value: ProgramaStatus; label: string }[] = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'loaded', label: 'Cargado' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
]

interface AgroUnitOption {
  id: string
  name: string
}

interface FilterBarProps {
  /**
   * Opciones de productor para el filtro agro_unit. En Sprint 2.A no tenemos
   * el catalogo cargado todavia (eso lo trae useAgroUnits en Sprint 2.B),
   * asi que el filtro de productor se renderiza solo si el caller pasa opciones.
   */
  agroUnits?: AgroUnitOption[]
}

/**
 * FilterBar (Tarea 2.5).
 *
 * Lee y escribe los search params `status` y `agro_unit` de la ruta
 * /w/$dc/task-manager. Al cambiar el valor:
 * - useNavigate({ search }) actualiza la URL.
 * - validateSearch (zod) en la ruta valida el nuevo valor.
 * - loaderDeps detecta el cambio y refetcha la lista de Programas Maestros.
 * - useMasterPrograms en el componente recibe la nueva data via cache.
 *
 * Trade-off: usamos <select> HTML nativo en lugar de shadcn/Select para
 * Sprint 2.A (no instalamos primitivos shadcn hasta 2.B segun decision del usuario).
 * El cambio a shadcn/Select es trivial mas adelante.
 */
export function FilterBar({ agroUnits }: FilterBarProps) {
  const navigate = useNavigate()
  const search = useSearch({ from: '/_authenticated/w/$dc/task-manager' })
  const { dc } = useParams({ from: '/_authenticated/w/$dc/task-manager' })

  function updateSearch(patch: { status?: ProgramaStatus | undefined; agro_unit?: string | undefined }) {
    void navigate({
      to: '/w/$dc/task-manager',
      params: { dc },
      search: (prev) => ({
        ...prev,
        ...patch,
      }),
    })
  }

  const hasFilters = !!search.status || !!search.agro_unit

  return (
    <div className="flex flex-wrap items-end gap-3 rounded border bg-card p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-status" className="text-xs text-muted-foreground">
          Estado
        </label>
        <select
          id="filter-status"
          className="h-9 rounded border border-input bg-background px-2 text-sm"
          value={search.status ?? ''}
          onChange={(e) => {
            const v = e.target.value
            updateSearch({ status: v ? (v as ProgramaStatus) : undefined })
          }}
        >
          <option value="">Todos</option>
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {agroUnits && agroUnits.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-agro-unit" className="text-xs text-muted-foreground">
            Productor
          </label>
          <select
            id="filter-agro-unit"
            className="h-9 rounded border border-input bg-background px-2 text-sm"
            value={search.agro_unit ?? ''}
            onChange={(e) => {
              const v = e.target.value
              updateSearch({ agro_unit: v || undefined })
            }}
          >
            <option value="">Todos</option>
            {agroUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={() => updateSearch({ status: undefined, agro_unit: undefined })}
          className="h-9 rounded border border-input bg-background px-3 text-sm hover:bg-accent"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
