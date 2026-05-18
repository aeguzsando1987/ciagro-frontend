/**
 * Placeholder de sección del panel de administración.
 * Se usa en Fase 0 (andamiaje); cada sección se implementa en su Fase correspondiente.
 */
interface SectionPlaceholderProps {
  title: string
  description: string
  phase: string
}

export function SectionPlaceholder({ title, description, phase }: SectionPlaceholderProps) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        Sección en construcción — se implementa en {phase}.
      </p>
    </div>
  )
}
