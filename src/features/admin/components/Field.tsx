import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'

/** Campo de formulario del panel admin: label + control + mensaje de error inline. */
export function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
