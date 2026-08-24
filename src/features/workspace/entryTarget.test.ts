import { describe, expect, it } from 'vitest'

import { resolveEntryDecision, targetRouteFor } from './entryTarget'

/**
 * Estas dos funciones deciden a dónde entra TODO el mundo al iniciar sesión y a dónde
 * lleva elegir una CIAgro. Se prueban aisladas porque su forma natural sería un guard
 * de redirección, y un guard pasa con facilidad sin llegar a ejercitarse.
 */
describe('resolveEntryDecision — a dónde se entra al iniciar sesión', () => {
  it('sin ninguna CIAgro alcanzable manda a resolverlo fuera del Visor', () => {
    // No distingue wizard de primer uso y sin acceso: eso lo decide `/workspaces`.
    expect(resolveEntryDecision([])).toEqual({ kind: 'sin-acceso' })
  })

  it('con una sola entra directo a la suya, sin pedir que la elija', () => {
    expect(resolveEntryDecision([{ id: 'dc-1' }])).toEqual({ kind: 'unica', dcId: 'dc-1' })
  })

  it('con varias no preselecciona ninguna', () => {
    // El árbol del explorador ya arranca en el nivel que su alcance justifica; elegir
    // aquí sería pedir dos veces lo mismo.
    expect(resolveEntryDecision([{ id: 'dc-1' }, { id: 'dc-2' }])).toEqual({
      kind: 'elegir-en-el-arbol',
    })
  })

  it('tolera que el usuario aún no tenga el campo poblado', () => {
    expect(resolveEntryDecision(undefined)).toEqual({ kind: 'sin-acceso' })
    expect(resolveEntryDecision(null)).toEqual({ kind: 'sin-acceso' })
  })
})

describe('targetRouteFor — a dónde lleva elegir una CIAgro', () => {
  it('sin destino explícito lleva al Visor', () => {
    expect(targetRouteFor('dc-1', undefined)).toEqual({
      to: '/w/$dc/visor',
      params: { dc: 'dc-1' },
    })
  })

  it('con destino Task Manager lleva al Task Manager de esa CIAgro', () => {
    // Es el único camino donde el selector sigue teniendo sentido: sus datos son de
    // una CIAgro concreta y no tienen equivalente al árbol del Visor.
    expect(targetRouteFor('dc-1', 'task-manager')).toEqual({
      to: '/w/$dc/task-manager',
      params: { dc: 'dc-1' },
    })
  })
})
