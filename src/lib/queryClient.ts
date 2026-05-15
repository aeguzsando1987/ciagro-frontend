import { QueryClient } from '@tanstack/react-query'

/**
 * Instancia única de QueryClient exportada como módulo.
 * Permite invalidar / resetear queries desde hooks y utilidades
 * que no tienen acceso al contexto de React (ej: useChangePassword,
 * interceptor de refresh en Tarea 1.16).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
})
