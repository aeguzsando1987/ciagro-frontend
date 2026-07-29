import type { SoilMapPoint } from '../hooks/useSoilMapPoints'

export type SoilMapNumericField = Extract<
  keyof SoilMapPoint,
  | 'Countrate'
  | 'OM'
  | 'Clay'
  | 'Silt'
  | 'Sand'
  | 'Elevation'
  | 'PAWater'
  | 'CC'
  | 'BulkDens'
  | 'CEC'
  | 'Cond'
  | 'pH'
  | 'Na_bse'
  | 'Na'
  | 'P_total'
  | 'P'
  | 'P_disp'
  | 'K_bse'
  | 'K_total'
  | 'K'
  | 'K_disp'
  | 'Ca_bse'
  | 'Ca_total'
  | 'Ca'
  | 'Ca_disp'
  | 'Cu'
  | 'Cu_disp'
  | 'Ca_Mg'
  | 'K_Mg'
  | 'Mg_bse'
  | 'Mg_total'
  | 'Mg'
  | 'Mg_disp'
  | 'B'
  | 'Fe'
  | 'Fe_disp'
  | 'Mn'
  | 'Mn_disp'
  | 'S_total'
  | 'S'
  | 'S_disp'
  | 'Zn'
  | 'Zn_disp'
  | 'lim_inf_CC'
  | 'Cap_efi_fert'
  | 'C_de_MO'
>

export type SoilMapTextField = Extract<
  keyof SoilMapPoint,
  'classtexture' | 'compfisic' | 'compquim'
>

interface SoilMapLayerBase {
  key: string
  label: string
  field: SoilMapNumericField | SoilMapTextField
  group: string
  unit: string
  /** El orden de la paleta siempre es valor alto → valor bajo. */
  palette: readonly string[]
}

export interface SoilMapNumericLayerDef extends SoilMapLayerBase {
  kind: 'numeric'
  field: SoilMapNumericField
}

export interface SoilMapCategoryLayerDef extends SoilMapLayerBase {
  kind: 'category'
  field: SoilMapTextField
  /** Colores oficiales por valor normalizado. */
  categoryColors?: Readonly<Record<string, string>>
  /** Color neutro para categorías cuyo color oficial todavía no está definido. */
  fallbackColor?: string
}

export type SoilMapLayerDef = SoilMapNumericLayerDef | SoilMapCategoryLayerDef

export interface SoilMapLegendEntry {
  key: string
  color: string
  label: string
}

export interface SoilNumericScale {
  min: number
  max: number
  /** Cortes ascendentes. Para siete colores existen seis cortes. */
  breaks: number[]
  entries: SoilMapLegendEntry[]
}

