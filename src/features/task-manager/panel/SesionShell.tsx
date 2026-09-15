import type { ReactNode } from 'react'
import { ArrowLeft, Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { PlotMiniMap } from './PlotMiniMap'
import { usePlotGeometry } from '../hooks/usePlotGeometry'
import { importStatusLabel, importStatusVariant, sesionStatusLabel, sesionStatusVariant } from '../lib/sesionLabels'

/**
 * Chasis compartido de los modales de sesion.
 *
 * Todas las sesiones (aspersion, fitosanitario, mapeo de suelo, NDVI y rendimiento) se
 * presentan con la misma anatomia, tomada del modal de Rendimiento que era el unico resuelto:
 * cabecera con icono de tipo y estado, ficha con minimapa y metadatos, paneles de importacion,
 * fila de acciones y bloque de administrador rotulado.
 *
 * Lo que cambia entre tipos son los datos y las acciones, no el marco. Por eso el marco vive
 * aqui una sola vez: cualquier ajuste visual futuro se hace en un archivo, no en cinco.
 */

/* ─── Contenedor y cabecera ───────────────────────────────────────── */

interface SesionShellProps {
  /** Icono lucide del tipo de sesion, ya dimensionado y coloreado por el modal. */
  icon: ReactNode
  title: string
  /** Estado operativo de la sesion; se pinta como Badge junto al titulo. */
  status?: string | null
  onBack: () => void
  onClose: () => void
  children: ReactNode
}

export function SesionShell({ icon, title, status, onBack, onClose, children }: SesionShellProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="rounded p-1 hover:bg-accent"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            {icon}
            {title}
            {status && (
              <Badge variant={sesionStatusVariant(status)}>{sesionStatusLabel(status)}</Badge>
            )}
          </DialogTitle>
          {/* Radix exige una descripcion accesible; ninguno de los cinco modales la tenia
              y todos emitian el mismo warning. Al vivir el chasis en un solo sitio, se
              resuelve una vez. No es visible: el titulo ya describe el contenido. */}
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

/** Cuerpo del modal: una sola columna, no dos. */
export function SesionBody({ children }: { children: ReactNode }) {
  return <div className="space-y-5">{children}</div>
}

/* ─── Ficha: minimapa + metadatos ─────────────────────────────────── */

interface SesionFichaProps {
  plotId: string | null
  /** Pares FichaItem propios del tipo de sesion. Rancho y parcela se agregan solos. */
  children: ReactNode
}

/**
 * Rancho y parcela se resuelven aqui con usePlotGeometry y se muestran SIEMPRE, al final.
 * Antes solo Rendimiento los mostraba: en los demas tipos el usuario veia el poligono sin
 * saber de que parcela era.
 */
export function SesionFicha({ plotId, children }: SesionFichaProps) {
  const plotDetail = usePlotGeometry(plotId).data

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="h-44 overflow-hidden rounded-md border">
        <PlotMiniMap plotId={plotId} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 self-start text-sm">
        {children}
        <FichaItem label="Rancho">{plotDetail?.properties?.ranch_name ?? '—'}</FichaItem>
        <FichaItem label="Parcela">{plotDetail?.properties?.code ?? '—'}</FichaItem>
      </dl>
    </div>
  )
}

export function FichaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

/** Celda de importacion lista para meter dentro de SesionFicha. */
export function FichaImportStatus({ status }: { status: string | null | undefined }) {
  return (
    <FichaItem label="Estado de importación">
      <Badge variant={importStatusVariant(status)}>{importStatusLabel(status)}</Badge>
    </FichaItem>
  )
}

/* ─── Paneles de desenlace de la importacion ──────────────────────── */

interface ImportStatusPanelsProps {
  status: string | null | undefined
  /** Cuerpo de import_errors del serializer; forma heterogenea segun el importador. */
  errors?: unknown
  /** Texto del cargando, propio de cada tipo ("Procesando CSV de suelo…"). */
  processingLabel: string
  /** Que columnas faltaron, propio de cada importador. */
  mappingHint: string
}

/**
 * Los tres finales posibles de una importacion, que antes solo Rendimiento explicaba.
 * En aspersion y suelo no habia ninguno: una importacion fallida se veia como una sesion
 * normal con cero puntos y sin motivo a la vista.
 */
export function ImportStatusPanels({
  status,
  errors,
  processingLabel,
  mappingHint,
}: ImportStatusPanelsProps) {
  if (status === 'processing') {
    return (
      <LoadingState
        compact
        label={processingLabel}
        className="justify-start rounded-lg border bg-muted/20"
      />
    )
  }

  if (status === 'pending_mapping') {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        {mappingHint}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
        <p className="font-semibold">La importación falló</p>
        <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap">
          {JSON.stringify(errors, null, 2)}
        </pre>
      </div>
    )
  }

  return null
}

/* ─── Tarjeta de datos editables ──────────────────────────────────── */

interface DatosSesionCardProps {
  description: string
  canEdit: boolean
  onEdit: () => void
  /** Oculta el disparador mientras el formulario en linea esta abierto. */
  editing?: boolean
  /** Formulario en linea; solo Rendimiento lo usa hoy (gap GAP-HM-1). */
  children?: ReactNode
}

/**
 * Cabecera comun del bloque editable. El disparador de edicion queda igual en los cinco tipos;
 * lo que cada uno hace al pulsarlo sigue difiriendo (Rendimiento despliega el formulario aqui,
 * los otros reemplazan el cuerpo del modal). Esa diferencia queda registrada como gap.
 */
export function DatosSesionCard({
  description,
  canEdit,
  onEdit,
  editing,
  children,
}: DatosSesionCardProps) {
  if (!canEdit) return null

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Datos de la sesión</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
          </Button>
        )}
      </div>
      {children}
    </div>
  )
}

/* ─── Filas de accion ─────────────────────────────────────────────── */

/** Acciones principales del tipo de sesion (importar, visor, reportes). */
export function SesionActions({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <div className="border-t pt-4">
      <div className="flex flex-wrap gap-2">{children}</div>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}

/**
 * Acciones destructivas, siempre al final y siempre rotuladas.
 * Antes iban sueltas: en aspersion y suelo estaban anidadas dentro de la caja de importacion,
 * donde un boton "Eliminar la sesion completa" quedaba a un palmo de "Reimportar datos".
 */
export function AdminActions({ children }: { children: ReactNode }) {
  return (
    <div className="border-t border-dashed pt-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Acciones de administrador</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

/* ─── Primitivas de presentacion ──────────────────────────────────── */

export function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  )
}

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

/** Rejilla estandar de metricas, con su titulo y un subtitulo opcional. */
export function MetricGrid({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">
        {title}
        {subtitle && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">{subtitle}</span>
        )}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  )
}
