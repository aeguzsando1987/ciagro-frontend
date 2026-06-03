import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { Task } from 'gantt-task-react'
import { GanttChart, type TaskMeta } from './GanttChart'
import { resolveRange, pointRange, isOutOfRange } from './dateUtils'
import { masterTreeQueryOptions } from '@/features/task-manager/hooks/useMasterTree'
import type { MasterProgram, MasterProgramTree } from '@/features/task-manager/types'

/** Estilos por status del Maestro/Hijo. gantt-task-react acepta colores inline. */
const STATUS_COLORS: Record<string, { bg: string; progress: string }> = {
  pending: { bg: '#94a3b8', progress: '#475569' },     // slate
  in_progress: { bg: '#3b82f6', progress: '#1d4ed8' }, // blue
  loaded: { bg: '#a855f7', progress: '#7e22ce' },      // purple
  completed: { bg: '#22c55e', progress: '#15803d' },   // green
  cancelled: { bg: '#9ca3af', progress: '#4b5563' },   // gray
}
const OUT_OF_RANGE_RED = { bg: '#ef4444', progress: '#b91c1c' }

interface GanttHierarchyProps {
  /** Lista de Maestros (paso 2.1). Cada uno puede expandirse para cargar su arbol. */
  masters: MasterProgram[]
  /** Click en cualquier bloque del Gantt. Para sesiones se incluye hijoId y sesionType
   *  resueltos en mapMastersToTasks — sin heurístico de cache. */
  onTaskClick?: (
    taskId: string,
    level: 'master' | 'hijo' | 'sesion',
    masterId: string,
    extra: { hijoId: string; sesionType: 'aspersion' | 'phyto' } | null
  ) => void
}

/**
 * Orquestador del Gantt jerarquico (Tarea 2.4).
 *
 * - Mantiene en estado local que Maestros estan expandidos (Set<masterId>).
 * - Usa useQueries para disparar N fetches del arbol en paralelo (uno por Maestro
 *   expandido). useQueries respeta Rules of Hooks aunque N cambie en runtime.
 * - Mapea Maestro -> Hijo -> Sesion a Task[] plano con `project` como parent.
 * - Para cada Hijo/Sesion, calcula isOutOfRange(child, parent) y tine en rojo si aplica.
 *
 * GAP-RIESGO-001: validar al cierre de Sprint 2.C si esta abstraccion sobre
 * gantt-task-react es suficiente; si no, este es el unico archivo que se reescribe.
 */
export function GanttHierarchy({ masters, onTaskClick }: GanttHierarchyProps) {
  const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set())

  function toggleExpand(masterId: string) {
    setExpandedMasters((prev) => {
      const next = new Set(prev)
      if (next.has(masterId)) next.delete(masterId)
      else next.add(masterId)
      return next
    })
  }

  // useQueries acepta un array dinamico: respeta Rules of Hooks porque internamente
  // se trata como UN SOLO hook que devuelve un array. Cada query solo fetcha si
  // expandedMasters tiene su id (enabled).
  const treeQueries = useQueries({
    queries: masters.map((m) => masterTreeQueryOptions(m.id, expandedMasters.has(m.id))),
  })
  const trees = treeQueries.map((q) => q.data)

  const { tasks, taskMeta, masterIdByTask, hijoIdByTask, sesionTypeByTask } = useMemo(
    () => mapMastersToTasks(masters, trees, expandedMasters),
    [masters, trees, expandedMasters]
  )

  return (
    <GanttChart
      tasks={tasks}
      taskMeta={taskMeta}
      onExpanderClick={(task) => {
        if (task.id.startsWith('m:')) toggleExpand(task.id.slice(2))
      }}
      onTaskClick={(task) => {
        const level: 'master' | 'hijo' | 'sesion' = task.id.startsWith('h:')
          ? 'hijo'
          : task.id.startsWith('s:')
            ? 'sesion'
            : 'master'
        const rawId = task.id.slice(2)
        const masterId = masterIdByTask[task.id] ?? rawId
        const extra = level === 'sesion'
          ? { hijoId: hijoIdByTask[task.id] ?? '', sesionType: sesionTypeByTask[task.id] ?? 'aspersion' as const }
          : null
        onTaskClick?.(rawId, level, masterId, extra)
      }}
    />
  )
}

/**
 * Mapea la lista de Maestros (+ arboles cargados) al formato plano Task[]
 * que consume gantt-task-react. Exportado para testing unitario.
 *
 * Esquema de IDs:
 * - Maestro: 'm:<uuid>'
 * - Hijo:    'h:<uuid>'  con project = 'm:<masterId>'
 * - Sesion:  's:<uuid>'  con project = 'h:<hijoId>'
 *
 * El prefijo permite distinguir el nivel sin lookup adicional al hacer click.
 */
/** Mapeo de import_status -> etiqueta legible para la columna Estado de sesiones. */
const IMPORT_STATUS_DISPLAY: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  done: 'Cargado',
  error: 'Error',
}

