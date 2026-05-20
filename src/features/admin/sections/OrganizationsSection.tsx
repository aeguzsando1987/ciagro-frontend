import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { useDataCentralMains } from '../hooks/useDataCentrals'
import { CreateDataCentralMainDialog } from '../dialogs/CreateDataCentralMainDialog'
import { DataCentralMainPanel } from '../panel/DataCentralMainPanel'
import { DataCentralPanel } from '../panel/DataCentralPanel'
import type { DataCentralMainDetail, DataCentralDetail } from '../types'

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo', inactive: 'Inactivo', trial: 'Trial',
}

/** Sección Organizaciones del panel /admin — casos de uso §1, §3. */
export function OrganizationsSection() {
  const user = useAuthStore((s) => s.user)
  const roleLevel = user?.role_level ?? ROLE_LEVELS.GUEST
  const canCreate = roleLevel >= ROLE_LEVELS.SUPER_ADMIN

  const { data: orgs = [], isLoading, error } = useDataCentralMains()

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedDCM, setSelectedDCM] = useState<DataCentralMainDetail | null>(null)
  const [selectedDC, setSelectedDC] = useState<DataCentralDetail | null>(null)

  function handleDCClose() {
    const parentId = selectedDC
      ? (selectedDC.data_central_main as { id: string }).id
      : null
    const parentOrg = parentId ? orgs.find((o) => o.id === parentId) ?? null : null
    setSelectedDC(null)
    setSelectedDCM(parentOrg)
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Organizaciones</h1>
          <p className="text-sm text-muted-foreground">
            Organizaciones raíz y sus CIAs hijas.
          </p>
        </div>
        {canCreate && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>+ Nueva Organización</Button>
        )}
      </header>

      {isLoading && <p className="text-muted-foreground">Cargando organizaciones…</p>}
      {error && <p className="text-destructive">Error al cargar las organizaciones.</p>}
      {!isLoading && !error && orgs.length === 0 && (
        <p className="text-muted-foreground">No hay organizaciones registradas todavía.</p>
      )}
      {orgs.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nombre</th>
                <th className="px-4 py-2 text-left font-medium">Owner</th>
                <th className="px-4 py-2 text-left font-medium">Estatus</th>
                <th className="px-4 py-2 text-left font-medium">CIAs</th>
                <th className="px-4 py-2 text-left font-medium">Creada</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orgs.map((org) => (
                <tr
                  key={org.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedDCM(org)}
                >
                  <td className="px-4 py-2 font-medium">{org.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{org.owner_username ?? '—'}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline">
                      {STATUS_LABELS[org.status ?? ''] ?? org.status ?? '—'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">{org.datacentrals_count ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {org.created_at ? new Date(org.created_at).toLocaleDateString('es-MX') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

      {selectedDC && (
        <DataCentralPanel
          dc={selectedDC}
          onClose={handleDCClose}
        />
      )}
    </div>
  )
}
