import type { PhytoCheckpointProps } from '../hooks/usePhytoCheckPoints'

export type PhytoIndexLevel = 'none' | 'low' | 'medium' | 'high'

export const PHYTO_INDEX_COLOR: Record<PhytoIndexLevel, string> = {
  none: '#16a34a',
  low: '#facc15',
  medium: '#f97316',
  high: '#dc2626',
}

export const PEST_INDEX_LABEL: Record<PhytoIndexLevel, string> = {
  none: 'Sin plaga',
  low: 'Severidad menor',
  medium: 'Severidad mayor',
  high: 'Severidad alta',
}

export const DISEASE_INDEX_LABEL: Record<PhytoIndexLevel, string> = {
  none: 'Sin presencia',
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}

const LEVEL_RANK: Record<PhytoIndexLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
}

function normalizedType(item: PhytoCheckpointProps): string {
  return item.issue_type?.trim().toLowerCase() ?? ''
}

function isPest(item: PhytoCheckpointProps): boolean {
  return normalizedType(item) === 'plaga'
}

function isDisease(item: PhytoCheckpointProps): boolean {
  return normalizedType(item) === 'enfermedad'
}

function itemPresenceLevel(item: PhytoCheckpointProps): PhytoIndexLevel {
  if (item.presence_status === 'critical') return 'high'
  if (item.presence_status === 'warning') return 'medium'
  return 'low'
}

function maxLevel(a: PhytoIndexLevel, b: PhytoIndexLevel): PhytoIndexLevel {
  return LEVEL_RANK[a] >= LEVEL_RANK[b] ? a : b
}

/**
 * Índice P · Plagas.
 *
 * - Sin plaga: no existe ningún hallazgo de tipo Plaga.
 * - Severidad menor: existe plaga pero la cantidad total está dentro de la tolerancia.
 * - Severidad mayor: supera la tolerancia por 1, o el backend marcó warning.
 * - Severidad alta: supera la tolerancia por 2+ o existe un hallazgo critical.
 *
 * Cuando qty viene null en una captura cualitativa de plaga, cuenta como 1 presencia.
 */
export function computePestIndex(
  items: PhytoCheckpointProps[],
  tolerance: number
): { level: PhytoIndexLevel; qty: number } {
  const pests = items.filter(isPest)
  if (pests.length === 0) return { level: 'none', qty: 0 }

  const qty = pests.reduce((total, item) => {
    const amount = item.qty == null ? 1 : Math.max(0, item.qty)
    return total + amount
  }, 0)

  if (qty <= 0) return { level: 'none', qty: 0 }

  const normalizedTolerance = Math.max(0, Math.trunc(tolerance))
  let level: PhytoIndexLevel

  if (normalizedTolerance === 0) {
    level = qty === 1 ? 'medium' : 'high'
  } else if (qty <= normalizedTolerance) {
    level = 'low'
  } else if (qty === normalizedTolerance + 1) {
    level = 'medium'
  } else {
    level = 'high'
  }

  for (const item of pests) {
    level = maxLevel(level, itemPresenceLevel(item))
  }

  return { level, qty }
}

/**
 * Índice E · Enfermedades.
 *
 * No usa la tolerancia configurable de plagas. Se deriva del presence_status que ya
 * calcula el backend/catálogo para cada enfermedad:
 *   sin enfermedad -> verde; low -> baja; warning -> media; critical -> alta.
 */
export function computeDiseaseIndex(items: PhytoCheckpointProps[]): PhytoIndexLevel {
  const diseases = items.filter(isDisease)
  if (diseases.length === 0) return 'none'

  return diseases.reduce<PhytoIndexLevel>(
    (worst, item) => maxLevel(worst, itemPresenceLevel(item)),
    'none'
  )
}
