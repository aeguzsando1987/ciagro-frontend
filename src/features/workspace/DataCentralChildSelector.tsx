import { useNavigate } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { useWorkspaceStore } from './useWorkspaceStore'
import type { DataCentral } from '@/types/workspace'
import type { WorkspaceDataCentral } from '@/types/auth'

interface Props {
  /** Lista de hijas — acepta DataCentral (fetch completo) o WorkspaceDataCentral (de /me/) */
  datacentrals: Array<DataCentral | WorkspaceDataCentral>
  title?: string
}

/**
 * Selector de CIAgro Hija. Muestra cards con nombre y badge "Dueno" si is_owner.
 * Al hacer clic navega a /w/<id>/dashboard (Paso 1.6 product-doc).
 */
export function DataCentralChildSelector({ datacentrals, title = 'Selecciona un workspace' }: Props) {
  const navigate = useNavigate()
  const setSelectedDc = useWorkspaceStore((s) => s.setSelectedDc)

  return (
    <div className="w-full max-w-md space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="space-y-2">
        {datacentrals.map((dc) => (
          <Card
            key={dc.id}
            className="cursor-pointer transition-colors hover:bg-accent"
            onClick={() => {
              setSelectedDc({ id: dc.id, name: dc.name })
              void navigate({ to: '/w/$dc/dashboard', params: { dc: dc.id } })
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base font-medium">{dc.name}</CardTitle>
              {dc.is_owner && <Badge variant="secondary">Dueno</Badge>}
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
