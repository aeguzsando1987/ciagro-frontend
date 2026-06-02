import { useState } from 'react'
import { toast } from 'sonner'
import { Building2, Network, ListChecks, ArrowRight, Plus, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/features/auth/useAuthStore'
import {
  useCreateDataCentralMain,
  useCreateDataCentral,
} from '@/features/admin/hooks/useDataCentrals'

/**
 * Wizard de primer uso (solo SuperAdmin, solo cuando el sistema no tiene
 * organizaciones). Guía al admin a crear su primera organización + CIAgros
 * hijas, y deja instrucciones para las asignaciones. Es omitible (skip) en
 * cualquier paso: onExit devuelve al flujo normal de selección de workspace.
 */

type Step = 'welcome' | 'org' | 'cias' | 'done'

interface Props {
  /** Cierra el wizard y vuelve al selector normal (skip o finalizar). */
  onExit: () => void
}

export function FirstUseWizard({ onExit }: Props) {
  const [step, setStep] = useState<Step>('welcome')
  // Org creada en el paso 'org' — su id alimenta el paso 'cias'.
  const [createdOrg, setCreatedOrg] = useState<{ id: string; name: string } | null>(null)
  const [createdCias, setCreatedCias] = useState<string[]>([])

  switch (step) {
    case 'welcome':
      return <WelcomeStep onStart={() => setStep('org')} onSkip={onExit} />
    case 'org':
      return (
        <OrgStep
          onCreated={(org) => {
            setCreatedOrg(org)
            setStep('cias')
          }}
          onSkip={onExit}
        />
      )
    case 'cias':
      return (
        <CiasStep
          org={createdOrg!}
          createdCias={createdCias}
          onCreatedCia={(name) => setCreatedCias((prev) => [...prev, name])}
          onContinue={() => setStep('done')}
        />
      )
    case 'done':
      return <DoneStep orgName={createdOrg?.name ?? ''} cias={createdCias} onFinish={onExit} />
  }
}

// ── Paso 0: Bienvenida ────────────────────────────────────────────────────────

function WelcomeStep({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="items-center text-center">
        <Building2 className="mb-2 h-10 w-10 text-primary" />
        <CardTitle className="text-2xl">Bienvenido a CIAgro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-center">
        <p className="text-muted-foreground">
          Aún no hay <strong>organizaciones</strong> ni <strong>CIAgros</strong> en el sistema.
          ¿Quieres comenzar creándolas ahora? Te guiaremos paso a paso.
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="ghost" onClick={onSkip}>
            Omitir por ahora
          </Button>
          <Button onClick={onStart} className="gap-1.5">
            Comenzar <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Paso 1: Crear organización ──────────────────────────────────────────────

function OrgStep({
  onCreated,
  onSkip,
}: {
  onCreated: (org: { id: string; name: string }) => void
  onSkip: () => void
}) {
  const userId = useAuthStore((s) => s.user?.id)
  const mutation = useCreateDataCentralMain()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  async function submit() {
    if (!name.trim()) {
      toast.error('El nombre de la organización es obligatorio.')
      return
    }
    if (!userId) {
      toast.error('No se pudo identificar al usuario actual.')
      return
    }
    try {
      const created = await mutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        country: null,
        status: 'active',
        owner_id: userId,
      })
      // El endpoint de creación devuelve el recurso con su id (read-only en el serializer);
      // el tipo generado aún no lo refleja, por eso la aserción puntual.
      const org = created as unknown as { id: string; name: string }
      toast.success('Organización creada.')
      onCreated({ id: org.id, name: org.name })
    } catch {
      toast.error('No se pudo crear la organización. Intenta de nuevo.')
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4" /> Paso 1 de 3
        </div>
        <CardTitle>Crea tu organización</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nombre *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la organización"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Descripción breve (opcional)"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Serás el propietario (owner) de esta organización.
        </p>
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onSkip}>
            Omitir
          </Button>
          <Button onClick={submit} disabled={mutation.isPending} className="gap-1.5">
            {mutation.isPending ? 'Creando…' : (
              <>
                Crear y continuar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Paso 2: Crear CIAgros hijas ─────────────────────────────────────────────

function CiasStep({
  org,
  createdCias,
  onCreatedCia,
  onContinue,
}: {
  org: { id: string; name: string }
  createdCias: string[]
  onCreatedCia: (name: string) => void
  onContinue: () => void
}) {
  const mutation = useCreateDataCentral()
  const [name, setName] = useState('')

  async function addCia() {
    if (!name.trim()) {
      toast.error('Escribe el nombre de la CIAgro.')
      return
    }
    try {
      await mutation.mutateAsync({
        name: name.trim(),
        description: '',
        data_central_main_id: org.id,
      })
      toast.success(`CIAgro "${name.trim()}" creada.`)
      onCreatedCia(name.trim())
      setName('')
    } catch {
      toast.error('No se pudo crear la CIAgro. Intenta de nuevo.')
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Network className="h-4 w-4" /> Paso 2 de 3
        </div>
        <CardTitle>Agrega CIAgros a {org.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Las CIAgros son los espacios de trabajo (workspaces) dentro de tu organización.
          Agrega una o más. Puedes continuar cuando termines.
        </p>

        {createdCias.length > 0 && (
          <ul className="space-y-1 rounded-md border bg-muted/30 p-3">
            {createdCias.map((c, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" /> {c}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium">Nombre de la CIAgro</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. CIAgro Principal"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void addCia()
                }
              }}
            />
          </div>
          <Button variant="outline" onClick={addCia} disabled={mutation.isPending} className="gap-1.5">
            <Plus className="h-4 w-4" /> Agregar
          </Button>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onContinue}>
            {createdCias.length === 0 ? 'Omitir' : 'Continuar sin agregar más'}
          </Button>
          <Button onClick={onContinue} disabled={createdCias.length === 0} className="gap-1.5">
            Continuar <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Paso 3: Instructivo final ───────────────────────────────────────────────

function DoneStep({
  orgName,
  cias,
  onFinish,
}: {
  orgName: string
  cias: string[]
  onFinish: () => void
}) {
  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="items-center text-center">
        <ListChecks className="mb-2 h-10 w-10 text-primary" />
        <CardTitle>¡Listo!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-center text-muted-foreground">
          Creaste la organización <strong>{orgName}</strong>
          {cias.length > 0 && (
            <>
              {' '}con {cias.length} CIAgro{cias.length > 1 ? 's' : ''}
            </>
          )}
          .
        </p>

        <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
          <p className="font-medium">Siguientes pasos (desde el panel de Administración):</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              Asigna <strong>productores</strong> (AgroUnits) a cada CIAgro en la sección
              {' '}<em>Organizaciones → CIAgro → Productores</em>.
            </li>
            <li>
              Asigna <strong>usuarios</strong> (técnicos, supervisores, gerentes) a cada CIAgro en
              {' '}<em>Organizaciones → CIAgro → Usuarios</em>.
            </li>
            <li>
              Crea más organizaciones o CIAgros cuando lo necesites desde la misma sección.
            </li>
          </ol>
        </div>

        <div className="flex justify-center">
          <Button onClick={onFinish} className="gap-1.5">
            Ir al sistema <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
