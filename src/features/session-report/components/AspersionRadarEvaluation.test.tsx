import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AspersionRadarEvaluation } from './AspersionRadarEvaluation'
import type { StatsSnapshot } from '../types'

const indicators: Array<NonNullable<StatsSnapshot['radar']>['indicators'][number]> = [
  ['volume_ratio', 'Proporción de volumen', 92],
  ['speed_kmh', 'Velocidad', null],
  ['pressure_bar', 'Presión', null],
  ['flow_ls', 'Caudal', null],
  ['productivity_hah', 'Productividad', null],
  ['target_compliance_pct', 'Proporción meta', 70],
].map(([id, name, score]) => ({
  id: String(id), name: String(name), value: ({ volume_ratio: .9989, speed_kmh: 4.49, pressure_bar: 2.54, flow_ls: .92, productivity_hah: 5.98, target_compliance_pct: 91.61 } as Record<string, number>)[String(id)] ?? null, unit: ({ volume_ratio: 'aplicado / meta', speed_kmh: 'km/h', pressure_bar: 'bar', flow_ls: 'L/s', productivity_hah: 'ha/h', target_compliance_pct: '%' } as Record<string, string>)[String(id)] ?? '',
  converted_value: id === 'pressure_bar' ? { value: 29.01, unit: 'psi' } : null,
  target: null,
  deviation: null, score: score as number | null,
  status: score === null ? 'Sin datos suficientes para evaluar' : 'Medición descriptiva',
  opinion: score === null ? 'Falta configurar un rango.' : 'Valor derivado de la sesión.',
  available: score !== null, rule: 'Fixture de prueba',
}))

const stats = {
  radar: {
    indicators,
    score: 81,
    evaluated_count: 2,
    pending_count: 4,
    status: 'Evaluación parcial',
    weighting: 'Promedio de indicadores evaluables.',
  },
  superficie_parcela_ha: 10,
  area_cobertura_ha: 4.2,
  porcentaje_superficie_reportada: 42,
  area_cobertura_metodo: 'Suma de área reportada por puntos; puede incluir solapamientos.',
  linea_tiempo: {
    resolution: 'hour' as const,
    start: '2026-10-01T08:00:00Z',
    end: '2026-10-01T09:00:00Z',
    duration_seconds: 3600,
    duration_days: null,
    status: 'Agregado por hora desde timestamps GPS existentes.',
    series: [{
      at: '2026-10-01T08:00:00Z', area_ha: 4.2, area_acumulada_ha: 4.2,
      speed_kmh: 5.2, pressure_bar: 2.2, flow_ls: 1.1, points_count: 7,
    }],
  },
} as unknown as StatsSnapshot

const measurementRadar = {
  version: 'measurement-v1' as const, state: 'ready' as const,
  method: 'Radar descriptivo: cada radio es la posición normalizada del promedio dentro de su propia escala contextual declarada. No representa calificación, eficiencia ni cumplimiento.',
  indicators: indicators.map((item, index) => ({
    id: item.id, name: item.name, unit: item.unit, value: item.value,
    scale_min: item.id === 'target_compliance_pct' ? 0 : index, scale_max: item.id === 'target_compliance_pct' ? 100 : index + 10,
    position: item.id === 'target_compliance_pct' ? item.value : 50,
    scale_source: 'Rango observado de la sesión.', reason: 'Posición descriptiva, no score.',
  })),
}

