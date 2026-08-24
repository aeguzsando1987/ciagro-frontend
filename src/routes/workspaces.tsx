import { createRoute, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import { authenticatedRoute } from './_authenticated'
import { WorkspaceSelector } from '@/features/workspace/WorkspaceSelector'
import { ProductShell } from '@/features/layout/ProductShell'

/**
 * `?next` — a dónde llevar tras elegir la CIAgro.
 *
 * Existe porque el selector dejó de ser la entrada del sistema: ahora solo aparece en
 * el camino del Task Manager, cuyos datos sí son de una CIAgro concreta. Sin destino,
 * lleva al Visor.
 */
const workspacesSearchSchema = z.object({
  next: z.enum(['task-manager']).optional().catch(undefined),
})

/**
 * Ruta protegida `/workspaces` — selector de CIAgro (Pasos 1.3-1.6 product-doc).
 *
 * Ya NO es la pantalla de entrada: el login va directo al Visor. Se conserva para el
 * wizard de primer uso, la pantalla de sin acceso, "Cambiar organización" del menú del
 * avatar y la elección de CIAgro previa al Task Manager.
 */
export const workspacesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/workspaces',
  validateSearch: workspacesSearchSchema,
  component: WorkspacesPage,
})

function WorkspacesPage() {
  // Sin etiqueta de contexto en la cabecera: aqui NO hay CIAgro activa que anunciar, y
  // el indicador lleva icono de edificio, asi que sugeriria lo contrario. El propio
  // selector ya trae su titulo.
  const { next } = useSearch({ from: '/_authenticated/workspaces' })
  return (
    <ProductShell>
      <div className="mx-auto w-full max-w-6xl py-3 sm:py-5">
        <WorkspaceSelector next={next} />
      </div>
    </ProductShell>
  )
}
