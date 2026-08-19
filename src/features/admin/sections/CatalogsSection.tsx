import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataToolbar } from '@/components/ui/data-toolbar'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { PageHeader } from '@/components/ui/page-header'
import { SafeImage } from '@/components/ui/safe-image'
import { TableSkeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { ROLE_LEVELS } from '@/lib/auth/roles'
import { useCrops } from '../hooks/useCrops'
import { usePhytosanitaryCatalogs } from '../hooks/usePhytosanitary'
import { CreateCropDialog } from '../dialogs/CreateCropDialog'
import { CreatePhytosanitaryDialog } from '../dialogs/CreatePhytosanitaryDialog'
import { CropPanel } from '../panel/CropPanel'
import { PhytosanitaryPanel } from '../panel/PhytosanitaryPanel'
import type { CropCatalog, PhytosanitaryCatalog } from '../types'

/** Sección Catálogos Agrícolas del panel /admin — caso de uso §6. */
export function CatalogsSection() {
  const user = useAuthStore((state) => state.user)
  const roleLevel = user?.role_level ?? ROLE_LEVELS.GUEST
  const canCreate = roleLevel >= ROLE_LEVELS.SUPERVISOR
  const {
    data: crops = [],
    isLoading: loadingCrops,
    error: cropsError,
    refetch: refetchCrops,
  } = useCrops()
  const {
    data: phytos = [],
    isLoading: loadingPhytos,
    error: phytosError,
    refetch: refetchPhytos,
  } = usePhytosanitaryCatalogs()

  const [createCropOpen, setCreateCropOpen] = useState(false)
  const [createPhytoOpen, setCreatePhytoOpen] = useState(false)
  const [selectedCrop, setSelectedCrop] = useState<CropCatalog | null>(null)
  const [selectedPhyto, setSelectedPhyto] = useState<PhytosanitaryCatalog | null>(null)
  const [cropSearch, setCropSearch] = useState('')
  const [phytoSearch, setPhytoSearch] = useState('')
  const [phytoType, setPhytoType] = useState('all')

  const filteredCrops = useMemo(() => {
    const query = cropSearch.trim().toLocaleLowerCase('es-MX')
    if (!query) return crops
    return crops.filter((crop) =>
      `${crop.name} ${crop.code ?? ''} ${crop.variety ?? ''}`
        .toLocaleLowerCase('es-MX')
        .includes(query)
    )
  }, [crops, cropSearch])

  const phytoTypes = useMemo(
    () =>
      Array.from(new Set(phytos.map((phyto) => phyto.type).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b, 'es')
      ),
    [phytos]
  )

  const filteredPhytos = useMemo(() => {
    const query = phytoSearch.trim().toLocaleLowerCase('es-MX')
    return phytos.filter((phyto) => {
      const matchesSearch =
        !query ||
        `${phyto.name} ${phyto.type ?? ''} ${phyto.default_crop?.name ?? ''}`
          .toLocaleLowerCase('es-MX')
          .includes(query)
      const matchesType = phytoType === 'all' || phyto.type === phytoType
      return matchesSearch && matchesType
    })
  }, [phytos, phytoSearch, phytoType])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogos agrícolas"
        description="Gestión global de cultivos y elementos fitosanitarios del sistema."
      />

      <Tabs defaultValue="crops">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="crops">Cultivos</TabsTrigger>
          <TabsTrigger value="phytosanitary">Fitosanitarios</TabsTrigger>
        </TabsList>

        <TabsContent value="crops" className="space-y-4 pt-4">
          <DataToolbar
            searchValue={cropSearch}
            onSearchChange={setCropSearch}
            searchPlaceholder="Buscar cultivo…"
            searchLabel="Buscar cultivos"
            resultCount={filteredCrops.length}
            resultLabel={filteredCrops.length === 1 ? 'cultivo' : 'cultivos'}
            hasActiveFilters={Boolean(cropSearch)}
            onClearFilters={() => setCropSearch('')}
            primaryAction={
              canCreate ? (
                <Button onClick={() => setCreateCropOpen(true)}>
                  <Plus />
                  Nuevo cultivo
                </Button>
              ) : undefined
            }
          />

          {loadingCrops && <TableSkeleton columns={4} label="Cargando cultivos…" />}
          {cropsError && (
            <ErrorState
              title="No pudimos cargar los cultivos"
              description="Revisa tu conexión e inténtalo nuevamente."
              onRetry={() => void refetchCrops()}
            />
          )}
          {!loadingCrops && !cropsError && filteredCrops.length === 0 && (
            <EmptyState
              title={cropSearch ? 'No encontramos cultivos' : 'No hay cultivos registrados todavía'}
              description={
                cropSearch ? 'Ajusta o limpia la búsqueda para ver más resultados.' : undefined
              }
            />
          )}
          {filteredCrops.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Variedad</TableHead>
                  <TableHead className="w-24">Foto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCrops.map((crop) => (
                  <TableRow
                    key={crop.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedCrop(crop)}
                  >
                    <TableCell className="font-medium">{crop.name}</TableCell>
                    <TableCell className="text-secondary">{crop.code ?? '—'}</TableCell>
                    <TableCell>{crop.variety ?? '—'}</TableCell>
                    <TableCell>
                      <SafeImage
                        src={crop.photo}
                        alt={crop.name}
                        className="h-10 w-10 rounded-lg border border-default object-cover"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="phytosanitary" className="space-y-4 pt-4">
          <DataToolbar
            searchValue={phytoSearch}
            onSearchChange={setPhytoSearch}
            searchPlaceholder="Buscar fitosanitario…"
            searchLabel="Buscar fitosanitarios"
            resultCount={filteredPhytos.length}
            resultLabel={filteredPhytos.length === 1 ? 'fitosanitario' : 'fitosanitarios'}
            hasActiveFilters={Boolean(phytoSearch || phytoType !== 'all')}
            onClearFilters={() => {
              setPhytoSearch('')
              setPhytoType('all')
            }}
            filters={
              <Select value={phytoType} onValueChange={setPhytoType}>
                <SelectTrigger className="w-44" aria-label="Filtrar por tipo">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {phytoTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
            primaryAction={
              canCreate ? (
                <Button onClick={() => setCreatePhytoOpen(true)}>
                  <Plus />
                  Nuevo fitosanitario
                </Button>
              ) : undefined
            }
          />

          {loadingPhytos && <TableSkeleton columns={4} label="Cargando fitosanitarios…" />}
          {phytosError && (
            <ErrorState
              title="No pudimos cargar los fitosanitarios"
              description="Revisa tu conexión e inténtalo nuevamente."
              onRetry={() => void refetchPhytos()}
            />
          )}
          {!loadingPhytos && !phytosError && filteredPhytos.length === 0 && (
            <EmptyState
              title={
                phytoSearch || phytoType !== 'all'
                  ? 'No encontramos fitosanitarios'
                  : 'No hay fitosanitarios registrados todavía'
              }
              description={
                phytoSearch || phytoType !== 'all'
                  ? 'Ajusta o limpia los filtros para ver más resultados.'
                  : undefined
              }
            />
          )}
          {filteredPhytos.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cultivo</TableHead>
                  <TableHead>Rango</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPhytos.map((phyto) => (
                  <TableRow
                    key={phyto.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedPhyto(phyto)}
                  >
                    <TableCell className="font-medium">{phyto.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{phyto.type ?? '—'}</Badge>
                    </TableCell>
                    <TableCell>{phyto.default_crop?.name ?? '—'}</TableCell>
                    <TableCell className="text-secondary">
                      {phyto.min_ref_value != null || phyto.max_ref_value != null
                        ? `${phyto.min_ref_value ?? 0}–${phyto.max_ref_value ?? '?'}`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      <CreateCropDialog open={createCropOpen} onOpenChange={setCreateCropOpen} />
      <CreatePhytosanitaryDialog open={createPhytoOpen} onOpenChange={setCreatePhytoOpen} />
      {selectedCrop && <CropPanel crop={selectedCrop} onClose={() => setSelectedCrop(null)} />}
      {selectedPhyto && (
        <PhytosanitaryPanel phyto={selectedPhyto} onClose={() => setSelectedPhyto(null)} />
      )}
    </div>
  )
}
