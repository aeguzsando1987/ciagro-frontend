import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

/**
 * Ruta raíz del árbol TanStack Router.
 * Providers (QueryClient, Toaster) viven en App.tsx — aquí solo el shell.
 */
export const rootRoute = createRootRoute({
    component: RootComponent,
})

function RootComponent() {
    return (
        <>
            <Outlet />
            {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
        </>
    )
}
