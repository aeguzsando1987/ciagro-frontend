/**
 * Shell inmersivo del Visor de Datos Agrícolas.
 *
 * Se mantiene separado del panel general para reservar el ancho disponible al
 * explorador y al contenido analítico. Ningún estilo interno de mapa vive aquí.
 */
import { useCallback, useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft,
  Columns2,
  FolderTree,
  LayoutDashboard,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SearchX,
} from 'lucide-react'
import { GeodataExplorer } from './GeodataExplorer'
import { GeodataDashboard } from './GeodataDashboard'
import { AdvancedSearchModal } from './AdvancedSearchModal'
import { useAdvancedSessionSearch } from '../hooks/useAdvancedSessionSearch'
import {
  criteriaFromSearch,
  isSearchActive,
  searchFromCriteria,
  type AdvancedSearchCriteria,
} from '../lib/advancedSearch'
import {
  createMapCameraSyncGroup,
  type ComparisonPaneId,
  type MapCameraSyncBinding,
} from '../lib/mapCameraSync'
import type { VisorSelection } from '../types'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'

const MIN_EXPLORER_WIDTH = 160

function selectionLabel(selection: VisorSelection | null): string {
  if (!selection) return 'Selecciona una sesión o elemento'
  if (selection.level === 'session') {
    return `${selection.plot?.name ?? 'Parcela'} · ${selection.session?.date ?? 'Sesión'}`
  }
  return (
    selection.plot?.name ??
    selection.ranch?.name ??
    selection.producer?.name ??
    selection.datacentral?.name ??
    selection.org.name
  )
}

function selectionLevelLabel(selection: VisorSelection | null): string {
  if (!selection) return 'Sin selección'
  if (selection.level !== 'session') {
    const levelLabels = {
      org: 'Organización',
      datacentral: 'Unidad',
      producer: 'Productor',
      ranch: 'Rancho',
      plot: 'Parcela',
    }
    return levelLabels[selection.level]
  }
  const labels = {
    aspersion: 'Aspersión',
    phyto: 'Fitosanitario',
    ndvi: 'NDVI',
    soil_map: 'Mapeo de suelo',
  }
  return labels[selection.session?.kind ?? 'aspersion']
}

interface GeodataVisorShellProps {
  /**
   * Selección con la que abre el panel derecho, sin que el usuario toque nada.
   * La usa la ruta `/w/$dc/visor`, donde ya se sabe en qué CIAgro se entró. Sin
   * ella el visor arranca sin selección y muestra su estado vacío.
   */
  initialSelection?: VisorSelection | null
}

