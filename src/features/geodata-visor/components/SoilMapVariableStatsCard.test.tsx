import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SoilMapVariableStatsCard } from './SoilMapVariableStatsCard'
import type { SoilMapVariableStatsResponse } from '@/features/task-manager/hooks/useSoilMapVariableStats'

const STATS: SoilMapVariableStatsResponse = {
  header_id: 'soil-1',
  points_count: 16944,
  variables: [
    { key: 'pH', label: 'pH', count: 16944, mean: 7.9664, min: 7.7096, max: 8.226, stddev: 0.0737 },
    // Etiqueta cruda del backend, sin unidad: la bonita vive en soilMapLayers.ts.
    {
      key: 'lim_inf_CC',
      label: 'lim inf CC',
      count: 0,
      mean: null,
      min: null,
      max: null,
      stddev: null,
    },
    // Variable que existe en los datos pero NO tiene capa en el catálogo.
    { key: 'Leak', label: 'Leak', count: 10, mean: 1, min: 0, max: 2, stddev: 0.5 },
    // Con unidad en el catálogo (mg/100g), que el endpoint no conoce.
    { key: 'Ca', label: 'Ca', count: 100, mean: 4519.47, min: 4000, max: 5000, stddev: 120.5 },
  ],
  text_variables: [
    {
      key: 'classtexture',
      label: 'classtexture',
      count: 16944,
      values: [
        { value: 'Arcilloso', count: 16787 },
        { value: 'Franco', count: 124 },
        { value: 'Franco limoso arcilloso', count: 33 },
      ],
    },
    { key: 'compfisic', label: 'compfisic', count: 0, values: [] },
  ],
}

function renderCard(props: Partial<Parameters<typeof SoilMapVariableStatsCard>[0]> = {}) {
  return render(
    <SoilMapVariableStatsCard
      activeField="pH"
      activeLabel="pH del suelo"
      stats={STATS}
      isLoading={false}
      {...props}
    />
  )
}

describe('SoilMapVariableStatsCard', () => {
  it('arranca colapsada: solo el titulo, sin numeros', () => {
    renderCard()

    expect(screen.getByText('Estadísticas · pH del suelo')).toBeInTheDocument()
    expect(screen.queryByText('Media')).toBeNull()
    expect(screen.getByRole('button', { expanded: false })).toBeInTheDocument()
  })

  it('despliega las cinco metricas de la capa activa al pulsar', () => {
    renderCard()

    fireEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText('Media')).toBeInTheDocument()
    expect(screen.getByText('7.97')).toBeInTheDocument()
    expect(screen.getByText('7.71')).toBeInTheDocument()
    expect(screen.getByText('8.23')).toBeInTheDocument()
    expect(screen.getByText('16,944')).toBeInTheDocument()
  })

  it('muestra la unidad del catalogo del front, que el endpoint no conoce', () => {
    renderCard({ activeField: 'Ca', activeLabel: 'Ca del suelo' })
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    // El endpoint devuelve 4519.47 a secas; la unidad sale de soilMapLayers.ts.
    expect(screen.getByText('4,519.47 mg/100g')).toBeInTheDocument()
  })

  it('avisa cuando la variable activa no aparece en el resumen', () => {
    renderCard({ activeField: 'Zn', activeLabel: 'ZN del suelo' })
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText(/no tiene valores en la sesión/)).toBeInTheDocument()
  })

  it('en una capa categorica informa el reparto y no inventa una media', () => {
    // Es lo que el desarrollador pidio: en una variable no numerica lo unico
    // informativo es cuantas muestras hay de cada categoria.
    renderCard({ activeField: 'classtexture', activeLabel: 'Clase textural' })

    fireEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText(/Variable categórica/)).toBeInTheDocument()
    expect(screen.queryByText('Media')).toBeNull()
    expect(screen.getByText('Arcilloso')).toBeInTheDocument()
    expect(screen.getByText(/16,787/)).toBeInTheDocument()
    expect(screen.getByText(/99.1%/)).toBeInTheDocument()
    expect(screen.getByText('Franco')).toBeInTheDocument()
  })

  it('el porcentaje se reparte sobre los puntos CON valor, no sobre el total', () => {
    // Si la mitad de los puntos no trae clase textural, repartir sobre el total de
    // la sesion daria porcentajes que no suman 100 y se leerian como un error.
    renderCard({
      activeField: 'classtexture',
      activeLabel: 'Clase textural',
      stats: {
        ...STATS,
        points_count: 200,
        text_variables: [
          {
            key: 'classtexture',
            label: 'classtexture',
            count: 100,
            values: [
              { value: 'Arcilloso', count: 75 },
              { value: 'Franco', count: 25 },
            ],
          },
        ],
      },
    })
    fireEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText(/75%/)).toBeInTheDocument()
    expect(screen.getByText(/25%/)).toBeInTheDocument()
  })

  it('una categorica sin categorias lo dice en vez de mostrar una lista vacia', () => {
    renderCard({ activeField: 'compfisic', activeLabel: 'Compactación física' })

    fireEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText('Sin categorías en la sesión.')).toBeInTheDocument()
  })

  it('avisa cuando la variable activa no tiene valores', () => {
    renderCard({ activeField: 'lim_inf_CC', activeLabel: 'Límite inferior CC' })

    fireEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText('Media')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('el resumen completo lista numericas y categoricas', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas las variables' }))

    expect(screen.getByText('Resumen estadístico de la sesión')).toBeInTheDocument()
    expect(screen.getByText(/16,944 puntos importados/)).toBeInTheDocument()
    // Etiqueta del catalogo, no la cruda del backend.
    expect(screen.getByText('Límite inferior CC')).toBeInTheDocument()
    expect(screen.queryByText('lim inf CC')).toBeNull()
    expect(screen.getByText('Clase textural')).toBeInTheDocument()
    // El reparto ocupa las celdas donde irian media, minimo, maximo y desviacion.
    expect(screen.getByText(/Arcilloso/)).toBeInTheDocument()
    expect(screen.getByText('sin categorías')).toBeInTheDocument()
  })

  it('incluye las variables que no tienen capa en el catalogo', () => {
    // Leak, Loam, NO3N y N existen en los datos pero no son capas pintables. El
    // resumen de la sesion no puede dejarlas fuera: caen a la etiqueta del backend.
    renderCard()
    fireEvent.click(screen.getByRole('button', { expanded: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver todas las variables' }))

    expect(screen.getByText('Leak')).toBeInTheDocument()
  })

  it('mientras carga no muestra numeros a medias', () => {
    renderCard({ stats: undefined, isLoading: true })

    fireEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    expect(screen.queryByText('Media')).toBeNull()
  })

  it('informa si el resumen no se pudo cargar', () => {
    renderCard({ stats: undefined, isLoading: false })

    fireEvent.click(screen.getByRole('button', { expanded: false }))

    expect(screen.getByText('No se pudo cargar el resumen.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver todas las variables' })).toBeNull()
  })
})
