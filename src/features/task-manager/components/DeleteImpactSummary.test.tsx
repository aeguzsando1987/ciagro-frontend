import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { DeleteImpactSummary } from './DeleteImpactSummary'
import { FlushSessionDialog } from './FlushSessionDialog'
import type { DeleteImpact } from '@/features/task-manager/types'

function impacto(over: Partial<DeleteImpact> = {}): DeleteImpact {
  return {
    level: 'session',
    target_id: 'abc',
    target_label: 'Aspersión 2026-03-10',
    blockers: { published_reports: [], sessions_with_data: [] },
    counts: {},
    can_delete: true,
    ...over,
  } as DeleteImpact
}

describe('DeleteImpactSummary', () => {
  it('traduce las claves del dominio a español, no muestra "soil_map"', () => {
    render(
      <DeleteImpactSummary
        impact={impacto({
          counts: { sessions: { soil_map: 1 }, points: { soil_map: 16944 } },
        })}
      />,
    )
    expect(screen.getByText(/mapeo de suelo/)).toBeTruthy()
    expect(screen.queryByText(/soil_map/)).toBeNull()
  })

  it('formatea los miles: 16944 se lee como 16,944', () => {
    render(
      <DeleteImpactSummary
        impact={impacto({ counts: { sessions: { ndvi: 1 }, points: { ndvi: 16944 } } })}
      />,
    )
    expect(screen.getByText(/16,944 puntos/)).toBeTruthy()
  })

  it('omite los conteos en cero en vez de decir "0 subprogramas"', () => {
    render(<DeleteImpactSummary impact={impacto({ counts: { programas: 0, reports: 2 } })} />)
    expect(screen.queryByText(/0 subprograma/)).toBeNull()
    expect(screen.getByText(/2 reportes/)).toBeTruthy()
  })

  it('distingue una sesión sin datos de una con datos', () => {
    render(
      <DeleteImpactSummary
        impact={impacto({ counts: { sessions: { phyto: 1 }, points: { phyto: 0 } } })}
      />,
    )
    expect(screen.getByText(/sin datos cargados/)).toBeTruthy()
  })

  it('cuando está bloqueado nombra las sesiones que lo impiden, con sus puntos', () => {
    render(
      <DeleteImpactSummary
        impact={impacto({
          can_delete: false,
          blockers: {
            published_reports: [],
            sessions_with_data: [
              { id: 's1', kind: 'ndvi', label: 'NDVI 2026-08-04', points: 1024 },
            ],
          },
        })}
      />,
    )
    expect(screen.getByText(/No se puede eliminar todavía/)).toBeTruthy()
    expect(screen.getByText(/NDVI 2026-08-04/)).toBeTruthy()
    expect(screen.getByText(/1,024 puntos/)).toBeTruthy()
  })

  it('explica la salida cuando el bloqueo es un reporte publicado', () => {
    render(
      <DeleteImpactSummary
        impact={impacto({
          can_delete: false,
          blockers: {
            published_reports: [
              { id: 'r1', session_id: 's1', kind: 'aspersion', report_date: '2026-03-10' },
            ],
            sessions_with_data: [],
          },
        })}
      />,
    )
    expect(screen.getByText(/liga pública activa/)).toBeTruthy()
    expect(screen.getByText(/Despublícalo o elimínalo/)).toBeTruthy()
  })
})

describe('FlushSessionDialog con impacto', () => {
  const flush = { mutate: vi.fn(), isPending: false }

  it('bloquea el borrado sin pedir código cuando can_delete es false', () => {
    render(
      <FlushSessionDialog
        open
        onClose={vi.fn()}
        flush={flush}
        itemsLabel="x"
        impact={impacto({
          can_delete: false,
          blockers: {
            published_reports: [],
            sessions_with_data: [
              { id: 's1', kind: 'ndvi', label: 'NDVI', points: 10 },
            ],
          },
        })}
      />,
    )
    // Ni botón de borrar ni input: no hay nada que confirmar si el backend ya dijo que no.
    expect(screen.queryByRole('button', { name: /Eliminar todo/ })).toBeNull()
    expect(screen.queryByPlaceholderText('Código de 6 dígitos')).toBeNull()
    expect(screen.getByRole('button', { name: /Entendido/ })).toBeTruthy()
  })

  it('con can_delete true sigue exigiendo el código', () => {
    render(
      <FlushSessionDialog open onClose={vi.fn()} flush={flush} itemsLabel="x" impact={impacto()} />,
    )
    const boton = screen.getByRole('button', { name: /Eliminar todo/ }) as HTMLButtonElement
    expect(boton.disabled).toBe(true)
    expect(screen.getByPlaceholderText('Código de 6 dígitos')).toBeTruthy()
  })

  it('sin prop impact se comporta como antes (los tres flush existentes)', () => {
    render(<FlushSessionDialog open onClose={vi.fn()} flush={flush} itemsLabel="x" />)
    expect(screen.getByRole('button', { name: /Eliminar todo/ })).toBeTruthy()
    expect(screen.getByText(/vuelve a estado/)).toBeTruthy()
  })

  it('consequence sobrescribe el texto que solo aplica al flush', () => {
    render(
      <FlushSessionDialog
        open
        onClose={vi.fn()}
        flush={flush}
        itemsLabel="x"
        consequence={<>El subprograma podrá recuperarse.</>}
      />,
    )
    expect(screen.getByText(/podrá recuperarse/)).toBeTruthy()
    expect(screen.queryByText(/vuelve a estado/)).toBeNull()
  })
})
