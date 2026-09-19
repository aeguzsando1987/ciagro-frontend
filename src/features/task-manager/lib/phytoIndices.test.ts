import { describe, expect, it } from 'vitest'
import type { PhytoCheckpointProps } from '../hooks/usePhytoCheckPoints'
import { computeDiseaseIndex, computePestIndex } from './phytoIndices'

function cp(
  issueType: string | null,
  presence: PhytoCheckpointProps['presence_status'],
  qty: number | null
): PhytoCheckpointProps {
  return {
    id: crypto.randomUUID(),
    presence_status: presence,
    issue: issueType ? `Issue ${issueType}` : null,
    issue_type: issueType,
    stage: null,
    stage_display: null,
    qty,
    notes: null,
    captured_at: null,
    photo: null,
    photo_ref: null,
    pcp_oid: null,
  }
}

describe('computePestIndex', () => {
  it('marca verde cuando no hay plaga', () => {
    expect(computePestIndex([cp('Enfermedad', 'low', 1)], 1)).toEqual({
      level: 'none',
      qty: 0,
    })
  })

  it('con tolerancia 1: 1=menor, 2=mayor, 3+=alta', () => {
    expect(computePestIndex([cp('Plaga', 'low', 1)], 1).level).toBe('low')
    expect(computePestIndex([cp('Plaga', 'low', 2)], 1).level).toBe('medium')
    expect(computePestIndex([cp('Plaga', 'low', 3)], 1).level).toBe('high')
  })

  it('respeta una alerta crítica del backend aunque la cantidad sea baja', () => {
    expect(computePestIndex([cp('Plaga', 'critical', 1)], 3).level).toBe('high')
  })
})

describe('computeDiseaseIndex', () => {
  it('mapea ausencia/low/warning/critical a verde/amarillo/naranja/rojo', () => {
    expect(computeDiseaseIndex([])).toBe('none')
    expect(computeDiseaseIndex([cp('Enfermedad', 'low', null)])).toBe('low')
    expect(computeDiseaseIndex([cp('Enfermedad', 'warning', null)])).toBe('medium')
    expect(computeDiseaseIndex([cp('Enfermedad', 'critical', null)])).toBe('high')
  })
})
