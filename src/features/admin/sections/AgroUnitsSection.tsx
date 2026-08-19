import { useMemo, useState } from 'react'
import { ArrowRight, Building2, LandPlot, MapPinned, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { useAgroUnits } from '../hooks/useAgroUnits'
import { useAgroSectors, useDeleteAgroSector } from '../hooks/useAgroSectors'
import { CreateAgroUnitDialog } from '../dialogs/CreateAgroUnitDialog'
import { CreateSectorDialog } from '../dialogs/CreateSectorDialog'
import { AgroUnitPanel } from '../panel/AgroUnitPanel'
import type { AgroUnit, AgroSector } from '../types'

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  suspended: 'Suspendido',
  pending: 'Pendiente',
}

function statusVariant(status?: string | null) {
  if (status === 'active') return 'success' as const
  if (status === 'pending') return 'warning' as const
  if (status === 'suspended') return 'danger' as const
  return 'secondary' as const
}

/** Sección Agrounidades del panel /admin — casos de uso §4, §5. */
export function AgroUnitsSection() {
  const user = useAuthStore((state) => state.user)
  const roleLevel = user?.role_level ?? ROLE_LEVELS.GUEST
  const canCreateUnit = roleLevel >= ROLE_LEVELS.SUPER_ADMIN
  const canCreateSector = roleLevel >= ROLE_LEVELS.SUPERVISOR
  const {
    data: units = [],
    isLoading: loadingUnits,
    error: unitsError,
    refetch: refetchUnits,
  } = useAgroUnits()
  const {
    data: sectors = [],
    isLoading: loadingSectors,
    error: sectorsError,
    refetch: refetchSectors,
  } = useAgroSectors()

  const [createUnitOpen, setCreateUnitOpen] = useState(false)
  const [createSectorOpen, setCreateSectorOpen] = useState(false)
  const [editSector, setEditSector] = useState<AgroSector | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<AgroUnit | null>(null)
  const [unitSearch, setUnitSearch] = useState('')
  const [unitStatus, setUnitStatus] = useState('all')
  const [sectorSearch, setSectorSearch] = useState('')
  const deleteSector = useDeleteAgroSector()

  const filteredUnits = useMemo(() => {
    const query = unitSearch.trim().toLocaleLowerCase('es-MX')
    return units.filter((unit) => {
      const sector = (unit.agro_sector as AgroSector | null)?.sector_name ?? ''
      const matchesSearch =
        !query ||
        `${unit.commercial_name} ${unit.code} ${unit.unit_type} ${sector}`
          .toLocaleLowerCase('es-MX')
          .includes(query)
      const matchesStatus = unitStatus === 'all' || unit.status === unitStatus
      return matchesSearch && matchesStatus
    })
  }, [units, unitSearch, unitStatus])

  const filteredSectors = useMemo(() => {
    const query = sectorSearch.trim().toLocaleLowerCase('es-MX')
    if (!query) return sectors
    return sectors.filter((sector) =>
      `${sector.sector_name} ${sector.scian_code ?? ''} ${sector.activity_name ?? ''}`
        .toLocaleLowerCase('es-MX')
        .includes(query)
    )
  }, [sectors, sectorSearch])

  async function handleDeleteSector(sector: AgroSector) {
    if (
      !confirm(`¿Eliminar el sector "${sector.sector_name}"? Esta acción no se puede deshacer.`)
    ) {
      return
    }
    try {
      await deleteSector.mutateAsync(sector.id)
      toast.success('Sector agrícola eliminado.')
    } catch {
      toast.error('No se pudo eliminar el sector. Puede estar en uso por una agrounidad.')
    }
  }

  const unitHasFilters = Boolean(unitSearch || unitStatus !== 'all')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agrounidades"
        description="Productores y unidades, sus contactos y la relación entre ranchos y parcelas."
      />

      <section
        aria-label="Jerarquía de activos agrícolas"
        className="flex flex-wrap items-center gap-3 rounded-xl border border-default bg-surface px-4 py-3"
      >
        <HierarchyLabel
          icon={<Building2 />}
          title="Productor / Unidad"
          detail="Entidad responsable"
        />
        <ArrowRight className="h-4 w-4 text-muted" />
        <HierarchyLabel icon={<MapPinned />} title="Rancho" detail="Ubicación productiva" />
        <ArrowRight className="h-4 w-4 text-muted" />
        <HierarchyLabel icon={<LandPlot />} title="Parcela" detail="Superficie georreferenciada" />
      </section>

      <Tabs defaultValue="units">
        <TabsList>
          <TabsTrigger value="units">Unidades</TabsTrigger>
          <TabsTrigger value="sectors">Sectores</TabsTrigger>
        </TabsList>

        <TabsContent value="units" className="space-y-4 pt-4">
          <DataToolbar
            searchValue={unitSearch}
            onSearchChange={setUnitSearch}
            searchPlaceholder="Buscar agrounidad…"
            searchLabel="Buscar agrounidades"
            resultCount={filteredUnits.length}
            resultLabel={filteredUnits.length === 1 ? 'unidad' : 'unidades'}
            hasActiveFilters={unitHasFilters}
            onClearFilters={() => {
              setUnitSearch('')
              setUnitStatus('all')
            }}
            filters={
              <Select value={unitStatus} onValueChange={setUnitStatus}>
                <SelectTrigger className="w-44" aria-label="Filtrar por estado">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="suspended">Suspendidas</SelectItem>
                  <SelectItem value="inactive">Inactivas</SelectItem>
                </SelectContent>
              </Select>
            }
            primaryAction={
              canCreateUnit ? (
                <Button onClick={() => setCreateUnitOpen(true)}>
                  <Plus />
                  Nueva unidad
                </Button>
              ) : undefined
            }
          />

          {loadingUnits && <TableSkeleton columns={5} label="Cargando unidades…" />}
          {unitsError && (
            <ErrorState
              title="No pudimos cargar las agrounidades"
              description="Revisa tu conexión e inténtalo nuevamente."
              onRetry={() => void refetchUnits()}
            />
          )}
          {!loadingUnits && !unitsError && filteredUnits.length === 0 && (
            <EmptyState
              title={
                unitHasFilters
                  ? 'No encontramos agrounidades'
                  : 'No hay agrounidades registradas todavía'
              }
              description={
                unitHasFilters ? 'Ajusta o limpia los filtros para ver más resultados.' : undefined
              }
            />
          )}
          {filteredUnits.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre comercial</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUnits.map((unit) => (
                  <TableRow
                    key={unit.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedUnit(unit)}
                  >
                    <TableCell className="font-medium">{unit.commercial_name}</TableCell>
                    <TableCell className="text-secondary">{unit.code}</TableCell>
                    <TableCell>{unit.unit_type}</TableCell>
                    <TableCell>
                      {(unit.agro_sector as AgroSector | null)?.sector_name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(unit.status)}>
                        {STATUS_LABELS[unit.status ?? ''] ?? unit.status ?? '—'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="sectors" className="space-y-4 pt-4">
          <DataToolbar
            searchValue={sectorSearch}
            onSearchChange={setSectorSearch}
            searchPlaceholder="Buscar sector…"
            searchLabel="Buscar sectores"
            resultCount={filteredSectors.length}
            resultLabel={filteredSectors.length === 1 ? 'sector' : 'sectores'}
            hasActiveFilters={Boolean(sectorSearch)}
            onClearFilters={() => setSectorSearch('')}
            primaryAction={
              canCreateSector ? (
                <Button onClick={() => setCreateSectorOpen(true)}>
                  <Plus />
                  Nuevo sector
                </Button>
              ) : undefined
            }
          />

          {loadingSectors && <TableSkeleton columns={4} label="Cargando sectores…" />}
          {sectorsError && (
            <ErrorState
              title="No pudimos cargar los sectores"
              description="Revisa tu conexión e inténtalo nuevamente."
              onRetry={() => void refetchSectors()}
            />
          )}
          {!loadingSectors && !sectorsError && filteredSectors.length === 0 && (
            <EmptyState
              title={
                sectorSearch ? 'No encontramos sectores' : 'No hay sectores registrados todavía'
              }
              description={
                sectorSearch ? 'Ajusta o limpia la búsqueda para ver más resultados.' : undefined
              }
            />
          )}
          {filteredSectors.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre del sector</TableHead>
                  <TableHead>Código SCIAN</TableHead>
                  <TableHead>Actividad principal</TableHead>
                  {canCreateSector && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSectors.map((sector) => (
                  <TableRow key={sector.id}>
                    <TableCell className="font-medium">{sector.sector_name}</TableCell>
                    <TableCell className="text-secondary">{sector.scian_code ?? '—'}</TableCell>
                    <TableCell>{sector.activity_name ?? '—'}</TableCell>
                    {canCreateSector && (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditSector(sector)}
                          >
                            <Pencil />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeleteSector(sector)}
                            disabled={deleteSector.isPending}
                          >
                            <Trash2 />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <CreateAgroUnitDialog open={createUnitOpen} onOpenChange={setCreateUnitOpen} />
      <CreateSectorDialog open={createSectorOpen} onOpenChange={setCreateSectorOpen} />
      <CreateSectorDialog
        open={editSector !== null}
        onOpenChange={(open) => !open && setEditSector(null)}
        sector={editSector}
      />
      {selectedUnit && <AgroUnitPanel unit={selectedUnit} onClose={() => setSelectedUnit(null)} />}
    </div>
  )
}

function HierarchyLabel({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode
  title: string
  detail: string
}) {
  return (
    <div className="flex min-w-48 items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-secondary">{detail}</span>
      </span>
    </div>
  )
}
