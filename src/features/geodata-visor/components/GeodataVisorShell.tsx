/**
 * Shell de la sección "Visor de Datos Agrícolas" (Fase 7).
 *
 * Sección independiente y de solo lectura, a la que se entra desde la pantalla de
 * selección de organización o desde el encabezado (no depende de tener una CIAgro
 * seleccionada). Layout de dos paneles: explorador jerárquico a la izquierda y
 * dashboard a la derecha. Mantiene el estado de selección y lo reparte a ambos paneles.
 * El dashboard se construye en 7.D/7.E (aquí muestra un eco de la selección).
 */
import { useCallback, useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowLeft, FolderTree, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Search, SearchX,
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
import type { VisorSelection } from '../types'

const MIN_EXPLORER_WIDTH = 160

export function GeodataVisorShell() {
  const [selection, setSelection] = useState<VisorSelection | null>(null)
  const [explorerWidth, setExplorerWidth] = useState(300)
  const [explorerHidden, setExplorerHidden] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  // La búsqueda vive en la URL (fase AS): compartible y sobrevive al refresh.
  // Este componente lo renderiza SOLO la ruta /visor-datos, así que puede leer sus
  // search params directamente; el explorador los recibe por prop para no atarse a
  // una ruta concreta.
  const search = useSearch({ from: '/_authenticated/visor-datos' })
  const navigate = useNavigate()
  const criteria = useMemo(() => criteriaFromSearch(search), [search])
  const searchActive = isSearchActive(criteria)
  const results = useAdvancedSessionSearch(criteria)

  const applySearch = useCallback(
    (next: AdvancedSearchCriteria) => {
      void navigate({ to: '/visor-datos', search: searchFromCriteria(next) })
      setSearchOpen(false)
      // La selección previa puede no existir en el árbol de resultados; se limpia
      // para no dejar el dashboard mostrando algo que el explorador ya no lista.
      setSelection(null)
    },
    [navigate]
  )

  const clearSearch = useCallback(() => {
    void navigate({ to: '/visor-datos', search: {} })
    setSelection(null)
  }, [navigate])

  // Redimensionado dinámico: arrastrar el divisor. Máximo 20% del ancho de pantalla.
  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const onMove = (ev: PointerEvent) => {
      const max = Math.round(window.innerWidth * 0.2)
      setExplorerWidth(Math.min(Math.max(ev.clientX, MIN_EXPLORER_WIDTH), Math.max(MIN_EXPLORER_WIDTH, max)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.userSelect = ''
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  return (
    <div className="flex h-dvh flex-col">
      {/* ─ Encabezado ─────────────────────────────────────────────── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-3">
          <img src="/agroindustry.png" alt="Tierra Inteligente" className="h-7" draggable={false} />
          <span className="font-bold tracking-tight">CIAgro</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Visor de Datos Agrícolas</span>
        </div>
        <Link
          to="/workspaces"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Regresar al dashboard principal
        </Link>
      </header>

      {/* ─ Cuerpo: explorador + dashboard ─────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {explorerHidden ? (
          <button
            type="button"
            aria-label="Mostrar explorador"
            onClick={() => setExplorerHidden(false)}
            className="flex w-7 shrink-0 items-start justify-center border-r bg-muted/20 pt-2 text-muted-foreground hover:bg-accent"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        ) : (
          <>
            <aside
              style={{ width: explorerWidth }}
              className="flex shrink-0 flex-col overflow-hidden border-r bg-muted/20"
            >
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm font-semibold">
                <span className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-muted-foreground" />
                  Explorador
                </span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Búsqueda avanzada"
                    title="Búsqueda avanzada"
                    onClick={() => setSearchOpen(true)}
                    className={`flex h-5 w-5 items-center justify-center rounded hover:bg-accent ${
                      searchActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                  {/* La lupa tachada solo aparece con búsqueda activa: es el "quitar
                      filtros" del use case y sin filtros no significaría nada. */}
                  {searchActive && (
                    <button
                      type="button"
                      aria-label="Quitar filtros"
                      title="Quitar filtros"
                      onClick={clearSearch}
                      className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
                    >
                      <SearchX className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label="Ocultar explorador"
                    onClick={() => setExplorerHidden(true)}
                    className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
                  >
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                <GeodataExplorer
                  selection={selection}
                  onSelect={setSelection}
                  searchActive={searchActive}
                  searchResult={results.data ?? null}
                  searchLoading={results.isLoading}
                  searchError={results.isError}
                />
              </div>
            </aside>
            {/* Divisor arrastrable */}
            <div
              role="separator"
              aria-orientation="vertical"
              onPointerDown={startResize}
              className="w-1.5 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/40"
            />
          </>
        )}

        <main className="flex-1 overflow-auto p-6 pb-10">
          {selection ? (
            <GeodataDashboard
              selection={selection}
              onSelect={setSelection}
              searchResult={searchActive ? results.data ?? null : null}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <LayoutDashboard className="h-8 w-8" />
              <p className="text-sm">
                {searchActive
                  ? 'Selecciona una coincidencia del explorador para ver sus datos.'
                  : 'Selecciona un elemento del explorador para ver sus datos.'}
              </p>
            </div>
          )}
        </main>
      </div>

      <AdvancedSearchModal
        open={searchOpen}
        onOpenChange={setSearchOpen}
        criteria={criteria}
        onApply={applySearch}
      />
    </div>
  )
}