export function GeodataVisorShell({ initialSelection = null }: GeodataVisorShellProps = {}) {
  const [selection, setSelection] = useState<VisorSelection | null>(initialSelection)
  const [comparisonSelection, setComparisonSelection] = useState<VisorSelection | null>(null)
  const [comparisonEnabled, setComparisonEnabled] = useState(false)
  const [activePane, setActivePane] = useState<ComparisonPaneId>('primary')
  const [explorerWidth, setExplorerWidth] = useState(300)
  const [explorerHidden, setExplorerHidden] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const cameraSyncGroup = useMemo(() => createMapCameraSyncGroup(), [])
  const primaryMapSync = useMemo<MapCameraSyncBinding>(
    () => ({ group: cameraSyncGroup, pane: 'primary' }),
    [cameraSyncGroup]
  )
  const comparisonMapSync = useMemo<MapCameraSyncBinding>(
    () => ({ group: cameraSyncGroup, pane: 'comparison' }),
    [cameraSyncGroup]
  )

  // La búsqueda vive en la URL para poder compartirla y conservarla al refrescar.
  // `strict: false` y no `from: '/ruta'`: atar la lectura a una ruta concreta
  // rompería el shell si se monta en otra, como ya pasó al moverlo bajo /w/$dc.
  const search = useSearch({ strict: false }) as Record<string, string | undefined>
  const navigate = useNavigate()
  const criteria = useMemo(() => criteriaFromSearch(search), [search])
  const searchActive = isSearchActive(criteria)
  const results = useAdvancedSessionSearch(criteria)
  const contextLabel =
    selection?.datacentral?.name ?? selection?.org.name ?? 'Todas las organizaciones'

  const selectAndFocusDashboard = useCallback(
    (next: VisorSelection) => {
      if (comparisonEnabled && activePane === 'comparison') setComparisonSelection(next)
      else setSelection(next)
      if (window.matchMedia('(max-width: 767px)').matches) {
        setExplorerHidden(true)
      }
    },
    [activePane, comparisonEnabled]
  )

  const toggleComparison = useCallback(() => {
    setComparisonEnabled((enabled) => {
      setActivePane(enabled ? 'primary' : 'comparison')
      return !enabled
    })
  }, [])

  const applySearch = useCallback(
    (next: AdvancedSearchCriteria) => {
      // `to: '.'` mantiene la ruta actual: una ruta fija sacaria al usuario de su
      // CIAgro al aplicar una busqueda.
      void navigate({ to: '.', search: searchFromCriteria(next) as never })
      setSearchOpen(false)
      setSelection(null)
      setComparisonSelection(null)
    },
    [navigate]
  )

  const clearSearch = useCallback(() => {
    void navigate({ to: '.', search: {} as never })
    setSelection(null)
    setComparisonSelection(null)
  }, [navigate])

  // La CIAgro se resuelve por HTTP, asi que `initialSelection` llega DESPUES del
  // primer render. Se aplica solo mientras el usuario no haya elegido nada, para no
  // pisarle la navegacion si ya se movio por el arbol.
  const seleccionInicialAplicada = useRef(false)
  useEffect(() => {
    if (!initialSelection || seleccionInicialAplicada.current) return
    seleccionInicialAplicada.current = true
    setSelection(initialSelection)
  }, [initialSelection])

  // El delta parte del ancho actual para que el divisor siga al puntero sin saltos.
  const startResize = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = explorerWidth

      const onMove = (moveEvent: PointerEvent) => {
        const max = Math.min(420, Math.round(window.innerWidth * 0.32))
        const nextWidth = startWidth + moveEvent.clientX - startX
        setExplorerWidth(
          Math.min(Math.max(nextWidth, MIN_EXPLORER_WIDTH), Math.max(MIN_EXPLORER_WIDTH, max))
        )
      }

      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        document.body.style.userSelect = ''
      }

      document.body.style.userSelect = 'none'
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [explorerWidth]
  )

  return (
    // `h-full` y no `h-dvh`: el shell se monta en dos sitios y solo en uno ocupa
    // la ventana entera. Dentro del layout de la CIAgro cuelga bajo la cabecera, asi
    // que imponer el alto de la ventana lo desbordaba justo esos pixeles y sacaba una
    // barra de desplazamiento vertical. Cada contenedor define el alto.
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-default bg-surface px-3 sm:px-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 px-2 sm:px-3"
          onClick={() => void navigate({ to: '/workspaces' })}
        >
          <ArrowLeft />
          <span className="hidden sm:inline">Panel general</span>
        </Button>

        <div className="h-6 w-px bg-border-light" aria-hidden="true" />

        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-hover">
            <Map className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-5 text-foreground">
              Visor agrícola
            </h1>
            <p className="truncate text-xs leading-4 text-muted">{contextLabel}</p>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {comparisonEnabled && (
            <span className="hidden text-xs font-medium text-success lg:inline">
              Mapas sincronizados
            </span>
          )}
          <Button
            type="button"
            variant={comparisonEnabled ? 'secondary' : 'ghost'}
            size="sm"
            onClick={toggleComparison}
            disabled={!selection && !comparisonEnabled}
            aria-pressed={comparisonEnabled}
            title={
              selection || comparisonEnabled
                ? comparisonEnabled
                  ? 'Cerrar comparación'
                  : 'Comparar en vista dividida'
                : 'Selecciona primero una sesión o elemento'
            }
            className={
              comparisonEnabled ? 'border-primary/25 bg-primary-soft text-primary-hover' : ''
            }
          >
            <Columns2 />
            <span className="hidden sm:inline">
              {comparisonEnabled ? 'Cerrar comparación' : 'Comparar'}
            </span>
          </Button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {explorerHidden ? (
          <button
            type="button"
            aria-label="Mostrar explorador"
            onClick={() => setExplorerHidden(false)}
            className="flex w-10 shrink-0 items-start justify-center border-r border-default bg-surface pt-3 text-muted transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/20"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        ) : (
          <>
            <aside
              style={{ width: `min(${explorerWidth}px, 82vw)` }}
              className="flex shrink-0 flex-col overflow-hidden border-r border-default bg-surface"
            >
              <div className="border-b border-default px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <FolderTree className="h-[18px] w-[18px] text-brand" />
                    Explorador agrícola
                  </span>
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Búsqueda avanzada"
                      title="Búsqueda avanzada"
                      onClick={() => setSearchOpen(true)}
                      className={`flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-150 hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                        searchActive ? 'text-brand' : 'text-muted'
                      }`}
                    >
                      <Search className="h-4 w-4" />
                    </button>
                    {searchActive && (
                      <button
                        type="button"
                        aria-label="Quitar filtros"
                        title="Quitar filtros"
                        onClick={clearSearch}
                        className="flex h-10 w-10 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                      >
                        <SearchX className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label="Ocultar explorador"
                      onClick={() => setExplorerHidden(true)}
                      className="flex h-10 w-10 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </button>
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] leading-5 text-muted">
                  {comparisonEnabled
                    ? `La siguiente selección se abrirá en ${activePane === 'primary' ? 'A' : 'B'}`
                    : 'Organización → Unidad → Productor → Rancho → Parcela'}
                </p>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                <GeodataExplorer
                  selection={
                    comparisonEnabled && activePane === 'comparison'
                      ? comparisonSelection
                      : selection
                  }
                  onSelect={selectAndFocusDashboard}
                  searchActive={searchActive}
                  searchResult={results.data ?? null}
                  searchLoading={results.isLoading}
                  searchError={results.isError}
                  onRetrySearch={() => void results.refetch()}
                />
              </div>
            </aside>

            <div
              role="separator"
              aria-orientation="vertical"
              onPointerDown={startResize}
              className="w-1 shrink-0 cursor-col-resize bg-border-light transition-colors duration-150 hover:bg-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </>
        )}

        <section
          aria-label="Contenido del visor agrícola"
          className={`min-w-0 flex-1 overflow-auto ${comparisonEnabled ? 'p-2' : 'p-4 sm:p-6'}`}
        >
          {comparisonEnabled ? (
            <div className="grid h-full min-h-[640px] grid-cols-1 grid-rows-2 gap-2 md:min-h-0 md:grid-cols-2 md:grid-rows-1">
              {[
                {
                  id: 'primary' as const,
                  marker: 'A',
                  value: selection,
                  sync: primaryMapSync,
                },
                {
                  id: 'comparison' as const,
                  marker: 'B',
                  value: comparisonSelection,
                  sync: comparisonMapSync,
                },
              ].map((pane) => {
                const isActive = activePane === pane.id
                return (
                  <article
                    key={pane.id}
                    aria-label={`Comparación ${pane.marker}`}
                    onPointerDown={() => setActivePane(pane.id)}
                    className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-surface transition-colors duration-200 ${
                      isActive ? 'border-primary ring-2 ring-primary/10' : 'border-default'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActivePane(pane.id)}
                      className={`flex h-12 w-full shrink-0 items-center gap-2.5 border-b px-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/20 ${
                        isActive
                          ? 'border-primary/20 bg-primary-soft/70'
                          : 'border-default bg-surface hover:bg-surface-secondary'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                          isActive ? 'bg-primary text-white' : 'bg-surface-secondary text-secondary'
                        }`}
                      >
                        {pane.marker}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {selectionLabel(pane.value)}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {selectionLevelLabel(pane.value)}
                        </span>
                      </span>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                          isActive
                            ? 'border-primary bg-primary text-white'
                            : 'border-primary/20 bg-primary-soft text-primary hover:border-primary/35 hover:bg-primary/15'
                        }`}
                      >
                        {isActive ? 'Seleccionando aquí' : 'Seleccionar aquí'}
                      </span>
                    </button>

                    <div className="min-h-0 flex-1 p-2">
                      {pane.value ? (
                        <GeodataDashboard
                          selection={pane.value}
                          onSelect={pane.id === 'primary' ? setSelection : setComparisonSelection}
                          searchResult={searchActive ? (results.data ?? null) : null}
                          comparisonMode
                          mapSync={pane.sync}
                        />
                      ) : (
                        <EmptyState
                          className="h-full"
                          icon={<Columns2 />}
                          title="Elige qué quieres comparar"
                          description="B está activo. Selecciona otra sesión, parcela o rancho en el explorador."
                        />
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          ) : selection ? (
            <GeodataDashboard
              selection={selection}
              onSelect={selectAndFocusDashboard}
              searchResult={searchActive ? (results.data ?? null) : null}
            />
          ) : (
            <EmptyState
              className="h-full"
              icon={<LayoutDashboard />}
              title="Explora tus datos agrícolas"
              description={
                searchActive
                  ? 'Selecciona una coincidencia del explorador para consultar sus datos.'
                  : 'Selecciona una organización, rancho o parcela para consultar su información.'
              }
            />
          )}
        </section>
      </main>

      <AdvancedSearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        criteria={criteria}
        onApply={applySearch}
      />
    </div>
  )
}
