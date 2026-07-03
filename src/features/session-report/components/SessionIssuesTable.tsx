/**
 * Tabla de temas de atención / observaciones de un reporte. CRUD inline: alta con
 * "Nuevo tema de atención", edición expandiendo una fila y borrado (soft) con confirmación.
 * Usa los `*_display` que ya provee el backend para las etiquetas legibles.
 */
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSessionIssues, useDeleteSessionIssue } from '../hooks/useSessionIssues'
import { IssueForm } from './IssueForm'
import type { SessionIssue } from '../types'

const RELEVANCIA_STYLE: Record<string, string> = {
  alta: 'border-red-300 text-red-700 dark:text-red-300',
  media: 'border-amber-300 text-amber-700 dark:text-amber-300',
  baja: 'border-slate-300 text-slate-600 dark:text-slate-300',
  na: 'border-slate-200 text-muted-foreground',
}

interface SessionIssuesTableProps {
  reportId: string
  canWrite: boolean
  datacentralId?: string | null
}

export function SessionIssuesTable({ reportId, canWrite, datacentralId }: SessionIssuesTableProps) {
  const { data: issues = [], isLoading } = useSessionIssues(reportId)
  const deleteMut = useDeleteSessionIssue(reportId)
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  function handleDelete(id: string) {
    if (!window.confirm('¿Eliminar este tema de atención?')) return
    deleteMut.mutate(id, {
      onSuccess: () => toast.success('Tema de atención eliminado.'),
      onError: () => toast.error('No se pudo eliminar el tema de atención.'),
    })
  }

  return (
    <div className="space-y-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Temas de atención y observaciones</h3>
        {canWrite && !creating && (
          <Button size="sm" variant="outline" onClick={() => { setCreating(true); setEditingId(null) }}>
            + Nuevo tema de atención
          </Button>
        )}
      </div>

      {creating && (
        <IssueForm
          reportId={reportId}
          datacentralId={datacentralId}
          onDone={() => { setCreating(false); toast.success('Tema de atención agregado.') }}
          onCancel={() => setCreating(false)}
        />
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Cargando temas…</p>}

      {!isLoading && issues.length === 0 && !creating && (
        <p className="text-sm text-muted-foreground">Aún no hay temas de atención registrados.</p>
      )}

      <ul className="space-y-2">
        {issues.map((issue) =>
          editingId === issue.id ? (
            <li key={issue.id}>
              <IssueForm
                reportId={reportId}
                issue={issue}
                datacentralId={datacentralId}
                onDone={() => { setEditingId(null); toast.success('Tema de atención guardado.') }}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li key={issue.id} className="rounded border p-2">
              <IssueRow
                issue={issue}
                canWrite={canWrite}
                onEdit={() => { setEditingId(issue.id); setCreating(false) }}
                onDelete={() => handleDelete(issue.id)}
              />
            </li>
          )
        )}
      </ul>
    </div>
  )
}

function IssueRow({
  issue,
  canWrite,
  onEdit,
  onDelete,
}: {
  issue: SessionIssue
  canWrite: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const responsible = issue.assigned_user_name || issue.outer_assigned_user || '—'
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{issue.title}</p>
          <p className="text-xs text-muted-foreground">
            {issue.issue_type_display} · {issue.registered_at ?? '—'} · {responsible}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline" className={RELEVANCIA_STYLE[issue.relevancia ?? 'na']}>
            {issue.relevancia_display}
          </Badge>
          <Badge variant="secondary">{issue.attention_status_display}</Badge>
        </div>
      </div>
      {issue.detail && <p className="text-xs text-muted-foreground">{issue.detail}</p>}
      {canWrite && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onEdit}>
            Editar
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={onDelete}>
            Eliminar
          </Button>
        </div>
      )}
    </div>
  )
}
