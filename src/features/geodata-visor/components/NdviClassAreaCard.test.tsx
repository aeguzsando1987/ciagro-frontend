import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NdviClassAreaCard } from './NdviClassAreaCard'
import type { NdviClassAreaSummary } from '../lib/ndviClassArea'

function summary(overrides: Partial<NdviClassAreaSummary> = {}): NdviClassAreaSummary {
  return {
    classes: [
      { order: 0, label: 'Media', color: '#ffc800', min: 0.6, max: 0.7, areaHa: 1.65, pctArea: 17.4, cells: 174, pointCount: 180, pctPoints: 17.6 },
      { order: 1, label: 'Alta', color: '#ff7b00', min: 0.7, max: 0.8, areaHa: 4.37, pctArea: 46, cells: 460, pointCount: 430, pctPoints: 42 },
    ],
    outsideCells: 0,
    outsideAreaHa: 0,
    pctOutside: 0,
    coveredAreaHa: 9.5,
    pointsWithValue: 1024,
    ...overrides,
  }
}

function renderCard(props: Partial<React.ComponentProps<typeof NdviClassAreaCard>> = {}) {
  return render(
    <NdviClassAreaCard
      summary={summary()}
      indexLabel="NDVI"
      open
      onToggle={vi.fn()}
      {...props}
    />,
  )
}

describe('NdviClassAreaCard', () => {
  it('muestra el rango y las hectareas de cada clase', () => {
    renderCard()

    expect(screen.getByText('0.60 – 0.70')).toBeInTheDocument()
    expect(screen.getByText('0.70 – 0.80')).toBeInTheDocument()
    expect(screen.getByText('1.65 ha')).toBeInTheDocument()
    expect(screen.getByText('4.37 ha')).toBeInTheDocument()
  })

  it('encabeza con el indice activo y el area realmente medida', () => {
    renderCard()
    expect(screen.getByText(/NDVI · 9.5 ha medidas/)).toBeInTheDocument()
  })

  it('no muestra la fila "Sin clase" cuando todo el area esta clasificada', () => {
    renderCard()
    expect(screen.queryByText('Sin clase')).not.toBeInTheDocument()
  })

  it('muestra "Sin clase" cuando hay area fuera de las bandas configuradas', () => {
    renderCard({ summary: summary({ outsideAreaHa: 9.5, pctOutside: 100, outsideCells: 950 }) })

    expect(screen.getByText('Sin clase')).toBeInTheDocument()
    expect(screen.getByText('9.5 ha')).toBeInTheDocument()
  })

  it('contrasta el area de la parcela con la medida', () => {
    renderCard({ plotAreaHa: 12.4 })
    expect(screen.getByText(/Parcela: 12.4 ha · medido 9.5 ha/)).toBeInTheDocument()
  })

  it('avisa que en modo automatico las clases reparten el area por construccion', () => {
    renderCard({ equalAreaByConstruction: true })
    expect(screen.getByText(/por construcción/i)).toBeInTheDocument()
  })

  it('no da ese aviso con umbrales manuales', () => {
    renderCard()
    expect(screen.queryByText(/por construcción/i)).not.toBeInTheDocument()
  })

  it('colapsado oculta las clases y deja el encabezado', () => {
    renderCard({ open: false })

    expect(screen.queryByText('0.60 – 0.70')).not.toBeInTheDocument()
    expect(screen.getByText('Superficie por clase')).toBeInTheDocument()
  })

  it('el boton alterna y anuncia su estado', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    renderCard({ onToggle })

    const boton = screen.getByRole('button', { name: /ocultar superficie por clase/i })
    expect(boton).toHaveAttribute('aria-expanded', 'true')

    await user.click(boton)
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
