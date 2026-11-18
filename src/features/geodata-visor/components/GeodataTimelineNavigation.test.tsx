import { useEffect, useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VisorSelection } from '../types'
import type { NdviTimelineItem } from '../hooks/useNdviTimeline'

const fixtures = vi.hoisted(() => ({ mounted: vi.fn(), unmounted: vi.fn() }))
const sessions = [
  { id: 'n1', date: '2026-06-01', kind: 'ndvi' as const, points_count: 3, cycle: null },
  { id: 'n2', date: '2026-06-11', kind: 'ndvi' as const, points_count: 3, cycle: null },
  { id: 'n3', date: '2026-06-21', kind: 'ndvi' as const, points_count: 3, cycle: null },
]
const items = sessions.map((session, index) => ({
  id: session.id, session_date: session.date, has_ndvi: true,
  mean: (index + 1) / 10, ndvi_reference: null,
})) as NdviTimelineItem[]

vi.mock('../hooks/usePlotSessionTree', () => ({
  usePlotSessionTree: () => ({ sessions, total: 3, missing: 0, isLoading: false }),
}))
vi.mock('../hooks/useNdviTimeline', () => ({
  useNdviTimeline: () => ({ data: items, isLoading: false }),
}))
vi.mock('@/features/admin/hooks/usePlots', () => ({ usePlots: () => ({ data: [] }) }))
vi.mock('./NdviMap', () => ({
  NdviMap: ({ sessionId, onReadyChange }: {
    sessionId: string
    onReadyChange: (ready: boolean, id: string) => void
  }) => {
    const [zoom, setZoom] = useState(10)
    useEffect(() => {
      fixtures.mounted()
      return () => { fixtures.unmounted() }
    }, [])
    useEffect(() => onReadyChange(false, sessionId), [sessionId, onReadyChange])
    return <div>
      <output data-testid="map-session">{sessionId}</output>
      <button onClick={() => setZoom(17)}>Zoom {zoom}</button>
      <button onClick={() => onReadyChange(true, sessionId)}>Mapa listo</button>
    </div>
  },
}))
vi.mock('./AspersionMap', () => ({ AspersionMap: () => null }))
vi.mock('./SoilMap', () => ({ SoilMap: () => null }))
vi.mock('./YieldMap', () => ({ YieldMap: () => null }))
vi.mock('./PlantingMap', () => ({ PlantingMap: () => null }))
vi.mock('@/features/task-manager/components/PhytoMap', () => ({ PhytoMap: () => null }))
vi.mock('./SessionInfoCard', () => ({ SessionInfoCard: () => null }))
vi.mock('./SoilMapSessionInfoCard', () => ({ SoilMapSessionInfoCard: () => null }))
vi.mock('@/features/session-report/components/SessionReportToggle', () => ({ SessionReportToggle: () => null }))

import { GeodataDashboard } from './GeodataDashboard'

function Dashboard() {
  const [selection, setSelection] = useState<VisorSelection>({
    level: 'session', org: { id: 'org', name: 'CIAgro' },
    ranch: { id: 'ranch', name: 'Rancho' }, plot: { id: 'plot', name: 'Parcela' },
    session: sessions[0]!,
  })
  return <GeodataDashboard selection={selection} onSelect={setSelection} focusedSession />
}

function mountDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><Dashboard /></QueryClientProvider>)
}

describe('navegación continua de la parcela', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('actualiza sesión, valores y mapa durante el arrastre, incluso en menos de 140 ms', async () => {
    mountDashboard()
    fireEvent.click(screen.getByText('Zoom 10'))
    const slider = screen.getByRole('slider')
    fireEvent.pointerDown(slider)
    for (const [value, id] of [['500', 'n2'], ['1000', 'n3'], ['0', 'n1']]) {
      fireEvent.change(slider, { target: { value } })
      expect(screen.getAllByTestId('map-session')[0]).toHaveTextContent('n1')
      expect(screen.getAllByTestId('map-session').at(-1)).toHaveTextContent(id!)
      expect(screen.getAllByText('0.10').length).toBeGreaterThan(0)
    }
    // Aún no se ha soltado el indicador; el mapa conserva su estado local.
    expect(screen.getByText('Zoom 17')).toBeInTheDocument()
    expect(fixtures.mounted).toHaveBeenCalled()
    fireEvent.change(slider, { target: { value: '500' } })
    fireEvent.click(screen.getAllByText('Mapa listo').at(-1)!)
    expect(screen.getByTestId('map-session')).toHaveTextContent('n2')
    fireEvent.pointerUp(slider)
  })

})
