import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiClient } from '@/lib/api/client'
import { Button } from '@/components/ui/button'

const range = z.object({ min: z.number().finite(), max: z.number().finite() }).nullable()
const catalogSchema = z.object({
  id: z.string().uuid(), name: z.string(), code: z.string(), revision: z.string(), description: z.string().nullable(),
  context: z.string().nullable(), scope_note: z.string(), configured_count: z.number().int(),
  catalog_status: z.enum(['PROVISIONAL', 'APROBADO']).nullable().optional(),
  source_period: z.string().nullable().optional(), sample_sessions: z.number().nullable().optional(),
  ranges: z.object({ speed_kmh: range, pressure_bar: range, flow_ls: range, productivity_hah: range }),
})
const pageSchema = z.object({ results: z.array(catalogSchema), next: z.string().nullable(), current_evaluation_id: z.string().nullable() })
const labels = { speed_kmh: 'Velocidad (km/h)', pressure_bar: 'Presión (bar)', flow_ls: 'Caudal (L/s)', productivity_hah: 'Productividad (ha/h)' }

export function SessionEvaluationSelector({ objectId }: { objectId: string }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const query = useQuery({
    queryKey: ['session-evaluations', objectId], enabled: open, retry: false,
    queryFn: async () => {
      const catalogs: z.infer<typeof catalogSchema>[] = []
      let current: string | null = null
      for (let page = 1; ; page++) {
        const { data, response } = await apiClient.GET('/api/v1/field_ops/aspersion-sessions/{id}/evaluation/' as never,
          { params: { path: { id: objectId }, query: { page } } } as never)
        if (!response.ok) throw new Error(`No se pudieron consultar los catálogos autorizados (HTTP ${response.status}).`)
        const parsed = pageSchema.safeParse(data)
        if (!parsed.success) throw new Error('Respuesta de catálogos inválida. Reintenta.')
        catalogs.push(...parsed.data.results)
        current = parsed.data.current_evaluation_id
        if (!parsed.data.next) break
        if (!parsed.data.results.length || page >= 1000) throw new Error('La paginación de catálogos no pudo completarse.')
      }
      return { catalogs, current }
    },
  })
  const selected = query.data?.catalogs.find(c => c.id === selectedId)
  const save = useMutation({
    mutationFn: async () => {
      if (!selected || !confirmed || !query.data) throw new Error('Selecciona y confirma el contexto del catálogo.')
      const { error, response } = await apiClient.PATCH('/api/v1/field_ops/aspersion-sessions/{id}/evaluation/' as never, {
        params: { path: { id: objectId } }, body: { evaluation_id: selected.id,
          expected_evaluation_id: query.data.current, catalog_revision: selected.revision, confirm_context: true },
      } as never)
      if (!response.ok) throw new Error((error as unknown as { detail?: string })?.detail ?? `No se pudo guardar la asociación (HTTP ${response.status}).`)
    },
    onSuccess: async () => {
      setConfirmed(false)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['aspersion-radar', objectId] }),
        qc.invalidateQueries({ queryKey: ['session-evaluations', objectId] }),
        qc.invalidateQueries({ queryKey: ['report-pdf-state'] }),
        qc.invalidateQueries({ queryKey: ['aspersion-headers'] }),
      ])
    },
  })
  return <div className="space-y-3 rounded border p-3 text-sm">
    <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>Seleccionar catálogo de evaluación</Button>
    {open && <>
      <p>Solo se modifica la asociación de esta sesión. No se crean catálogos ni se alteran reportes publicados.</p>
      {query.isLoading && <p role="status">Consultando catálogos autorizados…</p>}
      {query.isError && <div role="alert">{query.error.message} <Button onClick={() => void query.refetch()}>Reintentar</Button></div>}
      {query.data && <>
        <label className="block">Catálogo disponible
          <select className="mt-1 block w-full rounded border bg-background p-2" value={selectedId} disabled={save.isPending}
            onChange={e => { setSelectedId(e.target.value); setConfirmed(false); save.reset() }}>
            <option value="">Selecciona un catálogo; no se asigna automáticamente</option>
            {query.data.catalogs.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>
        </label>
        {!query.data.catalogs.length && <p>No hay catálogos disponibles dentro de tu alcance.</p>}
      </>}
      {selected && <div className="space-y-2 rounded bg-muted/50 p-3">
        <p className="font-medium">{selected.name} · {selected.code} · {selected.catalog_status ?? 'Sin clasificar'}</p>
        <p>Contexto: {selected.context || 'No documentado; requiere verificación técnica.'}</p>
        {selected.catalog_status === 'PROVISIONAL' && <p className="rounded bg-amber-100 p-2 text-amber-950">Rango provisional basado en histórico ({selected.sample_sessions ?? '—'} sesiones, {selected.source_period ?? 'periodo no indicado'}). La puntuación no es una evaluación técnica aprobada.</p>}
        <p className="text-xs">{selected.description} {selected.scope_note}</p>
        <dl className="grid gap-2 sm:grid-cols-2">{Object.entries(labels).map(([key, label]) => {
          const r = selected.ranges[key as keyof typeof labels]
          return <div key={key}><dt className="text-muted-foreground">{label}</dt><dd>{r ? `${r.min} – ${r.max}` : 'Pendiente de configurar rango operativo'}
            {key === 'pressure_bar' && r && <span className="block">{(r.min * 14.5037738).toFixed(2)} – {(r.max * 14.5037738).toFixed(2)} psi</span>}</dd></div>
        })}</dl>
        {selected.configured_count < 4 && <p role="status">Advertencia: {selected.configured_count} de 4 rangos configurados. Asociar este catálogo no completa por sí solo la evaluación.</p>}
        <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} disabled={save.isPending}
          onChange={e => setConfirmed(e.target.checked)} />Confirmo que este catálogo corresponde al equipo, organización y contexto de esta sesión.</label>
        <Button disabled={!confirmed || save.isPending || selected.id === query.data?.current} onClick={() => save.mutate()}>
          {save.isPending ? 'Guardando asociación…' : 'Asociar a esta sesión'}
        </Button>
      </div>}
      {save.isError && <p role="alert" className="text-destructive">{save.error.message}</p>}
      {save.isSuccess && <p role="status">Asociación guardada. Radar actualizado; vuelve a preparar los PDF en proceso que correspondan.</p>}
    </>}
  </div>
}
