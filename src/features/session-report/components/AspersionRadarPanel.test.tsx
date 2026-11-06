import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { describe, it, expect, vi } from 'vitest'
import { server } from '@/test/msw-server'
import { AspersionRadarPanel } from './AspersionRadarPanel'

const endpoint = `${import.meta.env.VITE_API_BASE_URL}/field_ops/aspersion-sessions/h1/radar/`
const ready = {
  object_id: 'h1', state: 'ready', general_snapshot: { parcela: 'Parcela de prueba' },
  stats_snapshot: {
    points_count: 2,
    radar: {
      indicators: ['volume_ratio', 'speed_kmh', 'pressure_bar', 'flow_ls', 'productivity_hah', 'target_compliance_pct'].map(id => ({
        id, name: id, value: null, unit: 'ha/h', target: null, deviation: null, score: null,
        status: 'Sin datos suficientes para evaluar', opinion: 'Falta una referencia.', available: false, rule: 'Prueba',
      })), score: null, evaluated_count: 0, pending_count: 6, status: 'Evaluación parcial', weighting: 'Promedio',
    },
    linea_tiempo: { resolution: 'unavailable', start: null, end: null, duration_seconds: null, duration_days: null, status: 'Sin timestamps', series: [] },
  },
}
function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><AspersionRadarPanel open onClose={vi.fn()} objectId="h1" /></QueryClientProvider>)
}

describe('AspersionRadarPanel read-only', () => {
  it('shows six indicators through GET without requiring a report', async () => {
    const requests: string[] = []
    server.use(http.get(endpoint, ({ request }) => { requests.push(request.method); return HttpResponse.json(ready) }))
    renderPanel()
    expect(await screen.findByRole('button', { name: 'Mediciones (6)' })).toBeInTheDocument()
    expect(screen.getAllByText('Sin referencia compatible')).toHaveLength(6)
    expect(screen.queryByText('Generar reporte de actividad')).not.toBeInTheDocument()
    expect(requests).toEqual(['GET'])
  })
  it('distinguishes loading and empty sessions', async () => {
    let resolve!: () => void
    const pending = new Promise<void>(done => { resolve = done })
    server.use(http.get(endpoint, async () => { await pending; return HttpResponse.json({ ...ready, state: 'empty' }) }))
    renderPanel()
    expect(screen.getByText('Calculando evaluación de aspersión…')).toBeInTheDocument()
    resolve()
    expect(await screen.findByText('Esta sesión no contiene puntos para evaluar.')).toBeInTheDocument()
  })
  it('offers retry for a malformed response, then displays valid data', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ ...ready, stats_snapshot: {} })))
    renderPanel()
    expect(await screen.findByRole('alert')).toHaveTextContent('formato incorrecto')
    server.use(http.get(endpoint, () => HttpResponse.json(ready)))
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('button', { name: 'Mediciones (6)' })).toBeInTheDocument()
  })
  it('shows server errors rather than an empty radar', async () => {
    server.use(http.get(endpoint, () => new HttpResponse(null, { status: 500 })))
    renderPanel()
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500')
    expect(screen.queryByRole('img', { name: /Gráfica radar/ })).not.toBeInTheDocument()
  })
})
