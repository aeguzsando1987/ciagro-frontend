/**
 * Congelado de una capa (RS-16).
 *
 * Lo que se prueba es la FORMA DEL MULTIPART. Un FormData plano aplanaria los
 * arreglos a "5.1,6.2" y el backend no podria distinguir tipos; el error solo
 * aparecería en runtime, contra el servidor real.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/tokens', () => ({ tokens: { getAccess: () => 'tok' } }))

import { useFreezeSoilLayer } from './useFreezeSoilLayer'

const PAYLOAD = {
  layer: 'ph',
  breaks: [5.1, 6.2],
  classes: [
    {
      index: 0,
      label: '6.2–9',
      by_points: { count: 3, pct: 30, area_ha: 3 },
      by_area: { pct: 20, area_ha: 2 },
    },
  ],
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

function render() {
  return renderHook(() => useFreezeSoilLayer('r1', 'soilmap', 'h1'), { wrapper })
}

function cuerpo(): FormData {
  return (vi.mocked(fetch).mock.calls[0]![1] as RequestInit).body as FormData
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ published_layers: ['ph'] }), { status: 200 }))
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('useFreezeSoilLayer', () => {
  it('manda los arreglos como JSON, no aplanados', async () => {
    const { result } = render()
    result.current.mutate(PAYLOAD)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const form = cuerpo()
    expect(form.get('layer')).toBe('ph')
    // Aplanado seria "5.1,6.2" y el backend no podria parsearlo.
    expect(JSON.parse(form.get('breaks') as string)).toEqual([5.1, 6.2])
    expect(JSON.parse(form.get('classes') as string)[0].by_area).toEqual({
      pct: 20,
      area_ha: 2,
    })
  })

  it('omite histograma e imagen si no hay: enviarlos vacíos los guardaría vacíos', async () => {
    const { result } = render()
    result.current.mutate(PAYLOAD)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const form = cuerpo()
    expect(form.get('histogram')).toBeNull()
    expect(form.get('image')).toBeNull()
  })

  it('adjunta la imagen con el nombre de la capa', async () => {
    const { result } = render()
    result.current.mutate({ ...PAYLOAD, image: new Blob(['x']) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect((cuerpo().get('image') as File).name).toBe('ph.png')
  })

  it('va autenticado: sin token el backend responde 401', async () => {
    const { result } = render()
    result.current.mutate(PAYLOAD)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const init = vi.mocked(fetch).mock.calls[0]![1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Authorization: 'Bearer tok' })
  })

  it('propaga el motivo del backend, no un mensaje genérico', async () => {
    // El backend explica por que (cortes mal contados, capa desconocida, reporte
    // publicado); un "no se pudo" dejaría al usuario sin saber qué corregir.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: 'La capa ph espera 6 cortes.' }), { status: 400 })
      )
    )
    const { result } = render()
    result.current.mutate(PAYLOAD)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('La capa ph espera 6 cortes.')
  })

  it('un error sin cuerpo JSON no rompe el manejo del fallo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })))
    const { result } = render()
    result.current.mutate(PAYLOAD)

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('No se pudo congelar la capa ph.')
  })
})