const COUNTRATE = ['#FF0100', '#FF8800', '#FFE100', '#F8FF00', '#00D8FF', '#008FFF', '#0C00FF']
const ORGANIC_MATTER = ['#808040', '#9D9D72', '#B4B499', '#C8C8B7', '#D8D8CF', '#E5E5E1', '#F0F0F0']
const CLAY = ['#592D00', '#826549', '#A39180', '#BDB3A9', '#D2CCC7', '#E3E1DF', '#F0F0F0']
const SILT = ['#804000', '#9D7249', '#B49980', '#C8B7A9', '#D8CFC7', '#E5E1DF', '#F0F0F0']
const SAND = ['#D2D200', '#D8D849', '#DEDE80', '#E3E3A9', '#E7E7C7', '#ECECDF', '#F0F0F0']
const ELEVATION = ['#F0F0F0', '#DFDFF3', '#C7C7F6', '#A9A9F8', '#7F7FFB', '#4949FD', '#0000FF']
const AVAILABLE_WATER = [
  '#0080FF',
  '#499DFD',
  '#80B4FB',
  '#A9C8F8',
  '#C7D8F6',
  '#DFE5F3',
  '#F0F0F0',
]
const FIELD_CAPACITY = ['#00FFFF', '#49FDFD', '#80FBFB', '#A9F8F8', '#C7F6F6', '#DFF3F3', '#F0F0F0']
const DENSITY = ['#800080', '#9D499D', '#B480B4', '#C8A9C8', '#D8C7D8', '#E5DFE5', '#F0F0F0']
const CEC = ['#8080C0', '#9D9DCA', '#B4B4D4', '#C8C8DC', '#D8D8E3', '#E5E5EA', '#F0F0F0']
const CONDUCTIVITY = ['#0080C0', '#499DCA', '#80B4D4', '#A9C8DC', '#C7D8E3', '#DFE5EA', '#F0F0F0']
const PH = ['#FF0000', '#FF6F00', '#FF9700', '#FFCF00', '#FFF500', '#F2FF00', '#BFFF00']
const SODIUM = ['#FF0000', '#FD4949', '#FB8080', '#F8A9A9', '#F6C7C7', '#F3DFDF', '#F0F0F0']
const PHOSPHORUS = ['#8080FF', '#9D9DFD', '#B4B4FB', '#C8C8F8', '#D8D8F6', '#E5E5F3', '#F0F0F0']
const POTASSIUM = ['#80FF00', '#9DFD49', '#B4FB80', '#C8F8A9', '#D8F6C7', '#E5F3DF', '#F0F0F0']
const CALCIUM = ['#FF8040', '#FD9D72', '#FBB499', '#F8C8B7', '#F6D8CF', '#F3E5E1', '#F0F0F0']
const COPPER = ['#800000', '#9D4949', '#B48080', '#C8A9A9', '#D8C7C7', '#E5DFDF', '#F0F0F0']
const CA_MG = ['#FF712D', '#FF805B', '#FF8E81', '#FF9B9F', '#FFA7B8', '#FFB1CD', '#FFBBDD']
const K_MG = ['#FF80C0', '#F4A4AC', '#E7C095', '#D6D679', '#C0E758', '#A4F530', '#80FF00']
const MAGNESIUM = ['#FF80C0', '#FD9DCA', '#FBB4D4', '#F8C8DC', '#F6D8E3', '#F3E5EA', '#F0F0F0']
const BORON = ['#FF8080', '#FD9D9D', '#FBB4B4', '#F8C8C8', '#F6D8D8', '#F3E5E5', '#F0F0F0']
const IRON = ['#FF0000']
const MANGANESE = ['#FFFF00', '#FDFD49', '#FBFB80', '#F8F8A9', '#F6F6C7', '#F3F3DF', '#F0F0F0']
const MANGANESE_AVAILABLE = [
  '#FFFF00',
  '#FFFF00',
  '#FDFD49',
  '#FBFB80',
  '#F8F8A9',
  '#F6F6C7',
  '#F3F3DF',
  '#F0F0F0',
]
const SULPHUR = ['#8000FF', '#9D49FD', '#B480FB', '#C8A9F8', '#D8C7F6', '#E5DFF3', '#F0F0F0']
const ZINC = ['#408080', '#729D9D', '#99B4B4', '#B7C8C8', '#CFD8D8', '#E1E5E5', '#F0F0F0']
const UNKNOWN_CATEGORY_COLOR = '#94A3B8'

const numericLayer = (
  key: string,
  label: string,
  field: SoilMapNumericField,
  group: string,
  unit: string,
  palette: readonly string[]
): SoilMapNumericLayerDef => ({
  key,
  label,
  field,
  group,
  unit,
  palette,
  kind: 'numeric',
})

