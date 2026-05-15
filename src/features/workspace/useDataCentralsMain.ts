import { useQuery } from '@tanstack/react-query'
import { tokens } from '@/lib/auth/tokens'
import type { DataCentralMain } from '@/types/workspace'

// GET /api/v1/organizations/data-centrals-main/ — respuesta paginada {count, results}
async function fetchDataCentralsMain(): Promise<DataCentralMain[]> {
  const baseUrl = import.meta.env.VITE_API_BASE_URL
  const res = await fetch(`${baseUrl}/organizations/data-centrals-main/`, {
    headers: { Authorization: `Bearer ${tokens.getAccess() ?? ''}` },
  })
  if (!res.ok) throw new Error('No se pudieron cargar las organizaciones principales')
  const data = (await res.json()) as { results: DataCentralMain[] } | DataCentralMain[]
  return Array.isArray(data) ? data : data.results
}

/** Lista de CIAgros Padre visibles para el usuario (Gerente/SuperAdmin). */
export function useDataCentralsMain() {
  return useQuery({
    queryKey: ['data-centrals-main'],
    queryFn: fetchDataCentralsMain,
    enabled: !!tokens.getAccess(),
    staleTime: 60_000,
  })
}
