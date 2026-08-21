import { createRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { authenticatedRoute } from './_authenticated'
import { useWorkspaceStore } from '@/features/workspace/useWorkspaceStore'

/**
 * Search params de la búsqueda avanzada del explorador (fase AS).
 *
 * Viven en la URL para que una búsqueda sea compartible y sobreviva al refresh, con el
 * mismo patrón que el Gantt (`w.$dc.task-manager.tsx`). Las listas viajan como CSV de
 * UUIDs; `advancedSearch.ts` hace la conversión a arrays.
 *
 * `.catch(undefined)` en cada clave: un enlace viejo o manipulado descarta el valor
 * inválido en vez de reventar la ruta. Los ids que ya no existan tampoco molestan,
 * porque el backend simplemente no los empata.
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
 * Ruta /visor-datos — CONSERVADA SOLO COMO REDIRECCIÓN.
 *
 * Nació como sección independiente fuera de /w/$dc, con el explorador arrancando en
 * el nivel Organización. Al pasar el Visor a ser la pantalla principal de una CIAgro
 * quedaron dos entradas para la MISMA pantalla: el árbol lista todas las
 * organizaciones que el usuario alcanza en las dos rutas, así que lo único que
 * cambiaba era con qué abría el panel derecho.
 *
 * Ya no valida rol propio: el destino, /w/$dc/visor, hereda el guard de acceso a la
 * CIAgro de /w/$dc, que es el que de verdad importa. El Visor está abierto a todos
 * los roles y el alcance por parcela limita lo que cada uno ve dentro.
 */
export const visorDatosRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/visor-datos',
  validateSearch: visorSearchSchema,
  beforeLoad: () => {
    // Redirige al Visor de la CIAgro activa: eran la MISMA pantalla. El arbol del
    // explorador siempre arranca listando todas las organizaciones que el usuario
    // alcanza, sin importar la ruta, asi que lo unico que cambiaba era con que abria
    // el panel derecho. Mantener dos entradas para lo mismo confundia mas que ayudaba.
    //
    // La ruta se conserva redirigiendo para no romper enlaces guardados ni las
    // busquedas avanzadas compartidas, que viven en los parametros de la URL.
    const dc = useWorkspaceStore.getState().selectedDc?.id
    throw redirect(
      dc
        ? { to: '/w/$dc/visor', params: { dc } }
        : { to: '/workspaces' }
    )
  },
})


