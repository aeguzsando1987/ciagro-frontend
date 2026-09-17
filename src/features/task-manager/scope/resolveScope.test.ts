import { describe, it, expect } from 'vitest'
import { makeDataCentral } from '@/test/test-utils'
import { resolveTaskManagerScope, mainsFrom, childrenOfMain } from './resolveScope'

const org = (id: string, name = `Org ${id}`) => ({ id, name })

/** CIAgro hija de un padre concreto, que es lo unico que mira el resolutor. */
function dc(id: string, mainId: string, name = `CIAgro ${id}`) {
  return makeDataCentral({ id, name, data_central_main: org(mainId) })
}

describe('resolveTaskManagerScope', () => {
  it('sin CIAgros alcanzables no hay con que abrir el Task Manager', () => {
    expect(resolveTaskManagerScope({ datacentrals: [] })).toEqual({ kind: 'sin-acceso' })
    expect(resolveTaskManagerScope({ datacentrals: undefined })).toEqual({ kind: 'sin-acceso' })
    expect(resolveTaskManagerScope({ datacentrals: null })).toEqual({ kind: 'sin-acceso' })
  })

  it('con una sola CIAgro abre esa, sin preguntar nada', () => {
    expect(resolveTaskManagerScope({ datacentrals: [dc('dc-1', 'org-1')] })).toEqual({
      kind: 'directo',
      dcId: 'dc-1',
    })
  })

  it('sin nada recordado abre la primera por nombre, no la primera que devuelva la API', () => {
    // Tiene que coincidir con la que encabeza el selector: si no, el usuario ve abierta
    // una CIAgro distinta de la que el desplegable muestra como primera opcion.
    const res = resolveTaskManagerScope({
      datacentrals: [dc('dc-z', 'org-1', 'Zacatecas'), dc('dc-a', 'org-2', 'Aguascalientes')],
    })
    expect(res).toEqual({ kind: 'directo', dcId: 'dc-a' })
  })

  it('abre la CIAgro recordada aunque no sea la primera', () => {
    const res = resolveTaskManagerScope({
      datacentrals: [dc('dc-a', 'org-1', 'Aguascalientes'), dc('dc-z', 'org-2', 'Zacatecas')],
      rememberedDcId: 'dc-z',
    })
    expect(res).toEqual({ kind: 'directo', dcId: 'dc-z' })
  })

  it('una recordada que ya no esta en el alcance se descarta en silencio', () => {
    // Que a un usuario le quiten una asignacion es normal; no es motivo para un error.
    const res = resolveTaskManagerScope({
      datacentrals: [dc('dc-a', 'org-1', 'Aguascalientes'), dc('dc-z', 'org-2', 'Zacatecas')],
      rememberedDcId: 'dc-borrada',
    })
    expect(res).toEqual({ kind: 'directo', dcId: 'dc-a' })
  })
})

describe('mainsFrom', () => {
  it('deduce las organizaciones sin repetirlas y las ordena por nombre', () => {
    const datacentrals = [
      makeDataCentral({ id: 'dc-1', data_central_main: org('org-z', 'Zeta') }),
      makeDataCentral({ id: 'dc-2', data_central_main: org('org-a', 'Alfa') }),
      makeDataCentral({ id: 'dc-3', data_central_main: org('org-z', 'Zeta') }),
    ]
    expect(mainsFrom(datacentrals).map((m) => m.name)).toEqual(['Alfa', 'Zeta'])
  })
})

describe('childrenOfMain', () => {
  const datacentrals = [
    dc('dc-1', 'org-1', 'Norte'),
    dc('dc-2', 'org-2', 'Sur'),
    dc('dc-3', 'org-1', 'Centro'),
  ]

  it('devuelve solo las CIAgros de la organizacion pedida, ordenadas por nombre', () => {
    expect(childrenOfMain(datacentrals, 'org-1').map((d) => d.name)).toEqual(['Centro', 'Norte'])
  })

  it('sin organizacion elegida no hay CIAgros que ofrecer', () => {
    expect(childrenOfMain(datacentrals, undefined)).toEqual([])
  })
})
