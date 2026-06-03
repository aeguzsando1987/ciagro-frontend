import { MAP_MODES, type MapModeKey } from '../lib/mapModes'

/**
 * Botones flotantes (esquina inferior derecha) para cambiar entre Satélite e Híbrido.
 * Se posiciona sobre el contenedor `relative` del mapa.
 */
export function MapModeSelector({
  active,
  onChange,
}: {
  active: MapModeKey
  onChange: (mode: MapModeKey) => void
}) {
  return (
    <div className="absolute bottom-3 right-3 z-20 flex overflow-hidden rounded border bg-background/90 shadow-sm backdrop-blur-sm">
      {(Object.entries(MAP_MODES) as [MapModeKey, (typeof MAP_MODES)[MapModeKey]][]).map(
        ([key, mode], i) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={[
              'px-2 py-1 text-[10px] leading-none transition-colors',
              i < Object.keys(MAP_MODES).length - 1 ? 'border-r' : '',
              active === key
                ? 'bg-foreground text-background font-semibold'
                : 'text-muted-foreground hover:bg-accent',
            ].join(' ')}
          >
            {mode.label}
          </button>
        ),
      )}
    </div>
  )
}
