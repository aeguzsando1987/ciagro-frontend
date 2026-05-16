import { describe, it, expect } from 'vitest'
import { mapMastersToTasks } from './GanttHierarchy'
import type { MasterProgram, MasterProgramTree } from '@/features/task-manager/types'

/**
 * Tests del mapeo puro tree -> Task[].
 * No monta componentes: mapMastersToTasks es funcion pura, mas rapida y robusta de testear.
 */

function makeMaster(over: Partial<MasterProgram> = {}): MasterProgram {
  return {
    id: 'master-1',
    title: 'Programa Maestro Primavera 2026',
    code: 'PROG-2026-A',
    agro_unit: 'agro-1',
    status: 'pending',
    status_display: 'Pendiente',
    est_start_date: '2026-06-01',
    est_finish_date: '2026-08-31',
    real_start_date: null,
    real_finish_date: null,
    notes: '',
    created_at: '2026-05-13T00:00:00Z',
    updated_at: '2026-05-13T00:00:00Z',
    ...over,
  }
}

function makeTree(masterOver: Partial<MasterProgram> = {}, programas: MasterProgramTree['programas'] = []): MasterProgramTree {
  return {
    ...makeMaster(masterOver),
    programas,
  }
}

describe('mapMastersToTasks', () => {
  it('mapea Maestros sin expandir como tasks tipo "project" con hideChildren=true', () => {
    const masters = [makeMaster()]
    const { tasks } = mapMastersToTasks(masters, [undefined], new Set())

    expect(tasks).toHaveLength(1)
    expect(tasks[0]!.id).toBe('m:master-1')
    expect(tasks[0]!.type).toBe('project')
    expect(tasks[0]!.hideChildren).toBe(true)
    expect(tasks[0]!.name).toBe('Programa Maestro Primavera 2026')
  })

  it('cuando el Maestro esta expandido, agrega los Hijos del arbol con project = m:masterId', () => {
    const masters = [makeMaster()]
    const tree = makeTree({}, [
      {
        id: 'hijo-1',
        title: 'Programa Hijo',
        voucher_code: null,
        cycle: '2026-A',
        plot: 'plot-1',
        status: 'pending',
        status_display: 'Pendiente',
        est_start_date: '2026-06-15T00:00:00Z',
        est_finish_date: '2026-07-15T00:00:00Z',
        aspersion_sessions: [],
        phyto_monitoring_headers: [],
      },
    ])

    const { tasks } = mapMastersToTasks(masters, [tree], new Set(['master-1']))

    expect(tasks).toHaveLength(2)
    expect(tasks[1]!.id).toBe('h:hijo-1')
    expect(tasks[1]!.project).toBe('m:master-1')
    expect(tasks[1]!.type).toBe('project')
  })

  it('agrega sesiones de aspersion y phyto como milestones bajo el Hijo', () => {
    const masters = [makeMaster()]
    const tree = makeTree({}, [
      {
        id: 'hijo-1',
        title: 'Hijo',
        voucher_code: null,
        cycle: null,
        plot: null,
        status: 'pending',
        status_display: 'Pendiente',
        est_start_date: '2026-06-15T00:00:00Z',
        est_finish_date: '2026-07-15T00:00:00Z',
        aspersion_sessions: [
          { id: 'sa-1', type: 'aspersion', aspersion_date: '2026-07-01', import_status: 'pending' },
        ],
        phyto_monitoring_headers: [
          { id: 'sp-1', type: 'phyto', session_date: '2026-07-05', import_status: 'pending', status: 'pending' },
        ],
      },
    ])

    const { tasks } = mapMastersToTasks(masters, [tree], new Set(['master-1']))

    expect(tasks).toHaveLength(4) // master + hijo + aspersion + phyto

    const aspersion = tasks.find((t) => t.id === 's:sa-1')
    expect(aspersion?.type).toBe('milestone')
    expect(aspersion?.project).toBe('h:hijo-1')

    const phyto = tasks.find((t) => t.id === 's:sp-1')
    expect(phyto?.type).toBe('milestone')
    expect(phyto?.project).toBe('h:hijo-1')
  })

  it('marca en rojo el Hijo si sus fechas caen fuera del rango del Maestro', () => {
    const masters = [makeMaster({ est_start_date: '2026-06-01', est_finish_date: '2026-08-31' })]
    const tree = makeTree({ est_start_date: '2026-06-01', est_finish_date: '2026-08-31' }, [
      {
        id: 'hijo-fuera',
        title: 'Fuera de rango',
        voucher_code: null,
        cycle: null,
        plot: null,
        status: 'pending',
        status_display: 'Pendiente',
        est_start_date: '2026-05-01T00:00:00Z', // ANTES que el master
        est_finish_date: '2026-07-15T00:00:00Z',
        aspersion_sessions: [],
        phyto_monitoring_headers: [],
      },
    ])

    const { tasks } = mapMastersToTasks(masters, [tree], new Set(['master-1']))
    const hijo = tasks.find((t) => t.id === 'h:hijo-fuera')!

    expect(hijo.styles?.backgroundColor).toBe('#ef4444') // rojo OUT_OF_RANGE
  })

  it('genera taskMeta con statusDisplay legible para Master, Hijo y Sesion', () => {
    const masters = [makeMaster({ status: 'in_progress', status_display: 'En progreso' })]
    const tree = makeTree({ status: 'in_progress', status_display: 'En progreso' }, [
      {
        id: 'hijo-1',
        title: 'Hijo',
        voucher_code: null,
        cycle: null,
        plot: null,
        status: 'pending',
        status_display: 'Pendiente',
        est_start_date: '2026-06-15T00:00:00Z',
        est_finish_date: '2026-07-15T00:00:00Z',
        aspersion_sessions: [
          { id: 'sa-1', type: 'aspersion', aspersion_date: '2026-07-01', import_status: 'done' },
        ],
        phyto_monitoring_headers: [],
      },
    ])

    const { taskMeta } = mapMastersToTasks(masters, [tree], new Set(['master-1']))

    expect(taskMeta['m:master-1']?.statusDisplay).toBe('En progreso')
    expect(taskMeta['h:hijo-1']?.statusDisplay).toBe('Pendiente')
    expect(taskMeta['s:sa-1']?.statusDisplay).toBe('Cargado')
  })

  it('taskMeta marca "Fuera de rango" cuando el Hijo cae fuera del Maestro', () => {
    const masters = [makeMaster({ est_start_date: '2026-06-01', est_finish_date: '2026-08-31' })]
    const tree = makeTree({}, [
      {
        id: 'hijo-fuera',
        title: 'Fuera',
        voucher_code: null,
        cycle: null,
        plot: null,
        status: 'pending',
        status_display: 'Pendiente',
        est_start_date: '2026-05-01T00:00:00Z',
        est_finish_date: '2026-07-15T00:00:00Z',
        aspersion_sessions: [],
        phyto_monitoring_headers: [],
      },
    ])

    const { taskMeta } = mapMastersToTasks(masters, [tree], new Set(['master-1']))
    expect(taskMeta['h:hijo-fuera']?.statusDisplay).toBe('Fuera de rango')
  })

  it('popula hijoIdByTask y sesionTypeByTask para aspersion y phyto', () => {
    const masters = [makeMaster()]
    const tree = makeTree({}, [
      {
        id: 'hijo-1',
        title: 'Hijo',
        voucher_code: null,
        cycle: null,
        plot: null,
        status: 'pending',
        status_display: 'Pendiente',
        est_start_date: '2026-06-15T00:00:00Z',
        est_finish_date: '2026-07-15T00:00:00Z',
        aspersion_sessions: [
          { id: 'sa-1', type: 'aspersion', aspersion_date: '2026-07-01', import_status: 'pending' },
        ],
        phyto_monitoring_headers: [
          { id: 'sp-1', type: 'phyto', session_date: '2026-07-05', import_status: 'pending', status: 'pending' },
        ],
      },
    ])

    const { hijoIdByTask, sesionTypeByTask } = mapMastersToTasks(masters, [tree], new Set(['master-1']))

    expect(hijoIdByTask['s:sa-1']).toBe('hijo-1')
    expect(sesionTypeByTask['s:sa-1']).toBe('aspersion')
    expect(hijoIdByTask['s:sp-1']).toBe('hijo-1')
    expect(sesionTypeByTask['s:sp-1']).toBe('phyto')
    // Master y Hijo no deben estar en estos mapas
    expect(hijoIdByTask['m:master-1']).toBeUndefined()
    expect(hijoIdByTask['h:hijo-1']).toBeUndefined()
  })

  it('no agrega Hijos si el Maestro NO esta expandido aunque el tree exista en cache', () => {
    const masters = [makeMaster()]
    const tree = makeTree({}, [
      {
        id: 'hijo-1',
        title: 'Hijo',
        voucher_code: null,
        cycle: null,
        plot: null,
        status: 'pending',
        status_display: 'Pendiente',
        est_start_date: '2026-06-15T00:00:00Z',
        est_finish_date: '2026-07-15T00:00:00Z',
        aspersion_sessions: [],
        phyto_monitoring_headers: [],
      },
    ])

    const { tasks } = mapMastersToTasks(masters, [tree], new Set()) // <-- vacio: no expandido

    expect(tasks).toHaveLength(1)
    expect(tasks[0]!.id).toBe('m:master-1')
    expect(tasks[0]!.hideChildren).toBe(true)
  })
})
