/**
 * Catálogo de definición de variables de análisis — pestaña NDVI.
 *
 * El manager de la organización configura, por cada variable NDVI, cómo se clasifican sus
 * valores para pintar el mapa: modo automático (cuartiles de los datos) o manual (intervalos
 * Vmin–x1..xn–Vmax con etiqueta y color). Consume /api/v1/analytics-config/ndvi/.
 *
 * Los umbrales aplican a TODA la organización (todas sus parcelas).
 */
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { useDataCentralMains } from '@/features/admin/hooks/useDataCentrals'
import {
  useNdviVariableConfig,
  useNdviVariables,
  useUpdateNdviVariableConfig,
  readVariableConfig,
  resolveQuartileColors,
  type Band,
  type VariableBandConfig,
} from '@/features/geodata-visor/hooks/useNdviVariableConfig'

const DEFAULT_COLORS = ['#d7191c', '#fdae61', '#ffffbf', '#a6d96a', '#1a9850']

function newBand(order: number): Band {
  return { order, min: 0, max: 1, label: `Clase ${order + 1}`, color: DEFAULT_COLORS[order % DEFAULT_COLORS.length]! }
}

/** Extrae el mensaje de error que manda el backend (400 por tenant ambiguo, 403 sin permiso, etc). */
function extractErrorDetail(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined
  const obj = error as Record<string, unknown>
  const raw = obj.detail ?? obj.tenant
  return typeof raw === 'string' ? raw : undefined
}

