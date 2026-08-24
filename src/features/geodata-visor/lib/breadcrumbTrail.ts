import type { VisorSelection, VisorLevel } from '../types'

/**
 * Ruta de ancestros de la selección, para las migas de pan del Visor.
 *
 * El explorador puede ocultar niveles cuando el alcance del usuario no ofrece elección
 * ahí, y el árbol se desplaza al navegar, así que mirando la izquierda no siempre se
 * sabe dónde se está. Las migas lo dicen siempre y de un vistazo:
 *
 *   Organización -> CIAgro -> Agrounidad -> Rancho -> Parcela -> Sesión
 *
 * Cada escalón es navegable: pulsar uno sube a ese nivel. Eso hace de las migas también
 * el camino de vuelta al panel de la CIAgro desde cualquier profundidad.
 */
export interface TrailStep {
  level: VisorLevel
  id: string
  name: string
}

/** Escalones desde la organización hasta la selección actual, en orden. */
export function breadcrumbTrail(selection: VisorSelection): TrailStep[] {
  const pasos: TrailStep[] = [
    { level: 'org', id: selection.org.id, name: selection.org.name },
  ]
  if (selection.datacentral) {
    pasos.push({
      level: 'datacentral',
      id: selection.datacentral.id,
      name: selection.datacentral.name,
    })
  }
  if (selection.producer) {
    pasos.push({ level: 'producer', id: selection.producer.id, name: selection.producer.name })
  }
  if (selection.ranch) {
    pasos.push({ level: 'ranch', id: selection.ranch.id, name: selection.ranch.name })
  }
  if (selection.plot) {
    pasos.push({ level: 'plot', id: selection.plot.id, name: selection.plot.name })
  }
  if (selection.level === 'session' && selection.session) {
    pasos.push({
      level: 'session',
      id: selection.session.id,
      // Una sesión se identifica por su fecha; el tipo ya lo dice el nivel.
      name: selection.session.date ?? 'Sesión',
    })
  }
  return pasos
}

/**
 * Selección equivalente a "subir" a uno de los escalones.
 *
 * Se conservan los ancestros y se descartan los descendientes: subir a la agrounidad
 * desde una sesión debe olvidar rancho, parcela y sesión, o el panel mostraría datos
 * de un nivel y el título de otro.
 */
export function selectionAtStep(selection: VisorSelection, level: VisorLevel): VisorSelection {
  const base: VisorSelection = { level, org: selection.org }
  if (level === 'org') return base

  base.datacentral = selection.datacentral
  if (level === 'datacentral') return base

  base.producer = selection.producer
  if (level === 'producer') return base

  base.ranch = selection.ranch
  if (level === 'ranch') return base

  base.plot = selection.plot
  if (level === 'plot') return base

  base.session = selection.session
  return base
}
