import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataToolbar } from '@/components/ui/data-toolbar'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { PageHeader } from '@/components/ui/page-header'
import { TableSkeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useDataCentralMains } from '../hooks/useDataCentrals'
import { CreateDataCentralMainDialog } from '../dialogs/CreateDataCentralMainDialog'
import { DataCentralMainPanel } from '../panel/DataCentralMainPanel'
import { DataCentralPanel } from '../panel/DataCentralPanel'
import type { DataCentralMainDetail, DataCentralDetail } from '../types'

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  trial: 'Prueba',
}

function statusVariant(status?: string | null) {
  if (status === 'active') return 'success' as const
  if (status === 'trial') return 'warning' as const
  return 'secondary' as const
}

/** Sección Organizaciones del panel /admin — casos de uso §1, §3. */
export function OrganizationsSection() {
  const user = useAuthStore((state) => state.user)
  const roleLevel = user?.role_level ?? ROLE_LEVELS.GUEST
  const isSuperAdmin = roleLevel >= ROLE_LEVELS.SUPER_ADMIN
  const { data: rawOrgs = [], isLoading, error, refetch } = useDataCentralMains(true)
  const orgs = isSuperAdmin
    ? rawOrgs
    : rawOrgs.filter((organization) => organization.owner_username === user?.username)

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedDCM, setSelectedDCM] = useState<DataCentralMainDetail | null>(null)
  const [selectedDC, setSelectedDC] = useState<DataCentralDetail | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filteredOrgs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es-MX')
    return orgs.filter((organization) => {
      const matchesSearch =
        !query ||
        `${organization.name} ${organization.owner_username ?? ''}`
          .toLocaleLowerCase('es-MX')
          .includes(query)
      const matchesStatus = statusFilter === 'all' || organization.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [orgs, search, statusFilter])

  function handleDCClose() {
    const parentId = selectedDC ? (selectedDC.data_central_main as { id: string }).id : null
    const parentOrg = parentId ? (orgs.find((org) => org.id === parentId) ?? null) : null
    setSelectedDC(null)
    setSelectedDCM(parentOrg)
  }

  const hasFilters = Boolean(search || statusFilter !== 'all')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizaciones"
        description="Organizaciones raíz y sus CIAgros asociadas."
        actions={
          isSuperAdmin ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Nueva organización
            </Button>
          ) : undefined
        }
      />

      <DataToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar organización…"
        searchLabel="Buscar organizaciones"
        resultCount={filteredOrgs.length}
        resultLabel={filteredOrgs.length === 1 ? 'organización' : 'organizaciones'}
        hasActiveFilters={hasFilters}
        onClearFilters={() => {
          setSearch('')
          setStatusFilter('all')
        }}
        filters={
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44" aria-label="Filtrar por estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Activas</SelectItem>
              <SelectItem value="trial">En prueba</SelectItem>
              <SelectItem value="inactive">Inactivas</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {isLoading && <TableSkeleton columns={5} label="Cargando organizaciones…" />}
      {error && (
        <ErrorState
          title="No pudimos cargar las organizaciones"
          description="Revisa tu conexión e inténtalo nuevamente."
          onRetry={() => void refetch()}
        />
      )}
      {!isLoading && !error && filteredOrgs.length === 0 && (
        <EmptyState
          title={
            hasFilters
              ? 'No encontramos organizaciones'
              : 'No hay organizaciones registradas todavía'
          }
          description={
            hasFilters ? 'Ajusta o limpia los filtros para ver más resultados.' : undefined
          }
        />
      )}

      {filteredOrgs.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Propietario</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>CIAgros</TableHead>
              <TableHead>Creada</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrgs.map((organization) => (
              <TableRow
                key={organization.id}
                className="cursor-pointer"
                onClick={() => setSelectedDCM(organization)}
              >
                <TableCell className="font-medium">{organization.name}</TableCell>
                <TableCell className="text-secondary">
                  {organization.owner_username ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(organization.status)}>
                    {STATUS_LABELS[organization.status ?? ''] ?? organization.status ?? '—'}
                  </Badge>
                </TableCell>
                <TableCell>{organization.datacentrals_count ?? '—'}</TableCell>
                <TableCell className="text-secondary">
                  {organization.created_at
                    ? new Date(organization.created_at).toLocaleDateString('es-MX')
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateDataCentralMainDialog open={createOpen} onOpenChange={setCreateOpen} />
      {selectedDCM && (
        <DataCentralMainPanel
          dcm={selectedDCM}
          onClose={() => setSelectedDCM(null)}
          onOpenDC={(dc) => {
            setSelectedDCM(null)
            setSelectedDC(dc)
          }}
        />
      )}
      {selectedDC && <DataCentralPanel dc={selectedDC} onClose={handleDCClose} />}
    </div>
  )
}
