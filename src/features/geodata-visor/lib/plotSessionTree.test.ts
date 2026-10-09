import { describe, expect, it } from 'vitest'

import type { SessionKind } from '../types'
import {
  buildPlotTree,
  buildProgramTree,
  cycleLabel,
  incompleteSessionsNotice,
  sessionIdsOf,
  type TreeSession,
} from './plotSessionTree'

let seq = 0
function s(kind: SessionKind, date: string | null, cycle: string | null = 'Primavera-Verano-2026'): TreeSession {
  seq += 1
  return { id: `s${seq}`, kind, date, points_count: 1, cycle }
}

describe('buildPlotTree', () => {
  it('mapeos van a Generales aunque su subprograma tenga temporada', () => {
    const tree = buildPlotTree([s('soil_map', '2026-03-01'), s('soil_map', '2017-05-01', null)])
    expect(tree.cycles).toEqual([])
    expect(tree.generales.map((y) => y.label)).toEqual(['Mapeos (2026)', 'Mapeos (2017)'])
  })

  it('no genera grupos vacios', () => {
    const tree = buildPlotTree([s('aspersion', '2026-04-01')])
    expect(tree.generales).toEqual([])
    expect(tree.cycles).toHaveLength(1)
    expect(tree.cycles[0]!.types.map((t) => t.kind)).toEqual(['aspersion'])
  })

  it('ordena los tipos dentro del ciclo en el orden fijo', () => {
    const tree = buildPlotTree([
      s('yield_map', '2026-09-01'),
      s('phyto', '2026-05-01'),
      s('aspersion', '2026-04-01'),
      s('planting_map', '2026-03-01'),
      s('ndvi', '2026-06-01'),
    ])
    expect(tree.cycles[0]!.types.map((t) => t.label)).toEqual([
      'Seguimiento a campo', 'Aplicaciones', 'Fitosanitario', 'Siembra', 'Rendimiento',
    ])
  })

  it('ordena ciclos por su sesion mas reciente y deja Sin ciclo al final', () => {
    const tree = buildPlotTree([
      s('ndvi', '2025-11-01', 'Verano-Invierno-2025'),
      s('ndvi', '2026-07-01', 'Primavera-Verano-2026'),
      s('aspersion', '2027-01-01', null),
      s('aspersion', '2026-01-01', 'Invierno-2026'),
    ])
    expect(tree.cycles.map((c) => c.label)).toEqual([
      'Ciclo productivo Primavera-Verano 2026',
      'Ciclo productivo Invierno 2026',
      'Ciclo productivo Verano-Invierno 2025',
      'Sin ciclo',
    ])
  })

  it('dos subprogramas con la misma temporada caen en un solo ciclo', () => {
    const tree = buildPlotTree([
      s('ndvi', '2026-05-01', 'Primavera-Verano-2026'),
      s('ndvi', '2026-06-01', ' Primavera-Verano-2026 '),
    ])
    expect(tree.cycles).toHaveLength(1)
    expect(tree.cycles[0]!.types[0]!.sessions).toHaveLength(2)
  })

  it('el orden de las estaciones distingue temporadas', () => {
    const tree = buildPlotTree([
      s('ndvi', '2026-05-01', 'Primavera-Verano-2026'),
      s('ndvi', '2026-06-01', 'Verano-Primavera-2026'),
    ])
    expect(tree.cycles).toHaveLength(2)
  })

  it('cycle vacio cuenta como Sin ciclo', () => {
    const tree = buildPlotTree([s('ndvi', '2026-05-01', ''), s('ndvi', '2026-04-01', null)])
    expect(tree.cycles.map((c) => c.label)).toEqual(['Sin ciclo'])
  })

  it('Generales agrupa por año desc, Sin fecha al final y sesiones por fecha desc', () => {
    const a = s('soil_map', '2025-03-01')
    const b = s('soil_map', '2026-01-10')
    const c = s('soil_map', null)
    const d = s('soil_map', '2026-08-20')
    const years = buildPlotTree([a, b, c, d]).generales
    expect(years.map((y) => y.label)).toEqual(['Mapeos (2026)', 'Mapeos (2025)', 'Mapeos (Sin fecha)'])
    expect(years[0]!.sessions.map((x) => x.id)).toEqual([d.id, b.id])
  })

  it('dentro del ciclo el tipo lleva sus sesiones directo, sin nivel de año', () => {
    const a = s('ndvi', '2025-12-20')
    const b = s('ndvi', null)
    const c = s('ndvi', '2026-02-10')
    const type = buildPlotTree([a, b, c]).cycles[0]!.types[0]!
    expect(type).not.toHaveProperty('years')
    expect(type.sessions.map((x) => x.id)).toEqual([c.id, a.id, b.id])
  })

  it('las claves son unicas en todo el arbol', () => {
    const tree = buildPlotTree([
      s('soil_map', '2026-01-01'),
      s('ndvi', '2026-01-01', 'Primavera-2026'),
      s('ndvi', '2026-01-01', null),
      s('aspersion', null, null),
    ])
    const keys = [
      ...tree.generales.map((y) => y.key),
      ...tree.cycles.flatMap((c) => [
        c.key,
        ...c.types.map((t) => t.key),
      ]),
    ]
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('buildProgramTree', () => {
  it('omite el nivel de ciclo y conserva Generales y tipos', () => {
    const tree = buildProgramTree([
      s('soil_map', '2026-02-01'),
      s('aspersion', '2026-04-01'),
      s('ndvi', '2026-05-01'),
    ])
    expect(tree.generales.map((y) => y.label)).toEqual(['Mapeos (2026)'])
    expect(tree.types.map((t) => t.label)).toEqual(['Seguimiento a campo', 'Aplicaciones'])
  })
})

describe('cycleLabel', () => {
  it('antepone Ciclo productivo y cambia el guion del año por espacio', () => {
    expect(cycleLabel('Primavera-Verano-2026')).toBe('Ciclo productivo Primavera-Verano 2026')
    expect(cycleLabel('Invierno-2025')).toBe('Ciclo productivo Invierno 2025')
    expect(cycleLabel(null)).toBe('Sin ciclo')
  })
})

describe('sessionIdsOf', () => {
  it('reune los ids de todo lo que cuelga del nodo', () => {
    const a = s('ndvi', '2026-05-01')
    const b = s('aspersion', '2025-05-01')
    const cycle = buildPlotTree([a, b]).cycles[0]!
    expect(sessionIdsOf(cycle)).toEqual(new Set([a.id, b.id]))
    expect(sessionIdsOf(cycle.types[1]!)).toEqual(new Set([b.id]))
  })
})

/**
 * FASE PAG (GAP-PAG-1): caso real de produccion. Pivote_1_DM tiene 92 sesiones NDVI en
 * cuatro ciclos; con solo las 25 mas recientes el Visor mostraba dos.
 */
describe('historial completo de la parcela', () => {
  const ciclos: Array<[string, number, string]> = [
    ['Primavera-Invierno-2023', 33, '2023'],
    ['Primavera-Invierno-2024', 22, '2024'],
    ['Primavera-Invierno-2025', 25, '2025'],
    ['Primavera-Verano-2026', 12, '2026'],
  ]
  const sesiones = ciclos.flatMap(([cycle, n, year]) =>
    Array.from({ length: n }, (_, i) =>
      s('ndvi', `${year}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`, cycle)
    )
  )

  it('con las 92 sesiones aparecen los cuatro ciclos, del mas reciente al mas antiguo', () => {
    const tree = buildPlotTree(sesiones)
    expect(tree.cycles.map((c) => c.label)).toEqual([
      'Ciclo productivo Primavera-Verano 2026',
      'Ciclo productivo Primavera-Invierno 2025',
      'Ciclo productivo Primavera-Invierno 2024',
      'Ciclo productivo Primavera-Invierno 2023',
    ])
    expect(tree.cycles.map((c) => c.types[0]!.sessions.length)).toEqual([12, 25, 22, 33])
  })

  it('con solo las 25 mas recientes se perdian dos ciclos (la regresion que se protege)', () => {
    const recientes = [...sesiones].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 25)
    expect(buildPlotTree(recientes).cycles).toHaveLength(2)
  })
})

describe('incompleteSessionsNotice', () => {
  it('no avisa cuando llegaron todas', () => {
    expect(incompleteSessionsNotice(92, 0)).toBeNull()
  })

  it('dice cuantas se muestran de cuantas existen', () => {
    expect(incompleteSessionsNotice(92, 67)).toBe('Se muestran 25 de 92 sesiones.')
  })
})
