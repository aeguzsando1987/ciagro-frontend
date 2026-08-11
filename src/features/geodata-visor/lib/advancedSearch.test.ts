/**
 * Tests de los criterios de búsqueda avanzada (fase AS).
 *
 * Se prueba la conversión URL ⇄ criterios ⇄ query porque es donde se cuelan los
 * errores que no se ven: una clave vacía que ensucia el enlace, un array que se
 * convierte en "filtrar por nada", o un `null` que debería significar "sin filtro"
 * y termina significando "ninguno".
 */
import { describe, expect, it } from 'vitest'
import {
  criteriaFromSearch,
  criteriaToQuery,
  EMPTY_CRITERIA,
  isAllowedSession,
  isSearchActive,
  searchFromCriteria,
  sessionIdsForPlot,
} from './advancedSearch'
import type { AdvancedSearchResult } from '../types'

describe('criteriaFromSearch', () => {
  it('parte de criterios vacíos cuando la URL no trae nada', () => {
    expect(criteriaFromSearch({})).toEqual(EMPTY_CRITERIA)
  })

  it('convierte las listas CSV en arrays', () => {
    const criteria = criteriaFromSearch({ producers: 'a,b', ranches: ' c , d ' })
    expect(criteria.producers).toEqual(['a', 'b'])
    expect(criteria.ranches).toEqual(['c', 'd'])
  })

  it('descarta tipos desconocidos en vez de propagarlos', () => {
    expect(criteriaFromSearch({ types: 'ndvi,inventado,soil_map' }).types).toEqual([
      'ndvi',
      'soil_map',
    ])
  })

  it('cae a la fecha programada ante un dateMode inválido', () => {
    expect(criteriaFromSearch({ dateMode: 'raro' as never }).dateMode).toBe('planned')
  })
})

describe('searchFromCriteria', () => {
  it('omite lo vacío para no dejar claves sueltas en la URL', () => {
    expect(searchFromCriteria(EMPTY_CRITERIA)).toEqual({
      from: undefined,
      to: undefined,
      dateMode: undefined,
      org: undefined,
      producers: undefined,
      ranches: undefined,
      plots: undefined,
      types: undefined,
    })
  })

  it('va y vuelve sin perder información', () => {
    const criteria = {
      ...EMPTY_CRITERIA,
      from: '2024-10-12',
      to: '2025-09-12',
      dateMode: 'actual' as const,
      producers: ['p1', 'p2'],
      types: ['aspersion' as const, 'ndvi' as const],
    }
    expect(criteriaFromSearch(searchFromCriteria(criteria))).toEqual(criteria)
  })
})

describe('isSearchActive', () => {
  it('no se activa solo por el modo de fecha', () => {
    // Si contara, el explorador entraría en modo resultados con un filtro que no filtra.
    expect(isSearchActive({ ...EMPTY_CRITERIA, dateMode: 'actual' })).toBe(false)
  })

  it('se activa con cualquier criterio real', () => {
    expect(isSearchActive({ ...EMPTY_CRITERIA, from: '2025-01-01' })).toBe(true)
    expect(isSearchActive({ ...EMPTY_CRITERIA, plots: ['x'] })).toBe(true)
    expect(isSearchActive({ ...EMPTY_CRITERIA, org: 'o1' })).toBe(true)
  })
})

describe('criteriaToQuery', () => {
  it('traduce los criterios a los nombres del endpoint', () => {
    expect(
      criteriaToQuery({
        ...EMPTY_CRITERIA,
        from: '2024-10-12',
        to: '2025-09-12',
        producers: ['p1'],
        ranches: ['r1', 'r2'],
        types: ['aspersion', 'ndvi'],
      })
    ).toEqual({
      date_from: '2024-10-12',
      date_to: '2025-09-12',
      producer: 'p1',
      ranch: 'r1,r2',
      type: 'aspersion,ndvi',
    })
  })

  it('omite el tipo cuando están los cuatro (equivale a no filtrar)', () => {
    const query = criteriaToQuery({
      ...EMPTY_CRITERIA,
      from: '2025-01-01',
      types: ['aspersion', 'phyto', 'ndvi', 'soil_map'],
    })
    expect(query.type).toBeUndefined()
  })
})

describe('filtrado de sesiones por resultado', () => {
  const result: AdvancedSearchResult = {
    count: 2,
    total: 2,
    truncated: false,
    plot_ids: ['plot-1'],
    producers: [
      {
        id: 'prod-1',
        name: 'Dr. Crampie',
        organization: { id: 'org-1', name: 'Org' },
        ranches: [
          {
            id: 'ranch-1',
            name: 'La tijera',
            plots: [
              {
                id: 'plot-1',
                code: 'P-001',
                sessions: [
                  { id: 's-asp', kind: 'aspersion', date: '2025-03-10', points_count: 5 },
                  { id: 's-ndvi', kind: 'ndvi', date: '2024-11-05', points_count: 1024 },
                ],
              },
            ],
          },
        ],
      },
    ],
  }

  it('devuelve los ids del tipo pedido para la parcela', () => {
    expect(sessionIdsForPlot(result, 'plot-1', 'ndvi')).toEqual(['s-ndvi'])
  })

  it('devuelve lista vacía para una parcela ausente del resultado', () => {
    expect(sessionIdsForPlot(result, 'plot-9', 'ndvi')).toEqual([])
  })

  it('devuelve null sin búsqueda, que los paneles leen como "sin filtro"', () => {
    expect(sessionIdsForPlot(null, 'plot-1', 'ndvi')).toBeNull()
  })

  it('isAllowedSession deja pasar todo cuando no hay filtro', () => {
    expect(isAllowedSession('cualquiera', null)).toBe(true)
    expect(isAllowedSession('s-ndvi', ['s-ndvi'])).toBe(true)
    expect(isAllowedSession('s-asp', ['s-ndvi'])).toBe(false)
    expect(isAllowedSession(undefined, ['s-ndvi'])).toBe(false)
  })
})
