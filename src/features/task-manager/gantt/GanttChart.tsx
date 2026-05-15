import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { Gantt, ViewMode, type Task } from 'gantt-task-react'
import 'gantt-task-react/dist/index.css'

export type GanttViewMode = 'Day' | 'Week' | 'Month' | 'Year'

const VIEW_MODE_MAP: Record<GanttViewMode, ViewMode> = {
  Day: ViewMode.Day,
  Week: ViewMode.Week,
  Month: ViewMode.Month,
  Year: ViewMode.Year,
}

const COLUMN_WIDTH_MAP: Record<GanttViewMode, number> = {
  Day: 60,
  Week: 200,
  Month: 280,
  Year: 350,
}

/** Metadata extra por task (status legible) que gantt-task-react no expone en su tipo Task. */
export interface TaskMeta {
  statusDisplay: string
}

interface GanttChartProps {
  /** Tasks ya mapeados desde el arbol Maestro/Hijo/Sesion (lo arma GanttHierarchy). */
  tasks: Task[]
  /** Mapa id -> metadata (status legible). Sirve para la columna Estado. */
  taskMeta?: Record<string, TaskMeta>
  /** Click en un bloque del Gantt: abre el DetailPanel (paso 2.6, Sprint 2.C). */
  onTaskClick?: (task: Task) => void
  /** Click en el caret de un Maestro: expand/collapse (gestionado en GanttHierarchy). */
  onExpanderClick?: (task: Task) => void
}

const DATE_FMT = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
function fmt(d: Date): string {
  return DATE_FMT.format(d)
}

/** Limites para el resize de columnas. */
const MIN_COL = 50
const MAX_COL = 400
const DEFAULT_WIDTHS = { name: 180, from: 75, to: 75, status: 95 }

/**
 * Wrapper sobre gantt-task-react con header/tabla custom en español
 * (Nombre / Desde / Hasta / Estado), columnas redimensionables y
 * separadores verticales entre columnas y entre el panel y los meses.
 *
 * Mantiene la misma API hacia GanttHierarchy: solo añade taskMeta opcional.
 * Si en Sprint 2.C decidimos migrar la libreria, este archivo es el unico afectado.
 */
