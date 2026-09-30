export type PlantingLayerKind = 'numeric' | 'category'

export interface PlantingLayerDef {
  key: string
  label: string
  field: string
  unit: string
  kind: PlantingLayerKind
  palette: string[]
  higherIsBetter?: boolean
}

export const PLANTING_MAP_LAYERS: PlantingLayerDef[] = [
  { key:'applied_rate', label:'Proporción aplicada', field:'Prop. ap. cta.(ksds/ha)', unit:'ksds/ha', kind:'numeric', palette:['#ef1b0c','#ff8c00','#ffd400','#d8ef00','#00e600','#00c8df','#001eff'] },
  { key:'target_rate', label:'Proporción meta', field:'Prop. meta(ksds/ha)', unit:'ksds/ha', kind:'numeric', palette:['#7f7df2'] },
  { key:'density', label:'Densidad', field:'Pob. plantas(ksds/ha)', unit:'ksds/ha', kind:'numeric', palette:['#f4f6f5','#dcebe3','#bed8ca','#8fbea5','#5b9e7c','#2f7f59','#0d6b42'], higherIsBetter:true },
  { key:'singulation', label:'Singulación', field:'Singulación(%)', unit:'%', kind:'numeric', palette:['#ef1b0c','#ff7a00','#ffae00','#ffd400','#d8ef00','#8bea00','#00f000'], higherIsBetter:true },
  { key:'seed_spacing', label:'Espaciamiento de semillas', field:'Espacio entre semillas(cm)', unit:'cm', kind:'numeric', palette:['#ef1b0c','#ff7a00','#ffae00','#ffd400','#d8ef00','#7bea00','#00e600'] },
  { key:'skips', label:'Saltos', field:'Saltos(%)', unit:'%', kind:'numeric', palette:['#ef1b0c','#ff7a00','#ffae00','#ffd400','#d8ef00','#7bea00','#00e600'], higherIsBetter:false },
  { key:'doubles', label:'Dobles', field:'Dobles(%)', unit:'%', kind:'numeric', palette:['#ef1b0c','#ff7a00','#ffae00','#ffd400','#d8ef00','#7bea00','#00e600'], higherIsBetter:false },
  { key:'rate_quality', label:'Rate Quality', field:'Rate Qual', unit:'', kind:'category', palette:['#075985','#8cc63f','#f4c430'] },
  { key:'speed', label:'Velocidad', field:'Velocidad(km/h)', unit:'km/h', kind:'numeric', palette:['#ef1b0c','#ff8c00','#ffd400','#d8ef00','#00e600'] },
  { key:'productivity', label:'Productividad', field:'Prod.(ha/h)', unit:'ha/h', kind:'numeric', palette:['#ef1b0c','#ff8c00','#ffd400','#d8ef00','#00e600'] },
]