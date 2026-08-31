/**
 * Resumen de lo que un borrado se llevaria, y de lo que lo impide (FASE BC).
 *
 * Se alimenta del endpoint `delete-preview`, que devuelve exactamente el mismo calculo que
 * usa el backend para decidir si el borrado procede. Es a proposito la MISMA fuente: si el
 * preview y la validacion se calcularan por separado, el usuario podria ver un resumen que
 * dice una cosa y recibir un 409 que dice otra.
 *
 * Componente presentacional puro: no pide datos ni conoce endpoints.
 */
import type { DeleteImpact } from '@/features/task-manager/types'

/** Etiquetas de los cuatro dominios. Sin esto el resumen dice "soil_map" al usuario. */
const DOMINIOS: Record<string, string> = {
  aspersion: 'aspersión',
  soil_map: 'mapeo de suelo',
  ndvi: 'NDVI',
  phyto: 'fitosanitario',
}

/** Claves sueltas de `counts` que no son por dominio, en el orden en que se muestran. */
const SUELTAS: [string, (n: number) => string][] = [
  ['programas', (n) => `${n} subprograma${n === 1 ? '' : 's'}`],
  ['target_points', (n) => `${n} punto${n === 1 ? '' : 's'} de ruta planeada`],
  ['contours', (n) => `${n} banda${n === 1 ? '' : 's'} de coropleta`],
  ['reports', (n) => `${n} reporte${n === 1 ? '' : 's'}`],
  ['issues', (n) => `${n} tema${n === 1 ? '' : 's'} de atención`],
  ['attachments', (n) => `${n} archivo${n === 1 ? '' : 's'} adjunto${n === 1 ? '' : 's'}`],
]

const nf = new Intl.NumberFormat('es-MX')

/**
 * `counts` viaja como diccionario libre porque sus llaves dependen de los dominios que
 * caigan. Se traduce aqui a frases, saltando los ceros: "0 subprogramas" es ruido.
 */
function lineas(counts: Record<string, unknown>): string[] {
  const salida: string[] = []

  const sesiones = (counts.sessions ?? {}) as Record<string, number>
  const puntos = (counts.points ?? {}) as Record<string, number>

  for (const [kind, n] of Object.entries(sesiones)) {
    if (!n) continue
    const dominio = DOMINIOS[kind] ?? kind
    const pts = puntos[kind] ?? 0
    salida.push(
      pts > 0
        ? `${n} sesión${n === 1 ? '' : 'es'} de ${dominio} con ${nf.format(pts)} puntos`
        : `${n} sesión${n === 1 ? '' : 'es'} de ${dominio} (sin datos cargados)`,
    )
  }

  for (const [clave, frase] of SUELTAS) {
    const n = counts[clave]
    if (typeof n === 'number' && n > 0) salida.push(frase(n))
  }

  return salida
}

interface DeleteImpactSummaryProps {
  impact: DeleteImpact
}

export function DeleteImpactSummary({ impact }: DeleteImpactSummaryProps) {
  const bloqueoSesiones = impact.blockers.sessions_with_data
  const bloqueoReportes = impact.blockers.published_reports

  if (!impact.can_delete) {
    return (
      <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
        <p className="font-medium text-destructive">No se puede eliminar todavía.</p>

        {bloqueoSesiones.length > 0 && (
          <div className="space-y-1">
            <p>Estas sesiones tienen datos cargados. Elimínalas primero:</p>
            <ul className="list-disc pl-5">
              {bloqueoSesiones.map((s) => (
                <li key={s.id}>
                  {s.label} — <strong>{nf.format(s.points)} puntos</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {bloqueoReportes.length > 0 && (
          <div className="space-y-1">
            <p>
              Hay {bloqueoReportes.length === 1 ? 'un reporte publicado' : 'reportes publicados'} con
              liga pública activa. Despublícalo o elimínalo antes de continuar:
            </p>
            <ul className="list-disc pl-5">
              {bloqueoReportes.map((r) => (
                <li key={r.id}>Reporte del {r.report_date}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  const detalle = lineas(impact.counts as Record<string, unknown>)

  return (
    <div className="space-y-1 rounded-md border bg-muted/40 p-3">
      <p className="font-medium">Se eliminará:</p>
      {detalle.length > 0 ? (
        <ul className="list-disc pl-5">
          {detalle.map((linea) => (
            <li key={linea}>{linea}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">No hay datos cargados debajo.</p>
      )}
    </div>
  )
}
