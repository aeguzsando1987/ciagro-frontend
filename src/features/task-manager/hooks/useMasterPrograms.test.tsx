import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api/client'
import { useMasterPrograms, type MasterProgramsPage } from './useMasterPrograms'

vi.mock('@/lib/api/client', () => ({ apiClient: { GET: vi.fn() } }))

const getMock = vi.mocked(apiClient.GET)

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const result = renderHook(() => useMasterPrograms({ datacentral: 'dc-1' }), { wrapper })
  return { ...result, client }
}

function pageResponse(page: number, total: number, pageSize = 25): MasterProgramsPage {
  const start = (page - 1) * pageSize
  const end = Math.min(start + pageSize, total)
  return {
    count: total,
    next: end < total ? `https://api.example.test/master-programs/?page=${page + 1}` : null,
    results: Array.from({ length: end - start }, (_, index) => ({
      id: `program-${start + index + 1}`,
      title: `Programa ${start + index + 1}`,
      code: `P-${start + index + 1}`,
      agro_unit: 'unit-1',
      status_display: 'Pendiente',
      created_at: '',
      updated_at: '',
    }) as unknown as MasterProgramsPage['results'][number]),
  }
}

function asApiResponse(data: MasterProgramsPage) {
  return { data, error: undefined } as never
}

describe('useMasterPrograms pagination', () => {
  beforeEach(() => getMock.mockReset())

  it.each([10, 25, 60, 150])('loads all %i programs across DRF pages without loss', async (total) => {
    getMock.mockImplementation(async (_path, options) => {
      const request = options as unknown as { params?: { query?: Record<string, string> } }
      const page = Number(request?.params?.query?.page ?? 1)
      return asApiResponse(pageResponse(page, total))
    })
    const { result } = setup()

    await waitFor(() => expect(result.current.loadedCount).toBe(Math.min(total, 25)))
    while (result.current.hasNextPage) {
      await act(async () => { await result.current.fetchNextPage() })
    }

    expect(result.current.data).toHaveLength(total)
    expect(new Set(result.current.data.map((program) => program.id)).size).toBe(total)
    expect(result.current.totalCount).toBe(total)
    expect(result.current.hasNextPage).toBe(false)
  })

  it('keeps loaded pages and retries a later-page error', async () => {
    let failed = false
    getMock.mockImplementation(async (_path, options) => {
      const request = options as unknown as { params?: { query?: Record<string, string> } }
      const page = Number(request?.params?.query?.page ?? 1)
      if (page === 2 && !failed) {
        failed = true
        return { data: undefined, error: { message: 'temporary error' } } as never
      }
      return asApiResponse(pageResponse(page, 30))
    })
    const { result } = setup()

    await waitFor(() => expect(result.current.loadedCount).toBe(25))
    await act(async () => { await result.current.fetchNextPage() })
    expect(result.current.data).toHaveLength(25)
    await waitFor(() => expect(result.current.isFetchNextPageError).toBe(true))
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false))

    await act(async () => { await result.current.fetchNextPage() })
    await waitFor(() => expect(result.current.data).toHaveLength(30))
    expect(result.current.hasNextPage).toBe(false)
  })

  it('does not continue if DRF returns a missing, invalid, or non-advancing next page', async () => {
    getMock.mockResolvedValue(asApiResponse({ ...pageResponse(1, 50), next: 'https://api.test/?page=1' }))
    const { result } = setup()
    await waitFor(() => expect(result.current.loadedCount).toBe(25))
    expect(result.current.hasNextPage).toBe(false)
    expect(getMock).toHaveBeenCalledTimes(1)
  })
})
