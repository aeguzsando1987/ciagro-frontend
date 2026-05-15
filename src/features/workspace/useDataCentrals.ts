import { useQuery } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'
import type { DataCentral } from '@/types/workspace'

// GET /api/v1/organizations/datacentrals/?data_central_main=<uuid> — respuesta paginada {count, results}
async function fetchDataCentrals(mainId?: string): Promise<DataCentral[]> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL
  const params = mainId ? `?data_central_main=${mainId}` : ''
  const res = await fetch(`${baseUrl}/organizations/datacentrals/${params}`, {
    headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` },
  })
  if (!res.ok) throw new Error('No se pudieron cargar los workspaces')
  const data = (await res.json()) as { results: DataCentral[] } | DataCentral[]
  return Array.isArray(data) ? data : data.results
}

/**
 * Lista de CIAgros Hija. Si se pasa mainId filtra por CIAgro Padre.
 * Para rol <= 3 no se necesita este hook — se usan los datacentrals de /users/me/.
 */
export function useDataCentrals(mainId?: string) {
  return useQuery({
    queryKey: ['datacentrals', mainId ?? 'all'],
    queryFn: () => fetchDataCentrals(mainId),
    enabled: !!tokens.getAccess() && mainId !== undefined,
    staleTime: 60_000,
  })
}
