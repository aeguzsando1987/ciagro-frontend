/**
 * Botón "📋 Reportes" + panel, reutilizable en cualquier toolbar del visor de aspersión
 * (modal de Task Manager y dashboard del Visor de datos). Se auto-gatea con el mismo criterio
 * del visor: `role_level>=SUPERVISOR && import_status==='done' && points_count>0`. Si no aplica,
 * no renderiza nada. La query de detalle dedupe por key con la que ya usa el visor.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { useAspersionSessionDetail } from '@/features/task-manager/hooks/useAspersionSessionDetail'
import { SessionReportPanel } from './SessionReportPanel'

interface SessionReportToggleProps {
  /** UUID del header de sesión (object_id). */
  objectId: string
  plotId: string | null
  datacentralId?: string | null
  className?: string
}

export function SessionReportToggle({ objectId, plotId, datacentralId, className }: SessionReportToggleProps) {
  const [open, setOpen] = useState(false)
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const { data: detail } = useAspersionSessionDetail(objectId)

  const hasData =
    detail?.import_status === 'done' && parseInt(detail?.points_count ?? '0', 10) > 0
  const canReport = roleLevel >= ROLE_LEVELS.SUPERVISOR && hasData
  if (!canReport) return null

  return (
    <>
      <Button size="sm" variant="outline" className={className} onClick={() => setOpen(true)}>
        📋 Reportes
      </Button>
      <SessionReportPanel
        open={open}
        onClose={() => setOpen(false)}
        objectId={objectId}
        plotId={plotId}
        datacentralId={datacentralId}
      />
    </>
  )
}
