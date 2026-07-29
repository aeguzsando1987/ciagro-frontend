import { Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { useSoilMapSessionDetail } from '@/features/task-manager/hooks/useSoilMapSessionDetail'
import { useHijoDetail } from '@/features/task-manager/hooks/useHijoDetail'
import { useMasterTree } from '@/features/task-manager/hooks/useMasterTree'

interface SoilMapSessionInfoCardProps {
  sessionId: string
  datacentralId?: string
}

export function SoilMapSessionInfoCard({ sessionId, datacentralId }: SoilMapSessionInfoCardProps) {
  const { data: detail } = useSoilMapSessionDetail(sessionId)
  const hijoId = detail?.program ?? detail?.program_id ?? null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-card px-2.5 py-1 text-xs">
      <span className="font-semibold">Sesión {detail?.mapping_date ?? ''}</span>
      {detail?.status && <span className="text-muted-foreground">{detail.status}</span>}
      {detail?.points_count != null && (
        <span className="text-muted-foreground">· {detail.points_count} pts</span>
      )}
      {hijoId && datacentralId ? (
        <SoilProgramLinks sessionId={sessionId} hijoId={hijoId} datacentralId={datacentralId} />
      ) : (
        <span className="text-muted-foreground">
          {!datacentralId ? 'Enlaces no disponibles' : 'Resolviendo…'}
        </span>
      )}
    </div>
  )
}

function SoilProgramLinks({
  sessionId,
  hijoId,
  datacentralId,
}: {
  sessionId: string
  hijoId: string
  datacentralId: string
}) {
  const { data: hijo } = useHijoDetail(hijoId)
  const masterId = hijo?.master_program ?? null
  const { data: master } = useMasterTree(masterId ?? '', !!masterId)
  const linkClass = 'inline-flex items-center gap-1 text-primary hover:underline'

  return (
    <>
      {masterId && (
        <Link
          to="/w/$dc/task-manager"
          params={{ dc: datacentralId }}
          search={{
            openSesion: sessionId,
            openHijo: hijoId,
            openMaster: masterId,
            openSesionType: 'soil_map',
          }}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <ExternalLink className="h-3 w-3" /> Ver sesión
        </Link>
      )}
      <Link
        to="/w/$dc/task-manager"
        params={{ dc: datacentralId }}
        search={{ openHijo: hijoId, openMaster: masterId ?? undefined }}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        <ExternalLink className="h-3 w-3" /> Subprograma
        {hijo?.title ? `: ${hijo.title}` : ''}
      </Link>
      {masterId && (
        <Link
          to="/w/$dc/task-manager"
          params={{ dc: datacentralId }}
          search={{ openMaster: masterId }}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <ExternalLink className="h-3 w-3" /> Programa maestro
          {master?.title ? `: ${master.title}` : ''}
        </Link>
      )}
    </>
  )
}
