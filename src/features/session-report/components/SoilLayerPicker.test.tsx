/**
 * Selector de capa del reporteador (RS-13).
 *
 * Lo que se prueba es lo que puede romperse en silencio: que oculte las capas sin
 * datos y que respete el orden del CATALOGO DEL BACKEND. Si algun dia alguien lo
 * hace leer `soilMapLayers.ts`, el orden cambia y nadie se entera sin este test.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockCatalog = vi.fn()
const mockStats = vi.fn()

vi.mock('../hooks/useSoilLayerCatalog', () => ({
  useSoilLayerCatalog: () => mockCatalog(),
}))
vi.mock('@/features/task-manager/hooks/useSoilMapVariableStats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/task-manager/hooks/useSoilMapVariableStats')>()),
  useSoilMapVariableStats: () => mockStats(),
}))

import { SoilLayerPicker } from './SoilLayerPicker'

const CATALOGO = {
  count: 4,
  groups: [
    {
      group: 'Propiedades físicas',
      layers: [
        meta('ph', 'pH del suelo', 'pH', ''),
        meta('clay', 'Arcilla', 'Clay', '%'),
      ],
    },
    {
      group: 'Macronutrientes',
      layers: [meta('potassium', 'Potasio', 'K', 'ppm')],
    },
    {
      group: 'Micronutrientes',
      layers: [meta('iron', 'Hierro', 'Fe', 'ppm')],
    },
  ],
}

function meta(key: string, label: string, field: string, unit: string) {
  return {
    key, label, field, unit,
    group: '', kind: 'numeric' as const, class_count: 7, break_count: 6, palette: [],
  }
}

/** `variable-stats` cuenta por NOMBRE DE CAMPO, no por la clave de la capa. */
function conDatos(fields: Record<string, number>) {
  return {
    data: {
      header_id: 'h1', points_count: 100,
      variables: Object.entries(fields).map(([key, count]) => ({
        key, label: key, count, mean: null, min: null, max: null, stddev: null,
      })),
      text_variables: [],
    },
    isLoading: false,
  }
}

function renderPicker() {
  return render(
    <SoilLayerPicker headerId="h1" value={null} onChange={vi.fn()} />
  )
}

describe('SoilLayerPicker', () => {
  it('mientras carga no ofrece un desplegable vacío', () => {
    mockCatalog.mockReturnValue({ data: undefined, isLoading: true })
    mockStats.mockReturnValue({ data: undefined, isLoading: true })
    renderPicker()

    expect(screen.getByText('Cargando capas…')).toBeTruthy()
  })

  it('oculta las capas sin datos y los grupos que se quedan vacíos', () => {
    mockCatalog.mockReturnValue({ data: CATALOGO, isLoading: false })
    // Potasio con 0 muestras y Hierro ausente del endpoint: ninguno debe salir, y
    // Micronutrientes se queda sin capas, asi que tampoco sale el grupo.
    mockStats.mockReturnValue(conDatos({ pH: 100, Clay: 80, K: 0 }))
    renderPicker()

    expect(screen.getByRole('option', { name: 'pH del suelo' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Arcilla (%)' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /Potasio/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /Hierro/ })).toBeNull()

    const grupos = screen.getByRole('combobox').querySelectorAll('optgroup')
    expect([...grupos].map((g) => g.getAttribute('label'))).toEqual(['Propiedades físicas'])
  })

  it('conserva el orden de grupos del catálogo del backend', () => {
    mockCatalog.mockReturnValue({ data: CATALOGO, isLoading: false })
    mockStats.mockReturnValue(conDatos({ pH: 1, Clay: 1, K: 1, Fe: 1 }))
    renderPicker()

    const grupos = screen.getByRole('combobox').querySelectorAll('optgroup')
    expect([...grupos].map((g) => g.getAttribute('label'))).toEqual([
      'Propiedades físicas',
      'Macronutrientes',
      'Micronutrientes',
    ])
  })

  it('sin ninguna capa con datos lo dice en vez de mostrar un selector vacío', () => {
    mockCatalog.mockReturnValue({ data: CATALOGO, isLoading: false })
    mockStats.mockReturnValue(conDatos({ pH: 0, Clay: 0, K: 0, Fe: 0 }))
    renderPicker()

    expect(screen.getByText('La sesión no tiene capas con datos.')).toBeTruthy()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
