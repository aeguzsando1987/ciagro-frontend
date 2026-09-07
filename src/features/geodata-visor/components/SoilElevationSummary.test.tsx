import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SoilElevationAnalysis } from '@/features/task-manager/hooks/useSoilMapElevation'
import { SoilElevationDetails, SoilElevationSummary } from './SoilElevationSummary'

vi.mock('@/features/task-manager/hooks/useSoilMapElevation', () => ({
  useSoilMapElevation: () => ({ data: analysis, isLoading: false, error: null }),
}))

const analysis: SoilElevationAnalysis = {
  header_id: 'soil-1',
  plot_id: 'plot-1',
  mapping_date: '2026-09-03',
  elevation_unit: 'm',
  elevation: {
    unit: 'm',
    count: 10,
    min_m: 1524,
    max_m: 1616,
    mean_m: 1568,
    range_m: 92,
    flat: false,
  },
  quality: {
    total_points: 10,
    missing_elevation: 0,
    invalid_coordinates: 0,
    outside_plot: 0,
    duplicate_points: 0,
    conflicting_locations: 0,
    possible_outliers: 0,
  },
  trend: { status: 'available', ascent_direction: 'NO', descent_direction: 'SE', r_squared: 0.9 },
  slope: {
    status: 'available',
    min_pct: 0,
    max_pct: 12.3,
    mean_pct: 4.8,
    coverage_pct: 80,
    covered_area_ha: 8,
    uncovered_area_ha: 2,
    distribution: [
      { min_pct: 0, max_pct: 3, area_ha: 8, plot_percentage: 80, covered_percentage: 100 },
    ],
  },
}

describe('resumen de elevación', () => {
  it('empieza compacto y permite desplegar y volver a ocultar el relieve', () => {
    render(<SoilElevationSummary sessionId="soil-1" />)
    const toggle = screen.getByRole('button', { name: 'Elevación y relieve' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveTextContent('1,524 m – 1,616 m')
    expect(screen.getByText('Descenso predominante: NO → SE')).not.toBeVisible()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Descenso predominante: NO → SE')).toBeVisible()
    expect(screen.getByText('Media: 4.8% · Máxima: 12.3%')).toBeVisible()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Descenso predominante: NO → SE')).not.toBeVisible()
  })

  it('muestra unidades, desnivel, rumbo calculado y distribución recibida', () => {
    render(<SoilElevationDetails data={analysis} />)
    expect(screen.getByText('1,524 m – 1,616 m')).toBeInTheDocument()
    expect(screen.getByText('Media: 1,568 m · Desnivel: 92 m')).toBeInTheDocument()
    expect(screen.getByText('Descenso predominante: NO → SE')).toBeInTheDocument()
    expect(screen.getByText('Media: 4.8% · Máxima: 12.3%')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Rangos · cobertura: 80% de la parcela'))
    expect(screen.getByText('0–3%')).toBeInTheDocument()
    expect(screen.getByText('8 ha · 80% de la parcela')).toBeInTheDocument()
  })

  it('mantiene ceros y no inventa dirección para una parcela plana', () => {
    render(
      <SoilElevationDetails
        data={{
          ...analysis,
          trend: { status: 'flat' },
          elevation: {
            ...analysis.elevation,
            min_m: -4,
            max_m: -4,
            mean_m: -4,
            range_m: 0,
            flat: true,
          },
          slope: { ...analysis.slope, mean_pct: 0, max_pct: 0 },
        }}
      />
    )
    expect(screen.getByText('-4 m – -4 m')).toBeInTheDocument()
    expect(screen.getByText('Media: -4 m · Desnivel: 0 m')).toBeInTheDocument()
    expect(screen.getByText('Sin cambio de elevación apreciable')).toBeInTheDocument()
    expect(screen.getByText('Media: 0% · Máxima: 0%')).toBeInTheDocument()
  })

  it('explica la ausencia de pendiente sin mostrar valores ficticios', () => {
    render(<SoilElevationDetails data={{ ...analysis, slope: { status: 'collinear_points' } }} />)
    expect(screen.getByText('Las muestras no cubren una superficie')).toBeInTheDocument()
    expect(screen.queryByText(/Media: 4.8%/)).not.toBeInTheDocument()
  })
})
