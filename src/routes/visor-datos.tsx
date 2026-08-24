import { createRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { authenticatedRoute } from './_authenticated'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { resolveEntryDecision } from '@/features/workspace/entryTarget'
import { ProductShell } from '@/features/layout/ProductShell'
import { GeodataVisorShell } from '@/features/geodata-visor/components/GeodataVisorShell'

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
 * Ruta `/visor-datos` — el Visor sin CIAgro fija, y el DESPACHADOR de arranque.
 *
 * Es donde aterriza el login. Antes se entraba por `/workspaces`, que obligaba a elegir
 * una CIAgro antes de ver nada; desde que el explorador colapsa su raíz según el
 * alcance del usuario, esa elección pedía algo que el árbol iba a mostrar igual.
 *
 * El `beforeLoad` concentra toda la decisión de entrada, y va aquí y no en el
 * componente porque `_authenticated.beforeLoad` ya garantiza que el usuario está
 * poblado antes de los guards de las rutas hijas. Resolverlo antes de montar evita
 * pintar una pantalla para acto seguido navegar a otra.
 *
 * Se conserva este path en vez de estrenar uno porque las búsquedas avanzadas
 * compartidas viven en sus parámetros: los enlaces ya repartidos siguen funcionando.
 */
export const visorDatosRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/visor-datos',
  validateSearch: visorSearchSchema,
  beforeLoad: () => {
    // La decisión vive en `resolveEntryDecision` para poder probarla: un guard de
    // redirección pasa con facilidad sin llegar a ejercitarse, y aquí se decide a qué
    // pantalla entra todo el mundo.
    const decision = resolveEntryDecision(useAuthStore.getState().user?.datacentrals)

    if (decision.kind === 'sin-acceso') {
      // `/workspaces` decide entre el wizard de primer uso y la pantalla de sin acceso.
      throw redirect({ to: '/workspaces' })
    }
    if (decision.kind === 'unica') {
      throw redirect({ to: '/w/$dc/visor', params: { dc: decision.dcId } })
    }
    // 'elegir-en-el-arbol': se queda aquí y el explorador hace el resto.
  },
  component: VisorDatosPage,
})

/**
 * El Visor va dentro de `ProductShell` como el resto de la aplicación: sin él no
 * tendría cabecera y, con la navegación viviendo en la pestaña de la esquina, entrar
 * aquí dejaría al usuario sin ninguna forma de moverse.
 *
 * `mainClassName` a sangre completa por el mismo motivo que en `/w/$dc/visor`: es una
 * interfaz de mapa, no un documento, y el margen y el scroll del contenedor le sobran.
 */
function VisorDatosPage() {
  return (
    <ProductShell
      mainClassName="overflow-hidden p-0 pb-0 sm:p-0 lg:p-0"
    >
      <GeodataVisorShell />
    </ProductShell>
  )
}
