import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api/client'
import { importSoilMapCsv, previewSoilMapColumns } from './useSoilMapImport'

vi.mock('@/lib/api/client', () => ({
  apiClient: { POST: vi.fn() },
}))

const postMock = vi.mocked(apiClient.POST)

function csvFile() {
  return new File(['longitude,latitude,pH\n-103.3,20.7,6.8\n'], 'soil.csv', {
    type: 'text/csv',
  })
}

beforeEach(() => {
  postMock.mockReset()
})

describe('SoilMap import API', () => {
  it('envía el CSV al endpoint de importación como multipart', async () => {
    postMock.mockResolvedValueOnce({ data: { header_id: 'header-1' }, error: undefined } as never)
    const file = csvFile()

    await importSoilMapCsv({ headerId: 'header-1', file })

    expect(postMock).toHaveBeenCalledOnce()
    const [path, options] = postMock.mock.calls[0] as unknown as [
      string,
      { params: unknown; body: unknown },
    ]
    expect(path).toBe('/api/v1/monitoring/soil-map/headers/{id}/import/')
    expect(options.params).toEqual({ path: { id: 'header-1' } })
    expect(options.body).toBeInstanceOf(FormData)
    expect((options.body as FormData).get('csv_file')).toBe(file)
  })

  it('usa el endpoint de vista previa y devuelve su mapeo', async () => {
    postMock.mockResolvedValueOnce({
      data: {
        matched: ['pH'],
        unmatched: ['extra'],
        col_map: { pH: 'pH' },
      },
      error: undefined,
    } as never)

    const result = await previewSoilMapColumns({ headerId: 'header-1', file: csvFile() })

    expect(postMock.mock.calls[0]?.[0]).toBe(
      '/api/v1/monitoring/soil-map/headers/{id}/preview-columns/'
    )
    expect(result).toEqual({
      matched: ['pH'],
      unmatched: ['extra'],
      col_map: { pH: 'pH' },
    })
  })
})
