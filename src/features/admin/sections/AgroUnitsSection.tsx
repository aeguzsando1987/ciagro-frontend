import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

/** Sección Agrounidades del panel /admin — casos de uso §4, §5. */
export function AgroUnitsSection() {
  const user = useAuthStore((s) => s.user)
  const roleLevel = user?.role_level ?? ROLE_LEVELS.GUEST
  const canCreateUnit = roleLevel >= ROLE_LEVELS.SUPER_ADMIN
  const canCreateSector = roleLevel >= ROLE_LEVELS.SUPERVISOR

  const { data: units = [], isLoading: loadingUnits, error: unitsError } = useAgroUnits()
  const { data: sectors = [], isLoading: loadingSectors, error: sectorsError } = useAgroSectors()

  const [createUnitOpen, setCreateUnitOpen] = useState(false)
  const [createSectorOpen, setCreateSectorOpen] = useState(false)
  const [editSector, setEditSector] = useState<AgroSector | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<AgroUnit | null>(null)

  const deleteSector = useDeleteAgroSector()

  async function handleDeleteSector(sector: AgroSector) {
    if (!confirm(`¿Eliminar el sector "${sector.sector_name}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteSector.mutateAsync(sector.id)
      toast.success('Sector agrícola eliminado.')
    } catch {
      toast.error('No se pudo eliminar el sector. Puede estar en uso por una agrounidad.')
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Agrounidades</h1>
          <p className="text-sm text-muted-foreground">
            Unidades agroeconómicas, sectores agroindustriales y contactos.
          </p>
        </div>
      </header>

      <Tabs defaultValue="units">
        <TabsList>
          <TabsTrigger value="units">Unidades</TabsTrigger>
          <TabsTrigger value="sectors">Sectores</TabsTrigger>
        </TabsList>

        {/* ── Tab Unidades ── */}
        <TabsContent value="units" className="space-y-3 pt-3">
          {canCreateUnit && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreateUnitOpen(true)}>
                + Nueva Unidad
              </Button>
            </div>
          )}
          {loadingUnits && <p className="text-muted-foreground">Cargando unidades…</p>}
          {unitsError && <p className="text-destructive">Error al cargar las unidades.</p>}
          {!loadingUnits && !unitsError && units.length === 0 && (
            <p className="text-muted-foreground">No hay agrounidades registradas todavía.</p>
          )}
          {units.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Nombre comercial</th>
                    <th className="px-4 py-2 text-left font-medium">Código</th>
                    <th className="px-4 py-2 text-left font-medium">Tipo</th>
                    <th className="px-4 py-2 text-left font-medium">Sector</th>
                    <th className="px-4 py-2 text-left font-medium">Estatus</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {units.map((unit) => (
                    <tr
                      key={unit.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setSelectedUnit(unit)}
                    >
                      <td className="px-4 py-2 font-medium">{unit.commercial_name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{unit.code}</td>
                      <td className="px-4 py-2">{unit.unit_type}</td>
                      <td className="px-4 py-2">
                        {(unit.agro_sector as AgroSector | null)?.sector_name ?? '—'}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">
                          {STATUS_LABELS[unit.status ?? ''] ?? unit.status ?? '—'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Tab Sectores ── */}
        <TabsContent value="sectors" className="space-y-3 pt-3">
          {canCreateSector && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreateSectorOpen(true)}>
                + Nuevo Sector
              </Button>
            </div>
          )}
          {loadingSectors && <p className="text-muted-foreground">Cargando sectores…</p>}
          {sectorsError && <p className="text-destructive">Error al cargar los sectores.</p>}
          {!loadingSectors && !sectorsError && sectors.length === 0 && (
            <p className="text-muted-foreground">No hay sectores registrados todavía.</p>
          )}
          {sectors.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Nombre del sector</th>
                    <th className="px-4 py-2 text-left font-medium">Código SCIAN</th>
                    <th className="px-4 py-2 text-left font-medium">Actividad principal</th>
                    {canCreateSector && (
                      <th className="px-4 py-2 text-right font-medium">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sectors.map((sector) => (
                    <tr key={sector.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 font-medium">{sector.sector_name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{sector.scian_code ?? '—'}</td>
                      <td className="px-4 py-2">{sector.activity_name ?? '—'}</td>
                      {canCreateSector && (
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setEditSector(sector)}>
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteSector(sector)}
                              disabled={deleteSector.isPending}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
      {selectedUnit && (
        <AgroUnitPanel unit={selectedUnit} onClose={() => setSelectedUnit(null)} />
      )}
    </div>
  )
}
