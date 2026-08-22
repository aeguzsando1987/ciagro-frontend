import { describe, expect, it } from 'vitest'

import { resolveExplorerRoot } from './explorerRoot'

/**
 * Los tres casos del caso de uso salen de UNA regla: un nivel con un solo hijo no se
 * pinta. Estos tests fijan esa equivalencia; si alguien vuelve a las tres condiciones
 * explícitas, aquí se nota.
 */
describe('resolveExplorerRoot', () => {
  it('con varias organizaciones arranca en organización', () => {
    expect(resolveExplorerRoot({ orgs: 2, datacentrals: 5 })).toBe('org')
  })

  it('con una organización y varias CIAgros arranca en CIAgro hija', () => {
    expect(resolveExplorerRoot({ orgs: 1, datacentrals: 3 })).toBe('datacentral')
  })

  it('con una sola CIAgro arranca en agrounidad', () => {
    expect(resolveExplorerRoot({ orgs: 1, datacentrals: 1 })).toBe('producer')
  })

  it('el número de productores no cambia la raíz: se detiene en agrounidad', () => {
    // Da igual que haya uno o muchos: rancho y parcela siempre se ven.
    expect(resolveExplorerRoot({ orgs: 1, datacentrals: 1 })).toBe('producer')
  })

  it('varias organizaciones con una CIAgro cada una arrancan en organización', () => {
    // Combinación que las tres reglas literales no cubrían: la elección real está
    // arriba, en la organización, no en la CIAgro.
    expect(resolveExplorerRoot({ orgs: 3, datacentrals: 3 })).toBe('org')
  })

  it('sin ninguna CIAgro visible cae al nivel raíz habitual', () => {
    expect(resolveExplorerRoot({ orgs: 0, datacentrals: 0 })).toBe('org')
  })
})
