import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NdviClassAreaCard } from './NdviClassAreaCard'
import type { NdviClassArea, NdviClassAreaSummary } from '../lib/ndviClassArea'

function clase(over: Partial<NdviClassArea> & { order: number }): NdviClassArea {
  return {
    label: `Clase ${over.order + 1}`,
    color: '#ffc800',
    min: null,
    max: null,
    areaHa: 0,
    pctArea: 0,
    cells: 0,
    pointCount: 0,
    pctPoints: 0,
    ...over,
  }
}

function summary(overrides: Partial<NdviClassAreaSummary> = {}): NdviClassAreaSummary {
  return {
    classes: [
      clase({ order: 0, min: 0.6, max: 0.7, color: '#ffc800', areaHa: 1.66, pctArea: 17.4, pointCount: 180 }),
      clase({ order: 1, min: 0.7, max: 0.8, color: '#ff7b00', areaHa: 4.39, pctArea: 46, pointCount: 430 }),
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
  it('rotula el eje x con el límite inferior de cada clase', () => {
    renderCard()

    expect(screen.getByText('0.6')).toBeInTheDocument()
    expect(screen.getByText('0.7')).toBeInTheDocument()
    expect(screen.getByText('rango del índice')).toBeInTheDocument()
  })

  it('el eje y llega hasta la clase de mayor área', () => {
    renderCard()

    expect(screen.getByText('4.39')).toBeInTheDocument()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('dibuja cada columna con el color de su clase y altura proporcional al área', () => {
    const { container } = renderCard()
    const barras = container.querySelectorAll('[style*="background-color"]')

    expect(barras).toHaveLength(2)
    // 1.66 sobre un maximo de 4.39 = 37.8%
    expect((barras[0] as HTMLElement).style.height).toMatch(/^37\.8/)
    expect((barras[1] as HTMLElement).style.height).toBe('100%')
  })

  it('usa dos decimales en el eje cuando las clases no son múltiplos de 0.1', () => {
    renderCard({
      summary: summary({
        classes: [
          clase({ order: 0, min: 0.65, max: 0.7, areaHa: 1 }),
          clase({ order: 1, min: 0.7, max: 0.75, areaHa: 2 }),
        ],
      }),
    })

    expect(screen.getByText('0.65')).toBeInTheDocument()
  })

  it('al apuntar una columna detalla su rango, área, porcentaje y puntos', async () => {
    const user = userEvent.setup()
    renderCard()

    expect(screen.getByText(/Pasa el cursor por una columna/)).toBeInTheDocument()

    const columna = screen.getByTitle(/0.70 – 0.80/)
    await user.hover(columna)

    expect(screen.getByText('0.70 – 0.80')).toBeInTheDocument()
    expect(screen.getByText('4.39 ha')).toBeInTheDocument()
    expect(screen.getByText('430 pts')).toBeInTheDocument()
  })

  it('no mete "Sin clase" como columna: va en el desglose', () => {
    renderCard({ summary: summary({ outsideAreaHa: 2, pctOutside: 21 }) })

    expect(screen.getByText('Sin clase')).toBeInTheDocument()
    // Solo hay columnas de las clases configuradas, no una extra.
    expect(screen.getAllByTitle(/ha ·/)).toHaveLength(2)
  })

  it('omite "Sin clase" cuando toda el área está clasificada', () => {
    renderCard()
    expect(screen.queryByText('Sin clase')).not.toBeInTheDocument()
  })

  it('desglosa parcela, medido y lo que quedó sin medir', () => {
    renderCard({ plotAreaHa: 10.03 })

    expect(screen.getByText('10.03 ha')).toBeInTheDocument()
    expect(screen.getByText('9.5 ha')).toBeInTheDocument()
    // 10.03 - 9.5 = 0.53 ha, el 5.3% de la parcela.
    expect(screen.getByText('0.53 ha (5.3%)')).toBeInTheDocument()
    expect(screen.getByText('Sin medir')).toBeInTheDocument()
  })

  it('avisa en vez de restar cuando lo medido excede el área declarada', () => {
    renderCard({ plotAreaHa: 8 })

    expect(screen.queryByText('Sin medir')).not.toBeInTheDocument()
    expect(screen.getByText(/excede el área declarada/i)).toBeInTheDocument()
  })

  it('omite el bloque de parcela cuando no se conoce su superficie', () => {
    renderCard()
    expect(screen.queryByText('Parcela')).not.toBeInTheDocument()
  })

  it('avisa que en modo automático las clases reparten el área por construcción', () => {
    renderCard({ equalAreaByConstruction: true })
    expect(screen.getByText(/por construcción/i)).toBeInTheDocument()
  })

  it('no da ese aviso con umbrales manuales', () => {
    renderCard()
    expect(screen.queryByText(/por construcción/i)).not.toBeInTheDocument()
  })

  it('colapsado oculta el gráfico y deja el encabezado', () => {
    renderCard({ open: false })

    expect(screen.queryByText('rango del índice')).not.toBeInTheDocument()
    expect(screen.getByText('Superficie por clase')).toBeInTheDocument()
  })

  it('el botón alterna y anuncia su estado', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    renderCard({ onToggle })

    const boton = screen.getByRole('button', { name: /ocultar superficie por clase/i })
    expect(boton).toHaveAttribute('aria-expanded', 'true')

    await user.click(boton)
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