export function GanttChart({ tasks, taskMeta = {}, onTaskClick, onExpanderClick }: GanttChartProps) {
  const [viewMode, setViewMode] = useState<GanttViewMode>('Month')
  const [widths, setWidths] = useState(DEFAULT_WIDTHS)

  // Drag-to-resize: clave de la columna que se esta redimensionando.
  const draggingRef = useRef<keyof typeof widths | null>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  const handleResizeStart = useCallback(
    (col: keyof typeof widths) => (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      draggingRef.current = col
      startXRef.current = e.clientX
      startWidthRef.current = widths[col]

      function onMove(ev: MouseEvent) {
        const c = draggingRef.current
        if (!c) return
        const delta = ev.clientX - startXRef.current
        const next = Math.max(MIN_COL, Math.min(MAX_COL, startWidthRef.current + delta))
        setWidths((prev) => ({ ...prev, [c]: next }))
      }
      function onUp() {
        draggingRef.current = null
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        document.body.style.cursor = ''
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      document.body.style.cursor = 'col-resize'
    },
    [widths]
  )

  const totalPanelWidth = widths.name + widths.from + widths.to + widths.status

  if (tasks.length === 0) {
    return (
      <div className="rounded border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        No hay programas para mostrar con los filtros actuales.
      </div>
    )
  }

  // Componentes custom para el panel izquierdo. Cerramos sobre widths/taskMeta.
  const TaskListHeader = renderHeader(widths, handleResizeStart)
  const TaskListTable = renderTable(widths, taskMeta, onTaskClick)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Escala:</span>
        {(['Day', 'Week', 'Month', 'Year'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={
              'rounded border px-2 py-1 text-xs transition-colors ' +
              (viewMode === mode
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:bg-accent')
            }
          >
            {mode === 'Day' ? 'Dia' : mode === 'Week' ? 'Semana' : mode === 'Month' ? 'Mes' : 'Año'}
          </button>
        ))}
      </div>

      <div className="gantt-container overflow-auto rounded border">
        <Gantt
          tasks={tasks}
          viewMode={VIEW_MODE_MAP[viewMode]}
          columnWidth={COLUMN_WIDTH_MAP[viewMode]}
          locale="es-MX"
          listCellWidth={`${totalPanelWidth}px`}
          rowHeight={30}
          headerHeight={42}
          barCornerRadius={3}
          fontSize="11px"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          onClick={onTaskClick}
          onExpanderClick={onExpanderClick}
          TaskListHeader={TaskListHeader}
          TaskListTable={TaskListTable}
        />
      </div>

      {/* Separador grueso entre el panel de columnas y la timeline + bordes entre columnas.
          Lo aplicamos via CSS global porque gantt-task-react renderiza con SVG/divs propios. */}
      <style>{`
        .gantt-container ._3T42e,
        .gantt-container ._WuQ0f {
          border-right: 3px solid hsl(var(--border, 215 16% 47% / 0.3));
        }
        .gantt-container .gantt-task-row-cell {
          border-right: 1px solid hsl(var(--border, 215 16% 47% / 0.2));
        }
      `}</style>
    </div>
  )
}

// ------------------------------------------------------------------
// Componentes custom para TaskListHeader y TaskListTable
// ------------------------------------------------------------------

function renderHeader(
  widths: { name: number; from: number; to: number; status: number },
  onResize: (col: 'name' | 'from' | 'to' | 'status') => (e: React.MouseEvent<HTMLDivElement>) => void
) {
  return function HeaderCustom({ headerHeight, fontFamily, fontSize }: {
    headerHeight: number
    rowWidth: string
    fontFamily: string
    fontSize: string
  }) {
    const cellStyle: CSSProperties = {
      height: headerHeight,
      fontFamily,
      fontSize,
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 8,
      borderBottom: '1px solid rgba(148, 163, 184, 0.4)',
      borderRight: '1px solid rgba(148, 163, 184, 0.4)',
      fontWeight: 600,
      color: '#334155',
      backgroundColor: '#f8fafc',
      position: 'relative',
    }
    const resizerStyle: CSSProperties = {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 6,
      cursor: 'col-resize',
      zIndex: 5,
    }
    return (
      <div style={{ display: 'flex' }}>
        <div style={{ ...cellStyle, width: widths.name }}>
          Nombre
          <div style={resizerStyle} onMouseDown={onResize('name')} />
        </div>
        <div style={{ ...cellStyle, width: widths.from }}>
          Desde
          <div style={resizerStyle} onMouseDown={onResize('from')} />
        </div>
        <div style={{ ...cellStyle, width: widths.to }}>
          Hasta
          <div style={resizerStyle} onMouseDown={onResize('to')} />
        </div>
        <div style={{ ...cellStyle, width: widths.status, borderRight: '3px solid rgba(148, 163, 184, 0.6)' }}>
          Estado
          <div style={resizerStyle} onMouseDown={onResize('status')} />
        </div>
      </div>
    )
  }
}

function renderTable(
  widths: { name: number; from: number; to: number; status: number },
  taskMeta: Record<string, TaskMeta>,
  onTaskClick?: (task: Task) => void
) {
  return function TableCustom({
    rowHeight,
    fontFamily,
    fontSize,
    tasks,
    onExpanderClick,
  }: {
    rowHeight: number
    rowWidth: string
    fontFamily: string
    fontSize: string
    locale: string
    tasks: Task[]
    selectedTaskId: string
    setSelectedTask: (taskId: string) => void
    onExpanderClick: (task: Task) => void
  }) {
    const baseCell: CSSProperties = {
      height: rowHeight,
      fontFamily,
      fontSize,
      display: 'flex',
      alignItems: 'center',
      paddingLeft: 8,
      paddingRight: 8,
      borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
      borderRight: '1px solid rgba(226, 232, 240, 0.8)',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      textOverflow: 'ellipsis',
    }

    return (
      <div>
        {tasks.map((task) => {
          // Indentacion visual segun nivel (m: > h: > s:).
          const isMaster = task.id.startsWith('m:')
          const isHijo = task.id.startsWith('h:')
          const isSesion = task.id.startsWith('s:')
          const indent = isHijo ? 16 : isSesion ? 32 : 0
          const meta = taskMeta[task.id]

          // Expander: solo Maestros con hijos potenciales (todos los Maestros pueden expandirse).
          // Mostramos chevron ▶ (colapsado, hideChildren=true) o ▼ (expandido, hideChildren=false).
          // Hijos y Sesiones no llevan expander en Sprint 2.A.
          const showExpander = isMaster
          const isExpanded = task.hideChildren === false

          return (
            <div key={task.id} style={{ display: 'flex' }}>
              <div
                style={{
                  ...baseCell,
                  width: widths.name,
                  paddingLeft: 8 + indent,
                  fontWeight: isMaster ? 600 : 400,
                  cursor: onTaskClick ? 'pointer' : 'default',
                }}
                title={task.name}
                onClick={(e) => {
                  // Click sobre el texto -> selecciona la task. El click del expander
                  // (boton interno) detiene la propagacion para no abrir DetailPanel.
                  if ((e.target as HTMLElement).dataset.expander) return
                  onTaskClick?.(task)
                }}
              >
                {showExpander ? (
                  <button
                    type="button"
                    data-expander="true"
                    onClick={(e) => {
                      e.stopPropagation()
                      onExpanderClick(task)
                    }}
                    aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      padding: '0 6px 0 0',
                      fontSize: '0.9em',
                      color: '#475569',
                      lineHeight: 1,
                    }}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                ) : (
                  <span style={{ display: 'inline-block', width: 18 }} />
                )}
                {isSesion ? '◆ ' : ''}
                {task.name}
              </div>
              <div
                style={{ ...baseCell, width: widths.from, cursor: onTaskClick ? 'pointer' : 'default' }}
                title={fmt(task.start)}
                onClick={() => onTaskClick?.(task)}
              >
                {fmt(task.start)}
              </div>
              <div
                style={{ ...baseCell, width: widths.to, cursor: onTaskClick ? 'pointer' : 'default' }}
                title={fmt(task.end)}
                onClick={() => onTaskClick?.(task)}
              >
                {fmt(task.end)}
              </div>
              <div
                style={{
                  ...baseCell,
                  width: widths.status,
                  borderRight: '3px solid rgba(148, 163, 184, 0.6)',
                  color: '#475569',
                  cursor: onTaskClick ? 'pointer' : 'default',
                }}
                onClick={() => onTaskClick?.(task)}
              >
                {meta?.statusDisplay ?? '-'}
              </div>
            </div>
          )
        })}
      </div>
    )
  }
}
