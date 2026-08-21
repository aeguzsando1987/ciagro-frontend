import { useMemo } from 'react'
import { createRoute, useParams } from '@tanstack/react-router'
import { z } from 'zod'

import { workspaceDcRoute } from './w.$dc'
import { GeodataVisorShell } from '@/features/geodata-visor/components/GeodataVisorShell'
import { useDataCentralDetail } from '@/features/admin/hooks/useDataCentrals'
import type { VisorSelection } from '@/features/geodata-visor/types'

/**
 * Mismo contrato de búsqueda avanzada que `/visor-datos`.
 *
 * Se repite el esquema en vez de importarlo porque cada ruta declara el suyo y
 * TanStack lo usa para tipar `useSearch`; `.catch(undefined)` hace que un enlace viejo
 * o manipulado descarte el valor inválido en lugar de reventar la ruta.
 */
const visorSearchSchema = z.object({
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  dateMode: z.enum(['planned', 'actual']).optional().catch(undefined),
  org: z.string().optional().catch(undefined),
  producers: z.string().optional().catch(undefined),
  ranches: z.string().optional().catch(undefined),
  plots: z.string().optional().catch(undefined),
  types: z.string().optional().catch(undefined),
})

/**
 * Ruta `/w/$dc/visor` — el Visor como pantalla principal de una CIAgro.
 *
 * A diferencia de `/visor-datos`, que arranca en el nivel Organización y sirve para
 * recorrer varias CIAgros, aquí ya se sabe en cuál se entró: el panel derecho abre
 * directamente en el nivel de esa CIAgro. Volver a ese panel después de explorar es
 * seleccionar la CIAgro en el árbol, que es el mismo estado.
 *
 * La CIAgro viaja en la URL como parámetro de ruta, así que un refresh o un enlace
 * compartido reabren donde toca; el guard de acceso lo hereda de `/w/$dc`.
 */
export const workspaceVisorRoute = createRoute({
  getParentRoute: () => workspaceDcRoute,
  path: '/visor',
  validateSearch: visorSearchSchema,
  component: WorkspaceVisorPage,
})

function WorkspaceVisorPage() {
  const { dc } = useParams({ from: '/_authenticated/w/$dc/visor' })
  const { data } = useDataCentralDetail(dc)

  // El árbol cuelga de Organización -> CIAgro, así que la selección necesita las dos.
  // Mientras la petición está en vuelo se pasa `null` y el visor se comporta como
  // siempre; el shell aplica la selección en cuanto llega.
  const seleccionInicial = useMemo<VisorSelection | null>(() => {
    if (!data?.data_central_main) return null
    return {
      level: 'datacentral',
      org: { id: data.data_central_main.id, name: data.data_central_main.name },
      datacentral: { id: data.id, name: data.name },
    }
  }, [data])

  return <GeodataVisorShell initialSelection={seleccionInicial} />
}
