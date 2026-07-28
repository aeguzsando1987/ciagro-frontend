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
import {
  useNdviVariableConfig,
  useNdviVariables,
  useUpdateNdviVariableConfig,
  readVariableConfig,
  type Band,
  type VariableBandConfig,
} from '@/features/geodata-visor/hooks/useNdviVariableConfig'

const DEFAULT_COLORS = ['#d7191c', '#fdae61', '#ffffbf', '#a6d96a', '#1a9850']

function newBand(order: number): Band {
  return { order, min: 0, max: 1, label: `Clase ${order + 1}`, color: DEFAULT_COLORS[order % DEFAULT_COLORS.length]! }
}

export function NdviVariablesSection() {
  const { data: variables = [], isLoading: loadingVars } = useNdviVariables()
  const { data: config, isLoading: loadingConfig, isError, error } = useNdviVariableConfig()
  const update = useUpdateNdviVariableConfig()

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

  if (isError) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Configuración de variables de análisis</h1>
        <p className="rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Solo un Gerente dueño de la organización puede configurar estos umbrales.
          {error instanceof Error ? ` (${error.message})` : ''}
        </p>
      </div>
    )
  }

  const bands = draft.bands ?? []

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
        : { strategy: 'quartile', n_bands: draft.n_bands ?? 4 }
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
              <div className="space-y-1">
                <Label htmlFor="nbands">Número de clases</Label>
                <Input
                  id="nbands"
                  type="number"
                  min={2}
                  max={8}
                  className="w-24"
                  value={draft.n_bands ?? 4}
                  onChange={(e) => setDraft((d) => ({ ...d, n_bands: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground">
                  Los cortes se calculan de los datos de cada sesión (sin definir umbrales fijos).
                </p>
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
