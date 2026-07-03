import { describe, it, expect } from 'vitest'
import { resolveSemaforoColor, semaforoRows, SEMAFORO_ORDER } from './semaforo'
import type { StatsSnapshot } from '../types'

describe('resolveSemaforoColor', () => {
  it('mapea los nombres del backend a hex', () => {
    expect(resolveSemaforoColor('amarillo')).toBe('#eab308')
    expect(resolveSemaforoColor('verde')).toBe('#5bb304')
    expect(resolveSemaforoColor('verde_amarillento')).toBe('#84cc16')
    expect(resolveSemaforoColor('azul_electrico')).toBe('#4052D6')
    expect(resolveSemaforoColor('rojo')).toBe('#dc2626')
  })

  it('deja pasar un hex tal cual', () => {
    expect(resolveSemaforoColor('#123456')).toBe('#123456')
  })

  it('usa fallback ante nombre desconocido o vacío', () => {
    expect(resolveSemaforoColor('turquesa')).toBe('#94a3b8')
    expect(resolveSemaforoColor(null)).toBe('#94a3b8')
    expect(resolveSemaforoColor(undefined)).toBe('#94a3b8')
  })
})

describe('semaforoRows', () => {
  const stats: StatsSnapshot = {
    semaforo: {
      baja: { color: 'amarillo', area_ha: '0.1785', pct_area_total: 2.41 },
      excelente: { color: 'verde', area_ha: 3.3525, pct_area_total: '45.27' },
      sobredosis: { color: 'azul_electrico', area_ha: 0.1081, pct_area_total: 1.46 },
    },
  }

  it('respeta el orden canónico y omite buckets ausentes', () => {
    const rows = semaforoRows(stats)
    expect(rows.map((r) => r.key)).toEqual(['sobredosis', 'excelente', 'baja'])
  })

  it('resuelve color y coacciona números (string o number)', () => {
    const rows = semaforoRows(stats)
    const baja = rows.find((r) => r.key === 'baja')!
    expect(baja.color).toBe('#eab308')
    expect(baja.areaHa).toBeCloseTo(0.1785)
    expect(baja.pctAreaTotal).toBeCloseTo(2.41)
    const exc = rows.find((r) => r.key === 'excelente')!
    expect(exc.pctAreaTotal).toBeCloseTo(45.27)
  })

  it('devuelve vacío cuando no hay semáforo', () => {
    expect(semaforoRows({})).toEqual([])
  })

  it('el orden canónico tiene los 5 buckets', () => {
    expect(SEMAFORO_ORDER).toHaveLength(5)
  })
})
