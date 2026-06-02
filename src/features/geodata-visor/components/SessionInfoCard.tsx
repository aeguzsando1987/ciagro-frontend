/**
 * Tarjeta de información de la sesión de aspersión seleccionada (use case §2.3.2.6.1).
 *
 * Muestra datos de la sesión y enlaces (deep-link) a la sesión, su subprograma (hijo) y
 * su programa maestro dentro del task-manager. Resuelve la jerarquía reutilizando
 * useAspersionSessionDetail → useHijoDetail → useMasterTree. Solo lectura.
 */
import { Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import { useAspersionSessionDetail } from '@/features/task-manager/hooks/useAspersionSessionDetail'
import { useHijoDetail } from '@/features/task-manager/hooks/useHijoDetail'
import { useMasterTree } from '@/features/task-manager/hooks/useMasterTree'

interface SessionInfoCardProps {
  sessionId: string
  /** CIAgro hija (necesaria para el deep-link al task-manager). */
  datacentralId?: string
}

export function SessionInfoCard({ sessionId, datacentralId }: SessionInfoCardProps) {
  const { data: detail } = useAspersionSessionDetail(sessionId)
  // El id del subprograma viene en `program` (read-only); `program_id` es write-only.
  const hijoId = detail?.program ?? detail?.program_id ?? null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-card px-2.5 py-1 text-xs">
      <span className="font-semibold">Sesión {detail?.aspersion_date ?? ''}</span>
      {detail?.status && <span className="text-muted-foreground">{detail.status}</span>}
      {detail?.points_count != null && (
        <span className="text-muted-foreground">· {detail.points_count} pts</span>
      )}
      {hijoId && datacentralId ? (
        <ProgramLinks sessionId={sessionId} hijoId={hijoId} dc={datacentralId} />
      ) : (
        <span className="text-muted-foreground">
          {!datacentralId ? 'Enlaces no disponibles' : 'Resolviendo…'}
        </span>
      )}
    </div>
  )
}

function ProgramLinks({ sessionId, hijoId, dc }: { sessionId: string; hijoId: string; dc: string }) {
  const { data: hijo } = useHijoDetail(hijoId)
  const masterId = hijo?.master_program ?? null
  const { data: master } = useMasterTree(masterId ?? '', !!masterId)

  const linkClass = 'inline-flex items-center gap-1 text-primary hover:underline'

  return (
    <>
      {masterId && (
        <Link
          to="/w/$dc/task-manager"
          params={{ dc }}
          search={{ openSesion: sessionId, openHijo: hijoId, openMaster: masterId, openSesionType: 'aspersion' }}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <ExternalLink className="h-3 w-3" /> Ver sesión
        </Link>
      )}
      <Link
        to="/w/$dc/task-manager"
        params={{ dc }}
        search={{ openHijo: hijoId, openMaster: masterId ?? undefined }}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        <ExternalLink className="h-3 w-3" /> Subprograma{hijo?.title ? `: ${hijo.title}` : ''}
      </Link>
      {masterId && (
        <Link
          to="/w/$dc/task-manager"
          params={{ dc }}
          search={{ openMaster: masterId }}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
        >
          <ExternalLink className="h-3 w-3" /> Programa maestro{master?.title ? `: ${master.title}` : ''}
        </Link>
      )}
    </>
  )
}
