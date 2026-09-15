import { Badge } from '@/components/ui/badge'
import { isItemStuck, type BatchItem } from '../hooks/useBatchImport'
import {
  describeImportErrors,
  itemDisplayStatus,
  messageList,
} from '../lib/batchMessages'

/**
 * Los tres canales de mensaje de un archivo del lote, pintados por separado.
 * La logica pura vive en `../lib/batchMessages` para poder probarse sin montar React.
 */
export function BatchItemMessages({ item }: { item: BatchItem }) {
  // Se muestran TODOS los motivos, no el primero: un archivo pre-homologacion trae dos
  // (le faltan las dos columnas de control) y corregir solo una lo volveria a rechazar.
  const rechazos = messageList(item.reject_reason)
  const advertencias = messageList(item.warnings)
  const erroresImport = describeImportErrors(item.import_errors)
  const clavado = isItemStuck(item)

  if (!rechazos.length && !advertencias.length && !erroresImport.length && !clavado) {
    return null
  }

  return (
    <div className="mt-1 space-y-1">
      {rechazos.map((texto, i) => (
        <p key={`r-${i}`} className="text-xs text-danger">
          {texto}
        </p>
      ))}

      {erroresImport.map((error, i) => (
        <p key={`e-${i}`} className="text-xs text-danger">
          {error.text}
          {error.count > 1 && (
            <span className="text-muted"> ({error.count} filas afectadas)</span>
          )}
        </p>
      ))}

      {clavado && (
        <p className="text-xs text-warning-foreground">
          La sesion se creo, pero el archivo necesita que mapees sus columnas a mano. Abrela
          desde el arbol de sesiones para completarlo.
        </p>
      )}

      {advertencias.map((texto, i) => (
        <p key={`w-${i}`} className="text-xs text-secondary">
          {texto}
        </p>
      ))}
    </div>
  )
}

export function BatchItemStatusBadge({ item }: { item: BatchItem }) {
  const { label, variant } = itemDisplayStatus(item)
  return <Badge variant={variant}>{label}</Badge>
}
