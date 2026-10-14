/** Color settings for aspersion, soil mapping, yield and planting. Original NDVI UI untouched. */
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { ASPERSION_LAYERS, APPLICATION_CATEGORIES, RATE_QUALITY_CATEGORIES, QUARTILE_PALETTES, TARGET_PALETTE } from '@/features/task-manager/lib/aspersionLayers'
import { SOIL_MAP_LAYERS } from '@/features/task-manager/lib/soilMapLayers'
import { YIELD_LAYERS } from '@/features/yield-map/lib/yieldMapLayers'
import { PLANTING_MAP_LAYERS } from '@/features/planting-map/lib/plantingMapLayers'
import { type AppearanceKind, type LayerAppearance, appearancePalette, colorStops, useLayerAppearance, useResetLayerAppearance, useSaveLayerAppearance } from './useLayerAppearance'

type CatalogLayer = {key:string; label:string; palette:string[]; unit:string; categories?:Record<string,string>}
const aspersionCatalog: CatalogLayer[] = ASPERSION_LAYERS.map(l=> {
  const categories = l.key==='application' ? APPLICATION_CATEGORIES : l.key==='rate_quality' ? RATE_QUALITY_CATEGORIES : null
  return {key:l.key,label:l.label,unit:l.unit,palette: categories ? categories.map(x=>x.color) : l.key==='target_rate' ? TARGET_PALETTE : [...QUARTILE_PALETTES[l.key as keyof typeof QUARTILE_PALETTES] ?? []],categories:categories ? Object.fromEntries(categories.map(c=>[c.key,c.color])) : undefined}
})
const catalog: Record<AppearanceKind,CatalogLayer[]> = {
  aspersion:aspersionCatalog,
  soil_map:SOIL_MAP_LAYERS.map(l=>({key:l.key,label:l.label,unit:l.unit,palette:[...l.palette],categories:l.kind==='category' ? {...l.categoryColors} : undefined})),
  yield_map:YIELD_LAYERS.map(l=>({key:l.key,label:l.label,unit:l.unit,palette:l.palette})),
  planting_map:PLANTING_MAP_LAYERS.map(l=>({key:l.key,label:l.label,unit:l.unit,palette:l.palette})),
}
export function LayerVariablesSection({activeKind, tenantId}: {activeKind: AppearanceKind; tenantId: string}) {
  const kind = activeKind
  // Al abrir una sesión, muestra su primera capa como NDVI.
  // La vista completa sigue vacía hasta elegir una sesión desde el panel padre.
  const [selected,setSelected]=useState<string>(() => catalog[kind][0]?.key ?? '')
  const [draft,setDraft]=useState<LayerAppearance>({})
  const [manual,setManual]=useState(false)
  const [rangeMin,setRangeMin]=useState('')
  const [rangeMax,setRangeMax]=useState('')
  const [rangeError,setRangeError]=useState('')
  useEffect(()=>{setSelected(catalog[kind][0]?.key ?? '')},[kind])
  const {data:stored,isLoading,error}=useLayerAppearance(kind,tenantId || undefined,undefined,!!tenantId)
  const save=useSaveLayerAppearance(kind,tenantId||undefined)
  const reset=useResetLayerAppearance(kind,tenantId||undefined)
  const layer = catalog[kind].find(l=>l.key===selected)
  useEffect(()=>{
    const entry = catalog[kind].find(l=>l.key===selected)
    if(!entry)return
    const cfg = stored?.layers[selected]
    setDraft({colors:appearancePalette(entry.palette,cfg),...(cfg?.category_colors ? {category_colors:{...cfg.category_colors}} : {}),...(cfg?.breaks ? {breaks:[...cfg.breaks]} : {})})
    setManual(!!cfg?.breaks)
    setRangeMin(cfg?.range_min != null ? String(cfg.range_min) : '')
    setRangeMax(cfg?.range_max != null ? String(cfg.range_max) : '')
    setRangeError('')
  },[stored,kind,selected])
  const isCategorical = !!layer?.categories || (kind==='planting_map' && selected==='rate_quality') || (kind==='aspersion' && selected==='target_rate')
  const palette=draft.colors?.length ? draft.colors : (layer?.palette ?? [])
  function setColor(i:number,color:string) {setDraft(x=>({ ...x,colors:palette.map((c,j)=>j===i?color:c)}))}
  function changeCount(n:number) {
    const colors=colorStops(palette,n)
    const min = Number(rangeMin), max = Number(rangeMax)
    const validRange = rangeMin.trim() !== '' && rangeMax.trim() !== '' && Number.isFinite(min) && Number.isFinite(max) && min < max
    setDraft({colors, ...(manual ? {breaks:Array.from({length:n-1},(_,i)=>validRange ? min+(max-min)*(i+1)/n : i+1)} : {})})
  }
  function updateRange(nextMin:string,nextMax:string){
    setRangeMin(nextMin)
    setRangeMax(nextMax)
    setRangeError('')
    const min=Number(nextMin), max=Number(nextMax)
    if (manual && nextMin.trim()!=='' && nextMax.trim()!=='' && Number.isFinite(min) && Number.isFinite(max) && max>min && palette.length>=2) {
      // Al ajustar los extremos, redistribuye clases; los cortes siguen editables uno a uno.
      setDraft(d=>({...d,breaks:Array.from({length:palette.length-1},(_,i)=>min+(max-min)*(i+1)/palette.length)}))
    }
  }
  function saveNow(){
    if(!layer) return
    if(!tenantId){toast.error('Elige la organización');return}
    const minText=rangeMin.trim(), maxText=rangeMax.trim()
    const hasRange=minText!==''||maxText!==''
    const min=Number(rangeMin), max=Number(rangeMax)
    if (manual && hasRange && (minText===''||maxText===''||!Number.isFinite(min)||!Number.isFinite(max)||min>=max)) {
      setRangeError('Introduce un mínimo y un máximo válidos (mínimo menor que máximo).')
      return
    }
    if (manual && (!draft.breaks || draft.breaks.length!==palette.length-1 || draft.breaks.some((cut,i)=>!Number.isFinite(cut) || (i>0 && cut<=draft.breaks![i-1]!) || (hasRange && (cut<=min||cut>=max))))) {
      setRangeError('Los cortes deben ser números crecientes y estar dentro del rango mínimo–máximo.')
      return
    }
    setRangeError('')
    const config: LayerAppearance = isCategorical
      ? {colors:palette, ...(layer.categories? {category_colors:draft.category_colors ?? {}} : {})}
      : {colors:palette,...(manual?{breaks:draft.breaks,...(hasRange?{range_min:min,range_max:max}:{})}: {})}
    save.mutate({layer:layer.key,config},{onSuccess:()=>toast.success('Colores y rangos guardados para la organización'),onError:e=>toast.error(`No se pudo guardar: ${e.message}`)})
  }
  return <div className="space-y-5">
    <div className="grid gap-5 md:grid-cols-[220px_1fr]">
      <div className="max-h-[65vh] overflow-y-auto rounded border p-1">{catalog[kind].map(l=><button type="button" key={l.key} onClick={()=>setSelected(l.key)} className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted ${selected===l.key?'bg-primary/10 font-semibold':''}`}>{l.label}</button>)}</div>
      <div className="min-w-0 space-y-4">{!layer ? <p className="rounded-lg border p-8 text-sm text-muted-foreground">Selecciona una capa para mostrar sus colores y rangos.</p> : <>
        <h2 className="font-semibold">{layer.label} {layer.unit ? `(${layer.unit})`:''}</h2>
        {isLoading ? <p>Cargando configuración…</p> : error ? <div role="alert" className="rounded-md border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive"><p className="font-medium">No se pudo cargar la configuración; el guardado está bloqueado para evitar perder datos.</p><p className="mt-1 break-words">{error.message}</p><p className="mt-2 text-xs">Revisa el backend, la migración analytics_config y los permisos del usuario sobre esta organización.</p></div> : null}
        <p className="text-xs text-muted-foreground">Colores por defecto: {layer.palette.length}. Puedes personalizarlos y restaurarlos.</p>
        {!isCategorical && <div className="space-y-2">
          <Label>Número de clases (2–12)</Label><Input type="number" min={2} max={12} className="w-24" value={palette.length} onChange={e=>{const n=Number(e.target.value);if(n>=2&&n<=12)changeCount(n)}} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={palette.length<2} checked={manual} onChange={e=>{const checked=e.target.checked;setManual(checked);setDraft(d=>({...d,breaks:checked?Array.from({length:palette.length-1},(_,i)=>{
            const min=Number(rangeMin),max=Number(rangeMax)
            return rangeMin.trim()!==''&&rangeMax.trim()!==''&&min<max ? min+(max-min)*(i+1)/palette.length : (d.breaks?.[i] ?? i+1)
          }):undefined}))}}/> Umbrales manuales (en orden ascendente)</label>
        </div>}
        <div className="flex flex-wrap gap-3">{palette.map((color,i)=><label key={i} className="flex flex-col items-center gap-1 text-xs"><input type="color" aria-label={`Color ${i+1}`} value={color} onChange={e=>setColor(i,e.target.value)} className="h-10 w-12 cursor-pointer"/><span>{i+1}</span><span className="text-muted-foreground">{color}</span></label>)}</div>
        {manual && !isCategorical && <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-medium">Rango fijo para toda la organización (opcional)</p>
          <p className="text-xs text-muted-foreground">Ejemplo: mínimo 0, máximo 2500. Si se dejan vacíos, los extremos continuarán ajustándose a los datos. Las mediciones originales no se alteran.</p>
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1"><Label>Mínimo ({layer.unit||'valor'})</Label><Input type="number" step="any" className="w-32" value={rangeMin} onChange={e=>updateRange(e.target.value,rangeMax)} placeholder="Automático" /></div>
            <div className="space-y-1"><Label>Máximo ({layer.unit||'valor'})</Label><Input type="number" step="any" className="w-32" value={rangeMax} onChange={e=>updateRange(rangeMin,e.target.value)} placeholder="Automático" /></div>
          </div>
          <Button type="button" variant="outline" size="sm" disabled={rangeMin.trim()===''||rangeMax.trim()===''||!(Number(rangeMax)>Number(rangeMin))}
            onClick={()=>{const min=Number(rangeMin),max=Number(rangeMax);setDraft(d=>({...d,breaks:Array.from({length:palette.length-1},(_,i)=>min+(max-min)*(i+1)/palette.length)}));setRangeError('')}}>Distribuir cortes equitativamente</Button>
          <Label>Cortes entre bandas ({layer.unit || 'valor'})</Label><div className="flex flex-wrap gap-2">{palette.slice(1).map((_,i)=><Input key={i} type="number" step="any" className="w-28" aria-label={`Corte ${i+1}`} value={draft.breaks?.[i] ?? ''} onChange={e=>setDraft(d=>({ ...d,breaks:(d.breaks ?? []).map((v,j)=>j===i?Number(e.target.value):v)}))}/>)}</div><p className="text-xs text-muted-foreground">Introduce valores reales crecientes. El primero delimita las clases 1 y 2.</p>
          <div className="space-y-2 rounded-md bg-muted/40 p-3">
            <Label>Vista previa de las clases</Label>
            {palette.map((color,i)=>{
              const lower=i===0 ? (rangeMin.trim()!==''?rangeMin:'Sin límite inferior') : String(draft.breaks?.[i-1]??'—')
              const upper=i===palette.length-1 ? (rangeMax.trim()!==''?rangeMax:'Sin límite superior') : String(draft.breaks?.[i]??'—')
              return <div key={i} className="flex items-center gap-3 text-xs"><span className="h-5 w-6 shrink-0 rounded border" style={{backgroundColor:color}} />Clase {i+1}: {lower} – {upper} {layer.unit}</div>
            })}
          </div>
        </div>}
        {rangeError && <p role="alert" className="text-sm text-destructive">{rangeError}</p>}
        {layer.categories && <div className="space-y-2"><Label>Colores por categoría</Label>{Object.entries(layer.categories).map(([name,original])=><div key={name} className="flex items-center gap-3 text-sm"><input type="color" aria-label={name} value={draft.category_colors?.[name] ?? original} onChange={e=>setDraft(d=>({...d,category_colors:{...d.category_colors,[name]:e.target.value}}))}/>{name}</div>)}</div>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!tenantId||save.isPending||!!error||isLoading} onClick={saveNow}>Guardar colores y rangos</Button>
          <Button variant="outline" disabled={!tenantId||reset.isPending||!!error||isLoading} onClick={()=>reset.mutate(layer.key,{onSuccess:()=>toast.success('Colores originales restaurados'),onError:e=>toast.error(e.message)})}>Restaurar predeterminados</Button>
        </div>
      </>}
      </div>
    </div>
  </div>
}
