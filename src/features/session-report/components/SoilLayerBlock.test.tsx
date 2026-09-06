/**
 * Bloque de capas del reporteador (RS-13).
 *
 * El caso que importa es el categorico: una clase textural no tiene media ni
 * percentiles, y mostrarlos en "—" es el mismo defecto que ya se corrigio en el PDF.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockStats = vi.fn()

const mockOptions = vi.fn()
vi.mock('./SoilLayerPicker', () => ({
  SoilLayerPicker: ({ onChange }: { onChange: (k: string) => void }) => (
    <button onClick={() => onChange('ph')}>picker</button>
  ),
  useSoilLayerOptions: () => mockOptions(),
}))
vi.mock('../hooks/useSoilLayerStats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useSoilLayerStats')>()),
  useSoilLayerStats: () => mockStats(),
}))

import { SoilLayerBlock } from './SoilLayerBlock'

function layer(kind: 'numeric' | 'category', unit = '') {
  return {
    key: 'x', label: 'Capa', field: 'X', group: 'G', unit, kind,
    class_count: 7, break_count: 6, palette: [],
  }
}

function capa(key: string, kind: 'numeric' | 'category' = 'numeric') {
  return { key, label: key, field: key, group: 'G', unit: '', kind,
           class_count: 3, break_count: 2, palette: [] }
}

describe('SoilLayerBlock', () => {
  beforeEach(() => {
    // Por defecto sin catalogo: los tests que no prueban el arranque eligen la
    // capa a mano con el picker mockeado.
    mockOptions.mockReturnValue({ groups: [], layers: [], isLoading: false })
  })

  /**
   * El reporte abre en la MISMA capa que el visor: si empezara en otra, el usuario
   * llegaria al reporte mirando una variable distinta de la que venia viendo.
   */
  describe('capa de arranque', () => {
    it('abre en countrate cuando la sesión la tiene', () => {
      mockOptions.mockReturnValue({
        groups: [], layers: [capa('ph'), capa('countrate'), capa('clay')], isLoading: false,
      })
      const onPrepare = vi.fn()
      mockStats.mockReturnValue({ data: undefined, isLoading: true, isError: false })
      render(<SoilLayerBlock headerId="h1" onPrepare={onPrepare} />)

      expect(onPrepare).toHaveBeenCalledWith('countrate')
    })

    it('sin countrate cae a la primera con datos, no deja el bloque vacío', () => {
      mockOptions.mockReturnValue({
        groups: [], layers: [capa('ph'), capa('clay')], isLoading: false,
      })
      const onPrepare = vi.fn()
      mockStats.mockReturnValue({ data: undefined, isLoading: true, isError: false })
      render(<SoilLayerBlock headerId="h1" onPrepare={onPrepare} />)

      expect(onPrepare).toHaveBeenCalledWith('ph')
    })

    it('no vuelve a preparar una capa que ya está lista', () => {
      // Abrir el reporte no debe recalcular lo que ya se pago.
      mockOptions.mockReturnValue({ groups: [], layers: [capa('countrate')], isLoading: false })
      const onPrepare = vi.fn()
      mockStats.mockReturnValue({ data: undefined, isLoading: true, isError: false })
      render(
        <SoilLayerBlock
          headerId="h1"
          onPrepare={onPrepare}
          frozenLayers={{ countrate: { breaks: [1, 2], classes: [] } }}
        />
      )

      expect(onPrepare).not.toHaveBeenCalled()
    })

    it('sin permiso de escritura no prepara nada al abrir', () => {
      // `onPrepare` ausente = solo lectura: se ve lo congelado, no se escribe.
      mockOptions.mockReturnValue({ groups: [], layers: [capa('countrate')], isLoading: false })
      mockStats.mockReturnValue({ data: undefined, isLoading: true, isError: false })
      expect(() => render(<SoilLayerBlock headerId="h1" />)).not.toThrow()
    })
  })

  it('capa numérica: publica los descriptivos con su unidad', () => {
    mockStats.mockReturnValue({
      data: {
        header_id: 'h1', layer: layer('numeric', '%'),
        points_count: 100, count: 90, nulls: 10,
        mean: 40.52, min: 33.03, max: 47.61, stddev: 2.23,
        median: 40.1, p10: 36.4, p90: 44.8, cv: 0.055,
        histogram: { bin_count: 0, bins: [] },
      },
      isLoading: false, isError: false,
    })
    render(<SoilLayerBlock headerId="h1" />)

    expect(screen.getByText('40.52 %')).toBeTruthy()
    expect(screen.getByText('Mediana')).toBeTruthy()
    expect(screen.getByText('Coef. variación')).toBeTruthy()
    // Los nulos se dicen: 90 de 100 no es lo mismo que 100 de 100.
    expect(screen.getByText(/10 de 100 muestras sin valor/)).toBeTruthy()
  })

  it('capa categórica: reparto por clase, sin media ni percentiles', () => {
    mockStats.mockReturnValue({
      data: {
        header_id: 'h1', layer: layer('category'),
        points_count: 100, count: 100, nulls: 0,
        values: [
          { value: 'franco', count: 60 },
          { value: 'arcilloso', count: 40 },
        ],
      },
      isLoading: false, isError: false,
    })
    render(<SoilLayerBlock headerId="h1" />)

    expect(screen.getByText('franco')).toBeTruthy()
    expect(screen.getByText('60')).toBeTruthy()
    expect(screen.queryByText('Media')).toBeNull()
    expect(screen.queryByText('Mediana')).toBeNull()
    expect(screen.queryByText('Coef. variación')).toBeNull()
  })

  /**
   * El PDF muestra lo mas importante del reporte, y el reporte DEL SISTEMA tiene
   * que mostrar lo mismo. Sin esta tabla, la clasificacion —el corazon del
   * reporte— solo se veia abriendo el PDF.
   */
  describe('clasificación', () => {
    const NUMERICA = {
      header_id: 'h1',
      layer: { ...layer('numeric', '%'), palette: ['#a00', '#0a0'] },
      points_count: 100, count: 100, nulls: 0,
      mean: 1, min: 0, max: 2, stddev: 1, median: 1, p10: 0, p90: 2, cv: 1,
      histogram: { bin_count: 0, bins: [] },
    }

    it('publica las dos bases, como el PDF', () => {
      mockStats.mockReturnValue({ data: NUMERICA, isLoading: false, isError: false })
      render(
        <SoilLayerBlock
          headerId="h1"
          frozenLayers={{
            ph: {
              classes: [
                {
                  index: 0, label: '1–2',
                  by_points: { count: 60, pct: 60, area_ha: 6 },
                  by_area: { pct: 25, area_ha: 2.5 },
                },
                {
                  index: 1, label: '0–1',
                  by_points: { count: 40, pct: 40, area_ha: 4 },
                  by_area: { pct: 75, area_ha: 7.5 },
                },
              ],
            },
          }}
        />
      )

      // El selector esta mockeado: hay que elegir la capa para que el bloque la use.
      fireEvent.click(screen.getByText('picker'))

      expect(screen.getByText('1–2')).toBeTruthy()
      // Que Muestras y Superficie difieran es el dato util: esa clase ocupa menos
      // terreno del que sugieren sus muestras. Se comprueban los valores de
      // Superficie, que son los que faltaban.
      expect(screen.getByText('25')).toBeTruthy()
      expect(screen.getByText('75')).toBeTruthy()
      expect(screen.getByText('2.5')).toBeTruthy()
      expect(screen.queryByText(/sin el reparto por superficie/)).toBeNull()
    })

    it('avisa cuando la capa se preparó sin superficie, en vez de dejar guiones', () => {
      mockStats.mockReturnValue({ data: NUMERICA, isLoading: false, isError: false })
      render(
        <SoilLayerBlock
          headerId="h1"
          frozenLayers={{
            ph: {
              classes: [
                { index: 0, label: '1–2', by_points: { count: 60, pct: 60, area_ha: 6 } },
                { index: 1, label: '0–1', by_points: { count: 40, pct: 40, area_ha: 4 } },
              ],
            },
          }}
        />
      )

      fireEvent.click(screen.getByText('picker'))

      expect(screen.getByText(/se preparó sin el reparto por superficie/)).toBeTruthy()
    })

    it('una capa sin preparar lo dice, no muestra una tabla vacía', () => {
      mockStats.mockReturnValue({ data: NUMERICA, isLoading: false, isError: false })
      render(<SoilLayerBlock headerId="h1" />)
      fireEvent.click(screen.getByText('picker'))

      expect(screen.getByText(/aún no se ha preparado/)).toBeTruthy()
    })
  })

  describe('espera y cortes', () => {
    const NUM = {
      header_id: 'h1',
      layer: { ...layer('numeric', '%'), palette: ['#a00', '#0a0', '#00a'] },
      points_count: 100, count: 100, nulls: 0,
      mean: 1, min: 0, max: 9, stddev: 1, median: 1, p10: 0, p90: 2, cv: 1,
      histogram: {
        bin_count: 3,
        bins: [
          { lower: 0, upper: 3, count: 5 },
          { lower: 3, upper: 6, count: 9 },
          { lower: 6, upper: 9, count: 2 },
        ],
      },
    }

    it('mientras prepara muestra el indicador del visor, no un texto suelto', () => {
      mockStats.mockReturnValue({ data: NUM, isLoading: false, isError: false })
      render(<SoilLayerBlock headerId="h1" preparing="ph" />)
      fireEvent.click(screen.getByText('picker'))

      // `role="status"` lo pone LoadingState, que es el que envuelve al GpaLoader.
      expect(screen.getByRole('status')).toBeTruthy()
      expect(screen.getByText(/Preparando la capa/)).toBeTruthy()
    })

    it('el histograma marca los cortes de las clases, como el PDF', () => {
      // Antes solo el PDF los dibujaba: en pantalla no se veia donde cae cada clase.
      mockStats.mockReturnValue({ data: NUM, isLoading: false, isError: false })
      const { container } = render(
        <SoilLayerBlock
          headerId="h1"
          frozenLayers={{ ph: { breaks: [3, 6], classes: [] } }}
        />
      )
      fireEvent.click(screen.getByText('picker'))

      // Dos cortes = dos lineas punteadas. NUNCA siete fijas (H8).
      expect(container.querySelectorAll('line[stroke-dasharray]')).toHaveLength(2)
    })

    it('una capa sin preparar no inventa cortes', () => {
      mockStats.mockReturnValue({ data: NUM, isLoading: false, isError: false })
      const { container } = render(<SoilLayerBlock headerId="h1" />)
      fireEvent.click(screen.getByText('picker'))

      expect(container.querySelectorAll('line[stroke-dasharray]')).toHaveLength(0)
    })
  })

  it('sin capa elegida no pide nada ni muestra estadísticos', () => {
    mockStats.mockReturnValue({ data: undefined, isLoading: false, isError: false })
    render(<SoilLayerBlock headerId="h1" />)

    expect(screen.queryByText('Muestras')).toBeNull()
    expect(screen.queryByText(/Cargando estadísticos/)).toBeNull()
  })
})
