import { useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDataCentralsMain } from './useDataCentralsMain'
import { useDataCentrals } from './useDataCentrals'
import { DataCentralChildSelector } from './DataCentralChildSelector'
import type { DataCentralMain } from '@/types/workspace'

/**
 * Selector jerarquico para Gerente/SuperAdmin (role_level >= 4).
 * Paso 1: muestra lista de CIAgros Padre.
 * Paso 2: al seleccionar una Padre, carga y muestra sus hijas.
 * (Paso 1.4 product-doc)
 */
export function DataCentralMainSelector() {
  const [selectedMain, setSelectedMain] = useState<DataCentralMain | null>(null)
  const { data: mains = [], isLoading: loadingMains } = useDataCentralsMain()
  const { data: children = [], isLoading: loadingChildren } = useDataCentrals(selectedMain?.id)

  if (loadingMains) {
    return <p className="text-muted-foreground">Cargando organizaciones...</p>
  }

  if (selectedMain) {
    if (loadingChildren) {
      return <p className="text-muted-foreground">Cargando workspaces...</p>
    }
    return (
      <div className="space-y-4">
        <button
          className="text-sm text-muted-foreground hover:underline"
          onClick={() => setSelectedMain(null)}
        >
          &larr; Volver a organizaciones
        </button>
        <DataCentralChildSelector
          datacentrals={children}
          title={`Workspaces de ${selectedMain.name}`}
        />
      </div>
    )
  }

  return (
    <div className="w-full max-w-md space-y-4">
      <h2 className="text-xl font-semibold">Selecciona una organizacion</h2>
      <div className="space-y-2">
        {mains.map((main) => (
          <Card
            key={main.id}
            className="cursor-pointer transition-colors hover:bg-accent"
            onClick={() => setSelectedMain(main)}
          >
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base font-medium">{main.name}</CardTitle>
              {main.is_owner && <Badge variant="secondary">Dueno</Badge>}
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
