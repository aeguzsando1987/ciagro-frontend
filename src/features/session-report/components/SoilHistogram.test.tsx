/**
 * Histograma en pantalla (RS-14). La geometria se prueba en `lib/histogram.test.ts`;
 * aqui va lo que solo existe en pantalla: tooltip y seleccion de barra.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SoilHistogram } from './SoilHistogram'

const HIST = {
  bin_count: 3,
  bins: [
    { lower: 5.0, upper: 5.5, count: 10 },
    { lower: 5.5, upper: 6.0, count: 40 },
    { lower: 6.0, upper: 6.5, count: 25 },
  ],
}

function barras(container: HTMLElement) {
  return [...container.querySelectorAll('rect')]
}

describe('SoilHistogram', () => {
  it('dibuja una barra por bin y una línea por corte', () => {
    const { container } = render(
      <SoilHistogram histogram={HIST} breaks={[5.6, 6.2]} palette={['#a', '#b', '#c']} />
    )
    expect(barras(container)).toHaveLength(3)
    // 2 cortes + 3 marcas de rejilla + 2 ejes: los cortes son los punteados.
    expect(container.querySelectorAll('line[stroke-dasharray]')).toHaveLength(2)
  })

  it('al apuntar una barra dice su rango y su valor', () => {
    const { container } = render(<SoilHistogram histogram={HIST} unit="%" />)
    fireEvent.mouseEnter(barras(container)[1]!)
    expect(screen.getByTestId('histogram-tooltip').textContent).toBe('5.5 – 6 % · 40 Puntos')
  })

  it('sin apuntar nada el tooltip queda vacío', () => {
    // Se apunta al tooltip por testid y no por texto: "Puntos" tambien es la
    // etiqueta del eje Y dentro del SVG.
    render(<SoilHistogram histogram={HIST} />)
    expect(screen.getByTestId('histogram-tooltip').textContent).toBe('')
  })

  it('al elegir una barra entrega su rango, y al repetir clic lo suelta', () => {
    const onSelect = vi.fn()
    const { container } = render(<SoilHistogram histogram={HIST} onSelect={onSelect} />)

    fireEvent.click(barras(container)[2]!)
    expect(onSelect).toHaveBeenCalledWith({ lower: 6.0, upper: 6.5 })

    fireEvent.click(barras(container)[2]!)
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })

  it('sin onSelect las barras no responden al clic', () => {
    const { container } = render(<SoilHistogram histogram={HIST} />)
    fireEvent.click(barras(container)[0]!)
    // Sin seleccion no se atenua ninguna barra.
    expect(barras(container).every((r) => r.getAttribute('opacity') === '1')).toBe(true)
  })

  it('sin bins lo dice en vez de dibujar un marco vacío', () => {
    render(<SoilHistogram histogram={{ bins: [] }} />)
    expect(screen.getByText('Sin datos para el histograma.')).toBeTruthy()
  })
})