describe('AspersionRadarEvaluation', () => {
  it('labels a complete score from a provisional catalog without presenting it as approved', () => {
    const provisional = structuredClone(stats)
    provisional.radar!.catalog_status = 'PROVISIONAL'
    provisional.radar!.provisional_note = 'Rango provisional basado en histórico; evaluación operativa no aprobada técnicamente.'
    render(<AspersionRadarEvaluation stats={provisional} />)
    expect(screen.getByRole('note')).toHaveTextContent('Rango provisional basado en histórico')
    expect(screen.queryByText('Rangos técnicos aprobados.')).not.toBeInTheDocument()
  })
  it('does not compare an unverified historical source or change the radar score', () => {
    render(<AspersionRadarEvaluation stats={{ ...stats, historical_reference: {
      status: 'unavailable', message: 'Sin histórico comparable confirmado',
    } }} />)
    expect(screen.getByText(/Sin histórico comparable confirmado/)).toBeInTheDocument()
    expect(screen.getByText(/81 \/ 100/)).toBeInTheDocument()
  })

  it('shows a verified historical band as descriptive, never as technical target', () => {
    render(<AspersionRadarEvaluation stats={{ ...stats, historical_reference: {
      status: 'comparable', group: 'Churi 2026-10 • meta 400 L/ha',
      metrics: ['speed_kmh', 'pressure_bar', 'flow_ls', 'productivity_hah'].map(id => ({
        id, name: id, unit: 'km/h', value: 7, p10: 6, median: 7, p90: 8, percentile: 50,
      })), session_count: 11, points_count: 14733, period: '2026-10',
      source_file: 'fuente.csv', equipment_identity: 'Equipo comprobado',
      verified_at: '2026-11-04T10:00:00Z', version: '0123456789abcdef',
      method: 'Percentiles entre promedios por sesión',
      warning: 'Referencia histórica descriptiva, no es un rango técnico aprobado ni modifica la calificación.',
    } }} />)
    expect(screen.getByText('Churi 2026-10 • meta 400 L/ha')).toBeInTheDocument()
    expect(screen.getAllByText('P50')).toHaveLength(4)
    expect(screen.getByText(/81 \/ 100/)).toBeInTheDocument()
  })

  it('presenta estabilidad descriptiva sin inventar porcentajes ni cambiar scores', () => {
    const measured = structuredClone(stats)
    measured.radar!.indicators[1]!.stability = { avg: 5, min: 2, max: 8, unit: 'km/h', count: 2,
      stddev: 3, within_pct: null, below_pct: null, above_pct: null, method: 'Poblacional' }
    render(<AspersionRadarEvaluation stats={measured} />)
    expect(screen.getByText('Estabilidad de la operación')).toBeInTheDocument()
    expect(screen.getByText('Pendiente de rango')).toBeInTheDocument()
    expect(screen.getByText('2 / 8')).toBeInTheDocument()
    expect(screen.getByText(/81 \/ 100/)).toBeInTheDocument()
  })
  it.each([{ radar: {} }, { radar: { ...stats.radar, indicators: undefined } }, { ...stats, linea_tiempo: { series: null } }])('shows a recoverable message for malformed data instead of calling map on undefined', invalid => {
    render(<AspersionRadarEvaluation stats={invalid as StatsSnapshot} />)
    expect(screen.getByRole('alert')).toHaveTextContent('formato incorrecto')
  })
  it('shows all six physical measurements by default, including unconfigured indicators', () => {
    render(<AspersionRadarEvaluation stats={stats} />)
    expect(screen.getByRole('button', { name: 'Mediciones (6)' })).toBeInTheDocument()
    expect(screen.getByText('4.49 km/h')).toBeInTheDocument()
    expect(screen.getByText('2.54 bar')).toBeInTheDocument()
    expect(screen.getByText('0.92 L/s')).toBeInTheDocument()
    expect(screen.getByText('5.98 ha/h')).toBeInTheDocument()
    expect(screen.getAllByText('Sin referencia compatible').length).toBeGreaterThan(0)
    expect(screen.getByText(/no una calificación de eficiencia/i)).toBeInTheDocument()
    expect(screen.getByText(/Área reportada \/ parcela/)).toBeInTheDocument()
    expect(screen.getByText(/puede incluir solapamientos/i)).toBeInTheDocument()
  })

  it('draws the six real averages in the descriptive radar with disclosed scales', () => {
    render(<AspersionRadarEvaluation stats={{ ...stats, measurement_radar: measurementRadar }} />)
    expect(screen.getByRole('img', { name: /radar descriptivo de mediciones/i })).toBeInTheDocument()
    expect(screen.getAllByText('4.49 km/h').length).toBeGreaterThan(1)
    expect(screen.getByText(/No representa calificación, eficiencia ni cumplimiento/)).toBeInTheDocument()
    expect(screen.getAllByText(/No es score/).length).toBeGreaterThan(0)
  })

  it('keeps the score radar in a separate evaluation mode and leaves unconfigured axes unscored', () => {
    render(<AspersionRadarEvaluation stats={stats} />)
    fireEvent.click(screen.getByRole('button', { name: 'Evaluación (2/6)' }))
    expect(screen.getByRole('img', { name: /gráfica radar/i })).toBeInTheDocument()
    expect(screen.getByText(/2 de 6 indicadores tienen puntuación válida; 4 no se trazan/i)).toBeInTheDocument()
    expect(screen.getAllByText('4.49 km/h').length).toBeGreaterThan(1)
    expect(screen.getAllByText('0.92 L/s').length).toBeGreaterThan(1)
    expect(screen.getAllByText('Sin puntuación').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sin datos suficientes para evaluar').length).toBeGreaterThan(0)
    expect(screen.getByText('29.01 psi')).toBeInTheDocument()
  })

  it('shows actual timestamps and timeline statistics without interpolating records', () => {
    render(<AspersionRadarEvaluation stats={stats} />)
    expect(screen.getByText('1 h')).toBeInTheDocument()
    expect(screen.getByText(/Agregado por hora desde timestamps GPS existentes/)).toBeInTheDocument()
    expect(screen.getByText('Vel. (km/h)')).toBeInTheDocument()
    expect(screen.getByText('5.2')).toBeInTheDocument()
  })

  it('shows V2 only as a non-active point-level preview', () => {
    render(<AspersionRadarEvaluation stats={{ ...stats, radar_v2: {
      version: 'v2', state: 'ready', profile_status: null,
      reason: 'Sin perfil compatible: estadísticas descriptivas sin puntuación.',
      indicators: [{ id: 'speed_kmh', name: 'Velocidad', unit: 'km/h', valid_count: 10, invalid_count: 2,
        statistics: { avg: 5, min: 4, max: 6, stddev: .3, p05: 4, p50: 5, p95: 6, count: 10 },
        strict_compliance_pct: null, tolerant_compliance_pct: null, stability: null,
        score: null, official_score: null, status: 'Sin referencia compatible', rule: 'V2' }],
      global: { weighted_six: null, three_pillars: null }, configuration_groups: [],
      profile_resolution: { source: 'unmatched', catalog_id: null, name: null, reason: 'No hay perfil compatible.' },
    } }} />)
    expect(screen.getByText('Vista previa — Motor radar V2')).toBeInTheDocument()
    expect(screen.getByText(/No reemplaza la calificación vigente/)).toBeInTheDocument()
    expect(screen.getByText(/10 \/ 2/)).toBeInTheDocument()
    expect(screen.getByText(/81 \/ 100/)).toBeInTheDocument()
  })

  it('does not invent an application score when radar data is missing', () => {
    render(<AspersionRadarEvaluation stats={{} as StatsSnapshot} />)
    expect(screen.getByText(/todavía no incluye la evaluación radar/i)).toBeInTheDocument()
  })
})