export function mapMastersToTasks(
  masters: MasterProgram[],
  trees: (MasterProgramTree | undefined)[],
  expanded: Set<string>
): {
  tasks: Task[]
  taskMeta: Record<string, TaskMeta>
  masterIdByTask: Record<string, string>
  hijoIdByTask: Record<string, string>
  sesionTypeByTask: Record<string, 'aspersion' | 'phyto'>
} {
  const tasks: Task[] = []
  const taskMeta: Record<string, TaskMeta> = {}
  const masterIdByTask: Record<string, string> = {}
  const hijoIdByTask: Record<string, string> = {}
  const sesionTypeByTask: Record<string, 'aspersion' | 'phyto'> = {}

  const treeById = Object.fromEntries(
    masters.map((m, i) => [m.id, trees[i]])
  )

  const sortedMasters = [...masters].sort(
    (a, b) => (a.est_start_date ?? '').localeCompare(b.est_start_date ?? '')
  )

  sortedMasters.forEach((master) => {
    const masterRange = resolveRange(master.est_start_date, master.est_finish_date)
    const masterColors = STATUS_COLORS[master.status ?? 'pending'] ?? STATUS_COLORS.pending!
    const masterTaskId = `m:${master.id}`

    tasks.push({
      id: masterTaskId,
      type: 'project',
      name: master.title,
      start: masterRange.start,
      end: masterRange.end,
      progress: 0,
      hideChildren: !expanded.has(master.id),
      styles: {
        backgroundColor: masterColors.bg,
        progressColor: masterColors.progress,
      },
    })
    taskMeta[masterTaskId] = { statusDisplay: master.status_display ?? '-' }
    masterIdByTask[masterTaskId] = master.id

    const tree = expanded.has(master.id) ? treeById[master.id] : undefined
    if (!tree) return

    const sortedHijos = [...tree.programas].sort(
      (a, b) => (a.est_start_date ?? '').localeCompare(b.est_start_date ?? '')
    )

    sortedHijos.forEach((hijo) => {
      const hijoRange = resolveRange(hijo.est_start_date, hijo.est_finish_date)
      const hijoOut = isOutOfRange(hijoRange, masterRange)
      const baseColors = STATUS_COLORS[hijo.status ?? 'pending'] ?? STATUS_COLORS.pending!
      const hijoColors = hijoOut ? OUT_OF_RANGE_RED : baseColors
      const hijoTaskId = `h:${hijo.id}`

      tasks.push({
        id: hijoTaskId,
        type: 'project',
        name: hijo.title ?? '(Programa sin titulo)',
        start: hijoRange.start,
        end: hijoRange.end,
        progress: 0,
        project: `m:${master.id}`,
        styles: {
          backgroundColor: hijoColors.bg,
          progressColor: hijoColors.progress,
        },
      })
      taskMeta[hijoTaskId] = {
        statusDisplay: hijoOut ? 'Fuera de rango' : (hijo.status_display ?? '-'),
      }
      masterIdByTask[hijoTaskId] = master.id

      const sortedAspersiones = [...hijo.aspersion_sessions].sort(
        (a, b) => (a.aspersion_date ?? '').localeCompare(b.aspersion_date ?? '')
      )
      sortedAspersiones.forEach((s) => {
        const sRange = pointRange(s.aspersion_date)
        const sOut = isOutOfRange(sRange, hijoRange)
        const sTaskId = `s:${s.id}`
        tasks.push({
          id: sTaskId,
          type: 'milestone',
          name: `Aspersion ${s.aspersion_date}`,
          start: sRange.start,
          end: sRange.end,
          progress: 0,
          project: `h:${hijo.id}`,
          styles: sOut
            ? { backgroundColor: OUT_OF_RANGE_RED.bg }
            : { backgroundColor: '#0ea5e9' }, // sky-500
        })
        taskMeta[sTaskId] = {
          statusDisplay: sOut ? 'Fuera de rango' : (IMPORT_STATUS_DISPLAY[s.import_status] ?? s.import_status),
        }
        masterIdByTask[sTaskId] = master.id
        hijoIdByTask[sTaskId] = hijo.id
        sesionTypeByTask[sTaskId] = 'aspersion'
      })

      const sortedPhytos = [...hijo.phyto_monitoring_headers].sort(
        (a, b) => (a.session_date ?? '').localeCompare(b.session_date ?? '')
      )
      sortedPhytos.forEach((s) => {
        const sRange = pointRange(s.session_date)
        const sOut = isOutOfRange(sRange, hijoRange)
        const sTaskId = `s:${s.id}`
        tasks.push({
          id: sTaskId,
          type: 'milestone',
          name: `Fitosanitario ${s.session_date}`,
          start: sRange.start,
          end: sRange.end,
          progress: 0,
          project: `h:${hijo.id}`,
          styles: sOut
            ? { backgroundColor: OUT_OF_RANGE_RED.bg }
            : { backgroundColor: '#10b981' }, // emerald-500
        })
        taskMeta[sTaskId] = {
          statusDisplay: sOut ? 'Fuera de rango' : (IMPORT_STATUS_DISPLAY[s.import_status] ?? s.import_status),
        }
        masterIdByTask[sTaskId] = master.id
        hijoIdByTask[sTaskId] = hijo.id
        sesionTypeByTask[sTaskId] = 'phyto'
      })
    })
  })

  return { tasks, taskMeta, masterIdByTask, hijoIdByTask, sesionTypeByTask }
}
