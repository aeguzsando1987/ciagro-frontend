/**
 * Botón "📋 Reportes" + panel, reutilizable en cualquier toolbar de visor. Se auto-gatea
 * con el mismo criterio del visor: `role_level>=SUPERVISOR && import_status==='done' &&
 * points_count>0`. Si no aplica, no renderiza nada. La query de detalle dedupe por key
 * con la que ya usa el visor.
 *
 * El criterio es el mismo para aspersión y suelo, pero el detalle vive en endpoints
 * distintos. Se consultan los dos hooks siempre —no se pueden llamar condicionalmente— y
 * el que no aplica recibe `null`, que deja su query deshabilitada: no hay fetch de más.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { useAspersionSessionDetail } from '@/features/task-manager/hooks/useAspersionSessionDetail'
import { useSoilMapSessionDetail } from '@/features/task-manager/hooks/useSoilMapSessionDetail'
import type { SessionType } from '../types'
import { SessionReportPanel } from './SessionReportPanel'

interface SessionReportToggleProps {
  /** UUID del header de sesión (object_id). */
  objectId: string
  plotId: string | null
  datacentralId?: string | null
  /** Tipo del reporteador, no el del visor: aquí es `soilmap`, no `soil_map`. */
  sessionType?: SessionType
  className?: string
}

export function SessionReportToggle({
  objectId,
  plotId,
  datacentralId,
  sessionType = 'aspersion',
  className,
}: SessionReportToggleProps) {
  const [open, setOpen] = useState(false)
  const roleLevel = useAuthStore((s) => s.user?.role_level ?? ROLE_LEVELS.GUEST)
  const esSuelo = sessionType === 'soilmap'
  const { data: aspersion } = useAspersionSessionDetail(esSuelo ? null : objectId)
  const { data: suelo } = useSoilMapSessionDetail(esSuelo ? objectId : null)

  const detail = esSuelo ? suelo : aspersion
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
        sessionType={sessionType}
      />
    </>
  )
}