export const SOIL_MAP_LAYERS: SoilMapLayerDef[] = [
  numericLayer('countrate', 'Countrate', 'Countrate', 'Propiedades generales', '', COUNTRATE),
  numericLayer(
    'organic_matter',
    'MO del Suelo',
    'OM',
    'Propiedades generales',
    '%',
    ORGANIC_MATTER
  ),
  numericLayer('clay', 'HZ1 % arcilla del suelo', 'Clay', 'Textura y física', '%', CLAY),
  numericLayer('silt', 'HZ1 % cieno del suelo', 'Silt', 'Textura y física', '%', SILT),
  numericLayer('sand', 'HZ1 % Arena del suelo', 'Sand', 'Textura y física', '%', SAND),
  /*
   * Colorimetría categórica pendiente de completar con el proveedor:
   * - Clase textural: Arenoso, Franco Limoso, "desconocido" y otras clases que
   *   pueden aparecer en futuros CSV todavía no tienen color oficial.
   * - Compactación física: solo está confirmado "Baja compactación". El valor
   *   "desconocido" y cualquier categoría adicional siguen sin color oficial.
   *
   * Mientras se confirman, se muestran en gris neutro para no atribuirles un
   * significado agronómico incorrecto.
   */
  {
    key: 'texture_class',
    label: 'Clase textural',
    field: 'classtexture',
    group: 'Textura y física',
    unit: '',
    palette: ['#6A3535', '#804040', '#F0F0F0'],
    kind: 'category',
    categoryColors: {
      arcilloso: '#6A3535',
      franco: '#804040',
      'franco limoso arcilloso': '#F0F0F0',
    },
    fallbackColor: UNKNOWN_CATEGORY_COLOR,
  },
  {
    key: 'physical_compaction',
    label: 'Compactación física',
    field: 'compfisic',
    group: 'Textura y física',
    unit: '',
    palette: ['#BC92BC'],
    kind: 'category',
    categoryColors: {
      'baja compactacion': '#BC92BC',
      'baja compactación': '#BC92BC',
    },
    fallbackColor: UNKNOWN_CATEGORY_COLOR,
  },
  {
    key: 'chemical_compaction',
    label: 'Compactación química',
    field: 'compquim',
    group: 'Textura y física',
    unit: '',
    palette: ['#0000A0'],
    kind: 'category',
  },
  numericLayer('elevation', 'Elevación', 'Elevation', 'Propiedades generales', '', ELEVATION),
  numericLayer(
    'available_water',
    'Agua disponible',
    'PAWater',
    'Agua y estructura',
    '%',
    AVAILABLE_WATER
  ),
  numericLayer(
    'field_capacity',
    'Capacidad de Campo',
    'CC',
    'Agua y estructura',
    '%',
    FIELD_CAPACITY
  ),
  numericLayer(
    'field_capacity_lower_limit',
    'Límite inferior CC',
    'lim_inf_CC',
    'Agua y estructura',
    '',
    FIELD_CAPACITY
  ),
  numericLayer(
    'effective_fertility_capacity',
    'Cap. efi. fert.',
    'Cap_efi_fert',
    'Propiedades generales',
    '',
    CEC
  ),
  numericLayer(
    'organic_matter_carbon',
    'C de MO',
    'C_de_MO',
    'Propiedades generales',
    '',
    ORGANIC_MATTER
  ),
  numericLayer('bulk_density', 'Densidad', 'BulkDens', 'Agua y estructura', 'g/cm³', DENSITY),
  numericLayer('cec', 'CIC del suelo', 'CEC', 'Propiedades generales', 'cmol(+)/kg', CEC),
  numericLayer(
    'conductivity',
    'Conductividad eléctrica',
    'Cond',
    'Propiedades generales',
    '',
    CONDUCTIVITY
  ),
  numericLayer('ph', 'pH del suelo', 'pH', 'Propiedades generales', '', PH),
  numericLayer('sodium_pct', '% NA del suelo', 'Na_bse', 'Sodio', '%', SODIUM),
  numericLayer('sodium', 'NA del suelo', 'Na', 'Sodio', 'mg/100g', SODIUM),
  numericLayer('phosphorus_total', 'P total', 'P_total', 'Fósforo', 'kg/ha', PHOSPHORUS),
  numericLayer('phosphorus', 'P1 del suelo', 'P', 'Fósforo', 'mg/100g', PHOSPHORUS),
  numericLayer('phosphorus_available', 'P disponible', 'P_disp', 'Fósforo', 'kg/ha', PHOSPHORUS),
  numericLayer('potassium_pct', '%K del suelo', 'K_bse', 'Potasio', '%', POTASSIUM),
  numericLayer('potassium_total', 'K total', 'K_total', 'Potasio', 'kg/ha', POTASSIUM),
  numericLayer('potassium', 'K del suelo', 'K', 'Potasio', 'mg/100g', POTASSIUM),
  numericLayer('potassium_available', 'K disponible', 'K_disp', 'Potasio', 'kg/ha', POTASSIUM),
  numericLayer('calcium_pct', '% CA del suelo', 'Ca_bse', 'Calcio', '%', CALCIUM),
  numericLayer('calcium_total', 'Ca total', 'Ca_total', 'Calcio', 'kg/ha', CALCIUM),
  numericLayer('calcium', 'Ca del suelo', 'Ca', 'Calcio', 'mg/100g', CALCIUM),
  numericLayer('calcium_available', 'Ca disponible', 'Ca_disp', 'Calcio', 'kg/ha', CALCIUM),
  numericLayer('copper', 'CU del suelo', 'Cu', 'Micronutrientes', 'mg/100g', COPPER),
  numericLayer('copper_available', 'Cu disponible', 'Cu_disp', 'Micronutrientes', 'kg/ha', COPPER),
  numericLayer('ca_mg_ratio', 'Relación Ca_Mg', 'Ca_Mg', 'Relaciones', '', CA_MG),
  numericLayer('k_mg_ratio', 'Relación K_Mg', 'K_Mg', 'Relaciones', '', K_MG),
  numericLayer('magnesium_pct', '%MG del suelo', 'Mg_bse', 'Magnesio', '%', MAGNESIUM),
  numericLayer('magnesium_total', 'Mg total', 'Mg_total', 'Magnesio', 'kg/ha', MAGNESIUM),
  numericLayer('magnesium', 'MG del suelo', 'Mg', 'Magnesio', 'mg/100g', MAGNESIUM),
  numericLayer('magnesium_available', 'Mg disponible', 'Mg_disp', 'Magnesio', 'kg/ha', MAGNESIUM),
  numericLayer('boron', 'B del suelo', 'B', 'Micronutrientes', 'mg/100g', BORON),
  numericLayer('iron', 'FE del suelo', 'Fe', 'Micronutrientes', 'mg/100g', IRON),
  numericLayer('iron_available', 'Fe disponible', 'Fe_disp', 'Micronutrientes', 'kg/ha', IRON),
  numericLayer('manganese', 'MN del suelo', 'Mn', 'Micronutrientes', 'mg/100g', MANGANESE),
  numericLayer(
    'manganese_available',
    'Mn disponible',
    'Mn_disp',
    'Micronutrientes',
    'kg/ha',
    MANGANESE_AVAILABLE
  ),
  numericLayer('sulphur_total', 'S total', 'S_total', 'Azufre', 'kg/ha', SULPHUR),
  numericLayer('sulphur', 'S del suelo', 'S', 'Azufre', 'mg/100g', SULPHUR),
  numericLayer('sulphur_available', 'S disponible', 'S_disp', 'Azufre', 'kg/ha', SULPHUR),
  numericLayer('zinc', 'ZN del suelo', 'Zn', 'Micronutrientes', 'mg/100g', ZINC),
  numericLayer('zinc_available', 'Zn disponible', 'Zn_disp', 'Micronutrientes', 'kg/ha', ZINC),
]

