import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { RouterProvider } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/toast'
import { TooltipProvider } from '@/components/ui/tooltip'
import { router } from './router'
import { queryClient } from './lib/queryClient'

/**
 * Root de la aplicación. Monta providers transversales + RouterProvider.
 * queryClient vive en src/lib/queryClient.ts para ser accesible fuera de React.
 */

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={350}>
        <RouterProvider router={router} />
        <Toaster />
      </TooltipProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
