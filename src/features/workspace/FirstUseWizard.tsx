import { useState } from 'react'
import { toast } from 'sonner'
import {
  Building2, Network, ListChecks, ArrowRight, Plus, Check, Tractor, UserPlus, Link2,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/features/auth/useAuthStore'
import {
  useCreateDataCentralMain,
  useCreateDataCentral,
} from '@/features/admin/hooks/useDataCentrals'
import { useCreateAgroUnit } from '@/features/admin/hooks/useAgroUnits'
import { useCreateDataCentralAssignment } from '@/features/admin/hooks/useDataCentralAssignments'

/**
 * Wizard de primer uso (solo SuperAdmin, solo cuando el sistema no tiene
 * organizaciones). Mini-tutorial guiado que cubre la cadena completa:
 *   organización → CIAgros → productores → asignar productores a CIAgros
 *   → aviso sobre usuarios (los registra/asigna después desde Administración).
 * Es omitible (skip) en cualquier paso: onExit devuelve al flujo normal.
 */

type Step = 'welcome' | 'org' | 'cias' | 'producers' | 'assign' | 'done'
const TOTAL_STEPS = 5
const MAX_PRODUCERS = 2

interface CreatedCia { id: string; name: string }
interface CreatedProducer { id: string; commercial_name: string; code: string }

interface Props {
  /** Cierra el wizard y vuelve al selector normal (skip o finalizar). */
  onExit: () => void
}

export function FirstUseWizard({ onExit }: Props) {
  const [step, setStep] = useState<Step>('welcome')
  const [createdOrg, setCreatedOrg] = useState<{ id: string; name: string } | null>(null)
  const [createdCias, setCreatedCias] = useState<CreatedCia[]>([])
  const [createdProducers, setCreatedProducers] = useState<CreatedProducer[]>([])

  let content: React.ReactNode = null
  switch (step) {
    case 'welcome':
      content = <WelcomeStep onStart={() => setStep('org')} onSkip={onExit} />
      break
    case 'org':
      content = (
        <OrgStep
          onCreated={(org) => { setCreatedOrg(org); setStep('cias') }}
          onSkip={onExit}
        />
      )
      break
    case 'cias':
      content = (
        <CiasStep
          org={createdOrg!}
          createdCias={createdCias}
          onCreatedCia={(cia) => setCreatedCias((prev) => [...prev, cia])}
          onContinue={() => setStep('producers')}
        />
      )
      break
    case 'producers':
      content = (
        <ProducersStep
          createdProducers={createdProducers}
          onCreatedProducer={(p) => setCreatedProducers((prev) => [...prev, p])}
          onContinue={() => setStep(createdProducers.length > 0 && createdCias.length > 0 ? 'assign' : 'done')}
          onSkip={() => setStep('done')}
        />
      )
      break
    case 'assign':
      content = (
        <AssignStep
          producers={createdProducers}
          cias={createdCias}
          onContinue={() => setStep('done')}
          onSkip={() => setStep('done')}
        />
      )
      break
    case 'done':
      content = (
        <DoneStep
          orgName={createdOrg?.name ?? ''}
          cias={createdCias}
          producers={createdProducers}
          onFinish={onExit}
        />
      )
      break
  }

  // key={step} remonta el wrapper en cada cambio → la animación CSS se reproduce
  // (entra deslizándose desde la derecha + fade in).
  return (
    <div key={step} className="wizard-slide-in">
      {content}
    </div>
  )
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
          Aún no hay <strong>organizaciones</strong>, <strong>CIAgros</strong> ni
          <strong> productores</strong> en el sistema. Te guiaremos para crearlos en pocos
          pasos y dejar todo listo para que tu equipo empiece a trabajar.
        </p>
        <ol className="mx-auto max-w-xs space-y-1 text-left text-sm text-muted-foreground">
          <li>1. Crear tu <strong>organización</strong></li>
          <li>2. Agregar <strong>CIAgros</strong> (espacios de trabajo)</li>
          <li>3. Registrar <strong>productores</strong></li>
          <li>4. <strong>Asignar productores</strong> a CIAgros</li>
          <li>5. Información sobre <strong>usuarios</strong></li>
        </ol>
        <div className="flex justify-center gap-3">
          <Button variant="ghost" onClick={onSkip}>Omitir por ahora</Button>
          <Button onClick={onStart} className="gap-1.5">
            Comenzar <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Helper de cabecera de paso ────────────────────────────────────────────────

function StepHeader({ icon, index, title }: { icon: React.ReactNode; index: number; title: string }) {
  return (
    <CardHeader>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon} Paso {index} de {TOTAL_STEPS}
      </div>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
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
    if (!name.trim()) { toast.error('El nombre de la organización es obligatorio.'); return }
    if (!userId) { toast.error('No se pudo identificar al usuario actual.'); return }
    try {
      const created = await mutation.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        country: null,
        status: 'active',
        owner_id: userId,
      })
      const org = created as unknown as { id: string; name: string }
      toast.success('Organización creada.')
      onCreated({ id: org.id, name: org.name })
    } catch {
      toast.error('No se pudo crear la organización. Intenta de nuevo.')
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <StepHeader icon={<Building2 className="h-4 w-4" />} index={1} title="Crea tu organización" />
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
        <p className="text-xs text-muted-foreground">Serás el propietario (owner) de esta organización.</p>
        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onSkip}>Omitir</Button>
          <Button onClick={submit} disabled={mutation.isPending} className="gap-1.5">
            {mutation.isPending ? 'Creando…' : (<>Crear y continuar <ArrowRight className="h-4 w-4" /></>)}
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
  createdCias: CreatedCia[]
  onCreatedCia: (cia: CreatedCia) => void
  onContinue: () => void
}) {
  const mutation = useCreateDataCentral()
  const [name, setName] = useState('')

  async function addCia() {
    if (!name.trim()) { toast.error('Escribe el nombre de la CIAgro.'); return }
    try {
      const created = await mutation.mutateAsync({
        name: name.trim(),
        description: '',
        data_central_main_id: org.id,
      })
      const cia = created as unknown as { id: string; name: string }
      toast.success(`CIAgro "${cia.name}" creada.`)
      onCreatedCia({ id: cia.id, name: cia.name })
      setName('')
    } catch {
      toast.error('No se pudo crear la CIAgro. Intenta de nuevo.')
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <StepHeader icon={<Network className="h-4 w-4" />} index={2} title={`Agrega CIAgros a ${org.name}`} />
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Las CIAgros son los espacios de trabajo (workspaces) dentro de tu organización.
          Agrega una o más. Puedes continuar cuando termines.
        </p>

        {createdCias.length > 0 && (
          <ul className="space-y-1 rounded-md border bg-muted/30 p-3">
            {createdCias.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" /> {c.name}
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
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addCia() } }}
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

// ── Paso 3: Crear productores (AgroUnit, unit_type=Productor) ───────────────

function ProducersStep({
  createdProducers,
  onCreatedProducer,
  onContinue,
  onSkip,
}: {
  createdProducers: CreatedProducer[]
  onCreatedProducer: (p: CreatedProducer) => void
  onContinue: () => void
  onSkip: () => void
}) {
  const mutation = useCreateAgroUnit()
  const [commercialName, setCommercialName] = useState('')
  const [code, setCode] = useState('')

  const reachedMax = createdProducers.length >= MAX_PRODUCERS

  async function add() {
    if (!commercialName.trim() || !code.trim()) {
      toast.error('Nombre comercial y código son obligatorios.')
      return
    }
    try {
      const created = await mutation.mutateAsync({
        commercial_name: commercialName.trim(),
        code: code.trim(),
        unit_type: 'Productor' as never,
      })
      const prod = created as unknown as { id: string; commercial_name: string; code: string }
      toast.success(`Productor "${prod.commercial_name}" creado.`)
      onCreatedProducer({ id: prod.id, commercial_name: prod.commercial_name, code: prod.code })
      setCommercialName('')
      setCode('')
    } catch {
      toast.error('No se pudo crear el productor. Revisa los datos e intenta de nuevo.')
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <StepHeader icon={<Tractor className="h-4 w-4" />} index={3} title="Registra productores" />
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Los <strong>productores</strong> son las unidades productivas (agrounidades de
          tipo <em>Productor</em>) que después podrás asignar a tus CIAgros. Para empezar
          basta con uno o dos — siempre podrás agregar más desde Administración.
        </p>

        {createdProducers.length > 0 && (
          <ul className="space-y-1 rounded-md border bg-muted/30 p-3">
            {createdProducers.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                <span>{p.commercial_name} <span className="text-muted-foreground">· {p.code}</span></span>
              </li>
            ))}
          </ul>
        )}

        {!reachedMax && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Nombre comercial *</label>
              <Input
                value={commercialName}
                onChange={(e) => setCommercialName(e.target.value)}
                placeholder="Ej. Rancho Los Pinos"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Código *</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej. RP-001"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add() } }}
              />
            </div>
          </div>
        )}
        {!reachedMax && (
          <div className="flex justify-end">
            <Button variant="outline" onClick={add} disabled={mutation.isPending} className="gap-1.5">
              <Plus className="h-4 w-4" /> Agregar productor
            </Button>
          </div>
        )}
        {reachedMax && (
          <p className="text-xs text-muted-foreground">
            Máximo {MAX_PRODUCERS} en este tutorial. Crea más después desde
            <em> Administración → Agrounidades</em>.
          </p>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onSkip}>Omitir este paso</Button>
          <Button onClick={onContinue} className="gap-1.5">
            Continuar <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Paso 4: Asignar productores a CIAgros ──────────────────────────────────

function AssignStep({
  producers,
  cias,
  onContinue,
  onSkip,
}: {
  producers: CreatedProducer[]
  cias: CreatedCia[]
  onContinue: () => void
  onSkip: () => void
}) {
  const mutation = useCreateDataCentralAssignment()
  // selections[producerId] = Set<datacentralId>
  const [selections, setSelections] = useState<Record<string, Set<string>>>(() => {
    // Por defecto: cada productor preseleccionado en la primera CIAgro (UX amigable).
    const init: Record<string, Set<string>> = {}
    for (const p of producers) init[p.id] = new Set(cias[0] ? [cias[0].id] : [])
    return init
  })

  function toggle(producerId: string, ciaId: string) {
    setSelections((prev) => {
      const cur = new Set(prev[producerId] ?? [])
      if (cur.has(ciaId)) cur.delete(ciaId)
      else cur.add(ciaId)
      return { ...prev, [producerId]: cur }
    })
  }

  async function confirm() {
    const tasks: Array<Promise<unknown>> = []
    for (const p of producers) {
      for (const ciaId of selections[p.id] ?? []) {
        tasks.push(mutation.mutateAsync({ agro_unit_id: p.id, datacentral_id: ciaId }))
      }
    }
    if (tasks.length === 0) {
      toast.info('No se asignó ningún productor.')
      onContinue()
      return
    }
    try {
      await Promise.all(tasks)
      toast.success(`${tasks.length} asignación${tasks.length > 1 ? 'es' : ''} creada${tasks.length > 1 ? 's' : ''}.`)
      onContinue()
    } catch {
      toast.error('Algunas asignaciones fallaron. Continúa y revísalo desde Administración.')
      onContinue()
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <StepHeader icon={<Link2 className="h-4 w-4" />} index={4} title="Asigna productores a CIAgros" />
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Marca a qué CIAgros pertenece cada productor. Un productor puede asignarse a
          varias CIAgros si trabaja con más de un equipo.
        </p>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Productor</th>
                {cias.map((c) => (
                  <th key={c.id} className="px-3 py-2 text-left font-medium">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {producers.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.commercial_name}</div>
                    <div className="text-xs text-muted-foreground">{p.code}</div>
                  </td>
                  {cias.map((c) => (
                    <td key={c.id} className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selections[p.id]?.has(c.id) ?? false}
                        onChange={() => toggle(p.id, c.id)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={onSkip}>Omitir asignaciones</Button>
          <Button onClick={confirm} disabled={mutation.isPending} className="gap-1.5">
            {mutation.isPending ? 'Asignando…' : (<>Guardar y continuar <ArrowRight className="h-4 w-4" /></>)}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Paso 5: Final + info sobre usuarios ────────────────────────────────────

function DoneStep({
  orgName,
  cias,
  producers,
  onFinish,
}: {
  orgName: string
  cias: CreatedCia[]
  producers: CreatedProducer[]
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
          {cias.length > 0 && (<>, con {cias.length} CIAgro{cias.length > 1 ? 's' : ''}</>)}
          {producers.length > 0 && (<> y {producers.length} productor{producers.length > 1 ? 'es' : ''}</>)}.
        </p>

        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 font-medium">
            <UserPlus className="h-4 w-4" /> Aún no hay usuarios registrados
          </div>
          <p className="text-muted-foreground">
            Cuando tus colaboradores entren al sistema necesitarás registrarlos como
            usuarios y asignarlos a las CIAgros donde van a trabajar. Para hacerlo, desde
            <em> Administración → Usuarios</em>:
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Crea cada usuario con su rol (Técnico, Supervisor, Gerente…).</li>
            <li>En <em>Administración → Organizaciones → CIAgro → Usuarios</em>, asígnalos a las CIAgros correspondientes.</li>
          </ol>
        </div>

        <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
          <p className="font-medium">También puedes:</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Crear más <strong>productores</strong> y asignarlos a CIAgros desde <em>Administración → Agrounidades</em>.</li>
            <li>Crear más <strong>CIAgros</strong> u organizaciones desde <em>Administración → Organizaciones</em>.</li>
          </ul>
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