export const SOIL_MAP_LAYER_GROUPS = Array.from(
  new Set(SOIL_MAP_LAYERS.map((layer) => layer.group))
)

export function formatSoilValue(value: number, unit: string) {
  const formatted = value.toLocaleString('es-MX', { maximumFractionDigits: 2 })
  return unit ? `${formatted} ${unit}` : formatted
}

export function normalizeSoilCategory(value: string) {
  return value.trim().toLocaleLowerCase('es-MX')
}

export function categoryBucket(value: string) {
  return `category:${normalizeSoilCategory(value)}`
}

export function categoryColor(layer: SoilMapCategoryLayerDef, value: string, index: number) {
  const normalized = normalizeSoilCategory(value)
  return (
    layer.categoryColors?.[normalized] ??
    layer.fallbackColor ??
    layer.palette[index % layer.palette.length] ??
    UNKNOWN_CATEGORY_COLOR
  )
}

function quantile(sorted: number[], position: number) {
  const index = (sorted.length - 1) * position
  const lower = Math.floor(index)
  const fraction = index - lower
  const low = sorted[lower]!
  const high = sorted[Math.min(lower + 1, sorted.length - 1)]!
  return low + (high - low) * fraction
}

export function numericBucket(value: number, breaks: number[], paletteSize: number) {
  if (paletteSize <= 1) return 'band-0'
  const ascendingBand = breaks.findIndex((cut) => value < cut)
  const normalizedBand = ascendingBand < 0 ? paletteSize - 1 : ascendingBand
  return `band-${paletteSize - 1 - normalizedBand}`
}

export function buildNumericScale(
  values: number[],
  palette: readonly string[],
  unit: string
): SoilNumericScale | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (sorted.length === 0 || palette.length === 0) return null

  const min = sorted[0]!
  const max = sorted[sorted.length - 1]!
  const breaks = Array.from({ length: Math.max(0, palette.length - 1) }, (_, index) =>
    quantile(sorted, (index + 1) / palette.length)
  )
  return buildNumericScaleFromBreaks(min, max, breaks, palette, unit)
}

export function buildNumericScaleFromBreaks(
  min: number,
  max: number,
  breaks: number[],
  palette: readonly string[],
  unit: string
): SoilNumericScale | null {
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    palette.length === 0 ||
    breaks.length !== Math.max(0, palette.length - 1)
  ) {
    return null
  }

  const format = (value: number) => formatSoilValue(value, unit)
  const entries = palette.map((color, paletteIndex) => {
    if (palette.length === 1) {
      return {
        key: 'band-0',
        color,
        label: min === max ? format(min) : `${format(min)}–${format(max)}`,
      }
    }

    const ascendingBand = palette.length - 1 - paletteIndex
    if (ascendingBand === palette.length - 1) {
      return {
        key: `band-${paletteIndex}`,
        color,
        label: `${format(breaks[breaks.length - 1]!)}–${format(max)}`,
      }
    }
    if (ascendingBand === 0) {
      return {
        key: `band-${paletteIndex}`,
        color,
        label: `${format(min)}–${format(breaks[0]!)}`,
      }
    }
    return {
      key: `band-${paletteIndex}`,
      color,
      label: `${format(breaks[ascendingBand - 1]!)}–${format(breaks[ascendingBand]!)}`,
    }
  })

  return { min, max, breaks, entries }
}
