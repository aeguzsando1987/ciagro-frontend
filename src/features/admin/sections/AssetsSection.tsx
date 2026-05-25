import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { useRanches } from '../hooks/useRanches'
import { useProducers } from '../hooks/useProducers'
import { RanchFormDialog } from '../components/RanchFormDialog'
import { RanchPanel } from '../panel/RanchPanel'
import { AssignCombobox } from '../components/AssignCombobox'
import type { RanchFlat } from '../types'

/** Sección Activos Agrícolas del panel /admin — caso de uso §7.
 *  Lista ranchos con filtro por productor y abre el RanchPanel para detalle/edición. */
export function AssetsSection() {
  const user = useAuthStore((s) => s.user)
  const roleLevel = user?.role_level ?? 0
  const canCreate = roleLevel >= ROLE_LEVELS.MANAGER
  const [producerFilter, setProducerFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedRanch, setSelectedRanch] = useState<RanchFlat | null>(null)

  const { data: ranches = [], isLoading, error } = useRanches(producerFilter || null)
  const { data: producers = [] } = useProducers()

  const producerItems = producers.map((p) => ({
    id: p.id,
    label: p.commercial_name,
    sublabel: p.code,
  }))

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Activos agrícolas</h1>
        <p className="text-sm text-muted-foreground">
          Ranchos y parcelas georreferenciadas con cálculo automático de área y centroide.
        </p>
      </header>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-72">
          <AssignCombobox
            items={producerItems}
            placeholder="Filtrar por productor…"
            value={producerFilter}
            onChange={(id) => setProducerFilter(id)}
          />
        </div>
        {producerFilter && (
          <Button variant="ghost" size="sm" onClick={() => setProducerFilter('')}>
            Limpiar filtro
          </Button>
        )}
        {canCreate && (
          <div className="ml-auto">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              + Nuevo rancho
            </Button>
          </div>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Cargando ranchos…</p>}
      {error && <p className="text-destructive text-sm">Error al cargar los ranchos.</p>}

      {!isLoading && !error && ranches.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {producerFilter ? 'No hay ranchos para este productor.' : 'No hay ranchos registrados todavía.'}
        </p>
      )}

      {ranches.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Código</th>
                <th className="px-4 py-2 text-left font-medium">Nombre</th>
                <th className="px-4 py-2 text-left font-medium">Productor</th>
                <th className="px-4 py-2 text-left font-medium">Ciudad</th>
                <th className="px-4 py-2 text-left font-medium">Área</th>
                <th className="px-4 py-2 text-left font-medium">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ranches.map((ranch) => (
                <tr
                  key={ranch.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedRanch(ranch)}
                >
                  <td className="px-4 py-2 font-medium">{ranch.code}</td>
                  <td className="px-4 py-2">{ranch.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {producers.find((p) => p.id === ranch.producer)?.commercial_name ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{ranch.city || '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {ranch.total_area ? `${ranch.total_area} ${ranch.area_uom ?? 'ha'}` : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="text-xs">{ranch.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RanchFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {selectedRanch && (
        <RanchPanel
          ranch={selectedRanch}
          onClose={() => setSelectedRanch(null)}
        />
      )}
    </div>
  )
}