export function NdviVariablesSection() {
  const user = useAuthStore((s) => s.user)
  const roleLevel = user?.role_level ?? 0
  const isSuperAdmin = roleLevel >= ROLE_LEVELS.SUPER_ADMIN

  // Organizaciones que el usuario puede configurar: las que posee (Gerente dueño), o
  // todas si es SuperAdmin (puede operar sobre cualquier tenant indicándolo).
  const { data: allOrgs = [], isLoading: loadingOrgs } = useDataCentralMains()
  const configurableOrgs = useMemo(
    () => (isSuperAdmin ? allOrgs : allOrgs.filter((o) => o.is_owner)),
    [allOrgs, isSuperAdmin],
  )

  const [tenantId, setTenantId] = useState<string>('')

  // Con una sola organización configurable, se selecciona sola; si hay varias (o es
  // SuperAdmin), el usuario debe elegir explícitamente.
  useEffect(() => {
    if (!tenantId && configurableOrgs.length === 1) setTenantId(configurableOrgs[0]!.id)
  }, [configurableOrgs, tenantId])

  const needsTenantChoice = configurableOrgs.length !== 1
  const tenantReady = !needsTenantChoice || !!tenantId

  const { data: variables = [], isLoading: loadingVars } = useNdviVariables()
  const {
    data: config,
    isLoading: loadingConfig,
    isError,
    error,
  } = useNdviVariableConfig(tenantId || undefined, { enabled: tenantReady })
  const update = useUpdateNdviVariableConfig(tenantId || undefined)

  const [selected, setSelected] = useState<string>('')
  const [draft, setDraft] = useState<VariableBandConfig>({ strategy: 'quartile', n_bands: 4 })

  // Al elegir variable (o al cargar la config), poblar el borrador desde el servidor.
  useEffect(() => {
    if (!selected && variables.length > 0) setSelected(variables[0]!.key)
  }, [variables, selected])

  useEffect(() => {
    if (selected) setDraft(readVariableConfig(config, selected))
  }, [selected, config])

  const selectedLabel = useMemo(
    () => variables.find((v) => v.key === selected)?.label ?? selected,
    [variables, selected],
  )

  const orgPicker = needsTenantChoice && !loadingOrgs && (
    <div className="max-w-xs space-y-1">
      <Label>Organización</Label>
      <Select value={tenantId} onValueChange={setTenantId}>
        <SelectTrigger>
          <SelectValue placeholder="Elige una organización…" />
        </SelectTrigger>
        <SelectContent>
          {configurableOrgs.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  if (!loadingOrgs && configurableOrgs.length === 0) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Configuración de variables de análisis</h1>
        <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Solo un Gerente dueño de la organización puede configurar estos umbrales. Tu usuario no
          es dueño de ninguna organización.
        </p>
      </div>
    )
  }

  if (needsTenantChoice && !tenantId) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Configuración de variables de análisis</h1>
          <p className="text-sm text-muted-foreground">
            Posees más de una organización: elige sobre cuál configurar los umbrales.
          </p>
        </div>
        {orgPicker}
      </div>
    )
  }

  if (isError) {
    const detail = extractErrorDetail(error)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Configuración de variables de análisis</h1>
        {orgPicker}
        <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {detail ?? 'Solo un Gerente dueño de la organización puede configurar estos umbrales.'}
        </p>
      </div>
    )
  }

  const bands = draft.bands ?? []
  const nBands = draft.n_bands ?? 4
  const quartileColors = resolveQuartileColors(draft, nBands)

  const setQuartileColor = (i: number, color: string) => {
    setDraft((d) => {
      const next = resolveQuartileColors(d, d.n_bands ?? 4).slice()
      next[i] = color
      return { ...d, colors: next }
    })
  }

  const setBand = (i: number, patch: Partial<Band>) => {
    setDraft((d) => {
      const next = [...(d.bands ?? [])]
      next[i] = { ...next[i]!, ...patch }
      return { ...d, bands: next }
    })
  }
  const addBand = () => setDraft((d) => ({ ...d, bands: [...(d.bands ?? []), newBand((d.bands ?? []).length)] }))
  const removeBand = (i: number) =>
    setDraft((d) => ({ ...d, bands: (d.bands ?? []).filter((_, k) => k !== i).map((b, k) => ({ ...b, order: k })) }))

  const onSave = () => {
    const payload: VariableBandConfig =
      draft.strategy === 'manual'
        ? { strategy: 'manual', mode: draft.mode ?? 'absolute', bands }
        : { strategy: 'quartile', n_bands: nBands, colors: quartileColors }
    update.mutate(
      { [selected]: payload },
      {
        onSuccess: () => toast.success(`Configuración de ${selectedLabel} guardada.`),
        onError: (e) => {
          // El backend valida por variable: muestra el mensaje si viene.
          const obj = e as unknown as Record<string, unknown>
          const msg = obj && typeof obj === 'object' && selected in obj
            ? String(obj[selected])
            : 'No se pudo guardar (revisa los intervalos: continuos, color hex, sin huecos).'
          toast.error(msg)
        },
      },
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Configuración de variables de análisis</h1>
        <p className="text-sm text-muted-foreground">
          Define cómo se clasifican y colorean las variables en el visor. Aplica a toda la organización.
        </p>
      </div>

      {orgPicker}

      {/* Pestaña única por ahora: NDVI. */}
      <div className="flex gap-2 border-b">
        <span className="border-b-2 border-primary px-3 py-1.5 text-sm font-medium">NDVI (Índices vegetativos)</span>
      </div>

      {loadingVars || loadingConfig ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          {/* Lista de variables */}
          <ul className="max-h-[60vh] space-y-0.5 overflow-auto rounded border p-1">
            {variables.map((v) => (
              <li key={v.key}>
                <button
                  type="button"
                  onClick={() => setSelected(v.key)}
                  className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${
                    selected === v.key ? 'bg-accent font-medium' : ''
                  }`}
                >
                  {v.label}
                </button>
              </li>
            ))}
          </ul>

          {/* Editor de la variable seleccionada */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium">{selectedLabel}</h2>

            {/* Estrategia */}
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={draft.strategy === 'quartile' ? 'default' : 'outline'}
                onClick={() => setDraft((d) => ({ ...d, strategy: 'quartile' }))}
              >
                Automático (cuartiles)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={draft.strategy === 'manual' ? 'default' : 'outline'}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    strategy: 'manual',
                    mode: d.mode ?? 'absolute',
                    bands: d.bands && d.bands.length > 0 ? d.bands : [newBand(0), newBand(1)],
                  }))
                }
              >
                Manual (umbrales)
              </Button>
            </div>

            {draft.strategy === 'quartile' ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="nbands">Número de clases</Label>
                  <Input
                    id="nbands"
                    type="number"
                    min={2}
                    max={6}
                    className="w-24"
                    value={nBands}
                    onChange={(e) => {
                      const n = Math.max(2, Math.min(6, Number(e.target.value) || 2))
                      setDraft((d) => ({ ...d, n_bands: n, colors: resolveQuartileColors(d, n) }))
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Los cortes se calculan de los datos de cada sesión (sin definir umbrales fijos).
                  </p>
                </div>

                <div className="space-y-1">
                  <Label>Colores de los cuantiles (de menor a mayor)</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {quartileColors.map((c, i) => (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <input
                          type="color"
                          className="h-8 w-10 cursor-pointer rounded border"
                          value={c}
                          onChange={(e) => setQuartileColor(i, e.target.value)}
                          aria-label={`Color del cuantil ${i + 1}`}
                        />
                        <span className="text-[10px] text-muted-foreground">Q{i + 1}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El visor pinta cada cuantil con su color; los umbrales siguen saliendo de los datos.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label>Modo:</Label>
                  <select
                    className="rounded border px-2 py-1 text-sm"
                    value={draft.mode ?? 'absolute'}
                    onChange={(e) => setDraft((d) => ({ ...d, mode: e.target.value as 'absolute' | 'normalized' }))}
                  >
                    <option value="absolute">Absoluto (−∞…+∞)</option>
                    <option value="normalized">Normalizado</option>
                  </select>
                </div>

                <div className="space-y-2">
                  {bands.map((b, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
                      <Input
                        type="number"
                        step="any"
                        placeholder={i === 0 ? '−∞' : 'min'}
                        className="w-24"
                        value={b.min ?? ''}
                        onChange={(e) => setBand(i, { min: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="number"
                        step="any"
                        placeholder={i === bands.length - 1 ? '+∞' : 'max'}
                        className="w-24"
                        value={b.max ?? ''}
                        onChange={(e) => setBand(i, { max: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                      <Input
                        type="text"
                        placeholder="Etiqueta"
                        className="flex-1"
                        value={b.label}
                        onChange={(e) => setBand(i, { label: e.target.value })}
                      />
                      <input
                        type="color"
                        className="h-8 w-10 cursor-pointer rounded border"
                        value={b.color}
                        onChange={(e) => setBand(i, { color: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => removeBand(i)}
                        className="px-1 text-muted-foreground hover:text-destructive"
                        aria-label="Quitar intervalo"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <Button type="button" size="sm" variant="outline" onClick={addBand}>
                  + Agregar intervalo
                </Button>
                <p className="text-xs text-muted-foreground">
                  Los intervalos deben ser continuos (el max de uno es el min del siguiente). El primer
                  min y el último max pueden dejarse vacíos (−∞ / +∞) en modo absoluto.
                </p>
              </div>
            )}

            <div className="pt-2">
              <Button type="button" onClick={onSave} disabled={update.isPending}>
                {update.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
