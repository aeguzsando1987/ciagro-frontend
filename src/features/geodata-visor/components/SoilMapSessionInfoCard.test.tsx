import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, search }: { children: React.ReactNode; search: Record<string, unknown> }) => (
    <a data-search={JSON.stringify(search)}>{children}</a>
  ),
}))
vi.mock('@/features/task-manager/hooks/useSoilMapSessionDetail', () => ({
  useSoilMapSessionDetail: () => ({
    data: {
      id: 'soil-1',
      mapping_date: '2026-07-23',
      status: 'completed',
      points_count: '18362',
      program: 'hijo-1',
    },
  }),
}))
vi.mock('@/features/task-manager/hooks/useHijoDetail', () => ({
  useHijoDetail: () => ({
    data: { id: 'hijo-1', title: 'Subprograma suelo', master_program: 'master-1' },
  }),
}))
vi.mock('@/features/task-manager/hooks/useMasterTree', () => ({
  useMasterTree: () => ({ data: { id: 'master-1', title: 'Programa agrícola' } }),
}))

import { SoilMapSessionInfoCard } from './SoilMapSessionInfoCard'

describe('SoilMapSessionInfoCard', () => {
  it('muestra la sesión de suelo encima del mapa con sus enlaces', () => {
    render(<SoilMapSessionInfoCard sessionId="soil-1" datacentralId="dc-1" />)

    expect(screen.getByText(/Sesión 2026-07-23/)).toBeInTheDocument()
    expect(screen.getByText(/18362 pts/)).toBeInTheDocument()
    expect(screen.getByText(/Subprograma suelo/)).toBeInTheDocument()
    expect(screen.getByText(/Programa agrícola/)).toBeInTheDocument()
  })

  it('abre el Task Manager con el tipo soil_map', () => {
    render(<SoilMapSessionInfoCard sessionId="soil-1" datacentralId="dc-1" />)

    const link = screen.getByText(/Ver sesión/).closest('a')
    expect(JSON.parse(link?.getAttribute('data-search') ?? '{}')).toMatchObject({
      openSesion: 'soil-1',
      openHijo: 'hijo-1',
      openMaster: 'master-1',
      openSesionType: 'soil_map',
    })
  })
})
