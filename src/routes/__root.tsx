import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'

const CURRENT_YEAR = new Date().getFullYear()

export const rootRoute = createRootRoute({
    component: RootComponent,
})

function RootComponent() {
    return (
        <>
            <Outlet />
            <footer
                style={{ backgroundColor: '#290629' }}
                className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-1.5 text-[11px] text-white/80"
            >
                <span>CIAgro: Central de Inteligencia Agrícola ®</span>
                <span>Tierra Inteligente ®. Todos los derechos reservados {CURRENT_YEAR}</span>
            </footer>
            {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
        </>
    )
}
