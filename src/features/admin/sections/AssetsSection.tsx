import { useMemo, useState } from 'react'
import { Eye, MoreHorizontal, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataToolbar } from '@/components/ui/data-toolbar'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { PageHeader } from '@/components/ui/page-header'
import { IconButton } from '@/components/ui/icon-button'
import { TableSkeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { useRanches } from '../hooks/useRanches'
import { useProducers } from '../hooks/useProducers'
import { RanchFormDialog } from '../components/RanchFormDialog'
import { RanchPanel } from '../panel/RanchPanel'
import { AssignCombobox } from '../components/AssignCombobox'
import type { RanchFlat } from '../types'

function statusVariant(status?: string | null) {
  if (status === 'active') return 'success' as const
  if (status === 'pending') return 'warning' as const
  if (status === 'inactive') return 'secondary' as const
  return 'outline' as const
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  pending: 'Pendiente',
  inactive: 'Inactivo',
  closed: 'Cerrado',
}

function formatArea(value: number | string | null | undefined) {
  if (value == null || value === '') return '—'
  const area = Number(value)
  if (!Number.isFinite(area)) return '—'
  return `${area.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ha`
}

/** Lista de ranchos con filtros y acceso al detalle/edición. */
export function AssetsSection() {
  const user = useAuthStore((state) => state.user)
  const roleLevel = user?.role_level ?? 0
  const canCreate = roleLevel >= ROLE_LEVELS.MANAGER
  const [producerFilter, setProducerFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedRanch, setSelectedRanch] = useState<RanchFlat | null>(null)

  const { data: ranches = [], isLoading, error, refetch } = useRanches(producerFilter || null)
  const { data: producers = [] } = useProducers()
  const producerItems = producers.map((producer) => ({
    id: producer.id,
    label: producer.commercial_name,
    sublabel: producer.code,
  }))

  const filteredRanches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-MX')
    return ranches.filter((ranch) => {
      const producerName =
        producers.find((producer) => producer.id === ranch.producer)?.commercial_name ?? ''
      const matchesSearch =
        !query ||
        `${ranch.code} ${ranch.name} ${producerName} ${ranch.city ?? ''}`
          .toLocaleLowerCase('es-MX')
          .includes(query)
      const matchesStatus = statusFilter === 'all' || ranch.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [ranches, producers, search, statusFilter])

  const hasFilters = Boolean(search || producerFilter || statusFilter !== 'all')

  return (
    <div className="space-y-6">
      <PageHeader title="Activos agrícolas" description="Ranchos y parcelas georreferenciadas." />

      <DataToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar rancho…"
        searchLabel="Buscar ranchos"
        resultCount={filteredRanches.length}
        resultLabel={filteredRanches.length === 1 ? 'rancho' : 'ranchos'}
        hasActiveFilters={hasFilters}
        onClearFilters={() => {
          setSearch('')
          setProducerFilter('')
          setStatusFilter('all')
        }}
        filters={
          <>
            <div className="w-56">
              <AssignCombobox
                items={producerItems}
                placeholder="Productor"
                value={producerFilter}
                onChange={setProducerFilter}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40" aria-label="Filtrar por estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        primaryAction={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Nuevo rancho
            </Button>
          ) : undefined
        }
      />

      {isLoading && <TableSkeleton columns={7} label="Cargando ranchos…" />}
      {error && (
        <ErrorState
          title="No pudimos cargar los ranchos"
          description="Revisa tu conexión e inténtalo nuevamente."
          onRetry={() => void refetch()}
        />
      )}
      {!isLoading && !error && filteredRanches.length === 0 && (
        <EmptyState
          title={hasFilters ? 'No encontramos ranchos' : 'No hay ranchos registrados todavía'}
          description={
            hasFilters ? 'Ajusta o limpia los filtros para ver más resultados.' : undefined
          }
        />
      )}

      {filteredRanches.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Productor</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-20 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRanches.map((ranch) => (
              <TableRow
                key={ranch.id}
                className="cursor-pointer"
                onClick={() => setSelectedRanch(ranch)}
              >
                <TableCell className="font-medium">{ranch.code}</TableCell>
                <TableCell>{ranch.name}</TableCell>
                <TableCell className="text-secondary">
                  {producers.find((producer) => producer.id === ranch.producer)?.commercial_name ??
                    '—'}
                </TableCell>
                <TableCell className="text-secondary">{ranch.city || '—'}</TableCell>
                <TableCell className="text-secondary">{formatArea(ranch.total_area)}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(ranch.status)}>
                    {STATUS_LABELS[ranch.status ?? ''] ?? ranch.status ?? '—'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton
                        label={`Acciones de ${ranch.name}`}
                        variant="ghost"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal />
                      </IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setSelectedRanch(ranch)}>
                        <Eye />
                        Ver detalle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <RanchFormDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {selectedRanch && <RanchPanel ranch={selectedRanch} onClose={() => setSelectedRanch(null)} />}
    </div>
  )
}
