import { describe, it, expect } from 'vitest'
import {
  IMPORT_STATUS_LABELS,
  SESION_STATUS_LABELS,
  importStatusLabel,
  importStatusVariant,
  sesionStatusLabel,
  sesionStatusVariant,
  pointsCount,
} from './sesionLabels'

/**
 * El valor de este modulo es que exista UNA sola redaccion por estado. Los tests fijan
 * esa redaccion para que una regresion silenciosa (alguien vuelve a poner "Cargado" en
 * import_status) rompa aqui y no se descubra en pantalla.
 */

describe('etiquetas de importacion', () => {
  it('usa el juego canonico de Rendimiento', () => {
    expect(IMPORT_STATUS_LABELS.pending).toBe('Sin importar')
    expect(IMPORT_STATUS_LABELS.done).toBe('Completado')
    expect(IMPORT_STATUS_LABELS.pending_mapping).toBe('Mapeo pendiente')
  })

  it('no reutiliza "Cargado", que ya nombra el estado de sesion loaded', () => {
    expect(Object.values(IMPORT_STATUS_LABELS)).not.toContain('Cargado')
    expect(SESION_STATUS_LABELS.loaded).toBe('Cargado')
  })

  it('devuelve el codigo crudo ante un estado que el front no conoce', () => {
    expect(importStatusLabel('pending_review')).toBe('pending_review')
    expect(importStatusVariant('pending_review')).toBe('outline')
  })

  it('tolera null y undefined sin reventar', () => {
    expect(importStatusLabel(null)).toBe('—')
    expect(importStatusLabel(undefined)).toBe('—')
    expect(sesionStatusLabel(null)).toBe('—')
  })

  it('asigna variantes de Badge coherentes con la severidad', () => {
    expect(importStatusVariant('done')).toBe('success')
    expect(importStatusVariant('error')).toBe('danger')
    expect(importStatusVariant('pending_mapping')).toBe('warning')
    expect(sesionStatusVariant('cancelled')).toBe('danger')
    expect(sesionStatusVariant('completed')).toBe('success')
  })
})

describe('pointsCount', () => {
  // Aspersion y suelo lo sirven como string; rendimiento y NDVI como numero.
  it('normaliza las dos formas en que lo sirve el backend', () => {
    expect(pointsCount('320')).toBe(320)
    expect(pointsCount(320)).toBe(320)
  })

  it('trata ausencia y basura como cero, no como NaN', () => {
    expect(pointsCount(null)).toBe(0)
    expect(pointsCount(undefined)).toBe(0)
    expect(pointsCount('')).toBe(0)
    expect(pointsCount('n/a')).toBe(0)
  })
})
