import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  const user = useAuthStore((s) => s.user)
  const roleLevel = user?.role_level ?? ROLE_LEVELS.GUEST
  const canCreate = roleLevel >= ROLE_LEVELS.SUPERVISOR

  const { data: crops = [], isLoading: loadingCrops, error: cropsError } = useCrops()
  const { data: phytos = [], isLoading: loadingPhytos, error: phytosError } = usePhytosanitaryCatalogs()

  const [createCropOpen, setCreateCropOpen] = useState(false)
  const [createPhytoOpen, setCreatePhytoOpen] = useState(false)
  const [selectedCrop, setSelectedCrop] = useState<CropCatalog | null>(null)
  const [selectedPhyto, setSelectedPhyto] = useState<PhytosanitaryCatalog | null>(null)

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Catálogos agrícolas</h1>
        <p className="text-sm text-muted-foreground">
          Gestión global de cultivos y elementos fitosanitarios del sistema.
        </p>
      </header>

      <Tabs defaultValue="crops">
        <TabsList>
          <TabsTrigger value="crops">Cultivos</TabsTrigger>
          <TabsTrigger value="phytosanitary">Fitosanitarios</TabsTrigger>
        </TabsList>

        {/* ── Tab Cultivos ── */}
        <TabsContent value="crops" className="space-y-3 pt-3">
          {canCreate && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreateCropOpen(true)}>
                + Nuevo Cultivo
              </Button>
            </div>
          )}
          {loadingCrops && <p className="text-muted-foreground">Cargando cultivos…</p>}
          {cropsError && <p className="text-destructive">Error al cargar los cultivos.</p>}
          {!loadingCrops && !cropsError && crops.length === 0 && (
            <p className="text-muted-foreground">No hay cultivos registrados todavía.</p>
          )}
          {crops.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Nombre</th>
                    <th className="px-4 py-2 text-left font-medium">Código</th>
                    <th className="px-4 py-2 text-left font-medium">Variedad</th>
                    <th className="px-4 py-2 text-left font-medium">Foto</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {crops.map((crop) => (
                    <tr
                      key={crop.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setSelectedCrop(crop)}
                    >
                      <td className="px-4 py-2 font-medium">{crop.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{crop.code ?? '—'}</td>
                      <td className="px-4 py-2">{crop.variety ?? '—'}</td>
                      <td className="px-4 py-2">
                        {crop.photo
                          ? <img src={crop.photo} alt={crop.name} className="h-8 w-8 rounded object-cover border" />
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Tab Fitosanitarios ── */}
        <TabsContent value="phytosanitary" className="space-y-3 pt-3">
          {canCreate && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreatePhytoOpen(true)}>
                + Nuevo Fitosanitario
              </Button>
            </div>
          )}
          {loadingPhytos && <p className="text-muted-foreground">Cargando fitosanitarios…</p>}
          {phytosError && <p className="text-destructive">Error al cargar los fitosanitarios.</p>}
          {!loadingPhytos && !phytosError && phytos.length === 0 && (
            <p className="text-muted-foreground">No hay fitosanitarios registrados todavía.</p>
          )}
          {phytos.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Nombre</th>
                    <th className="px-4 py-2 text-left font-medium">Tipo</th>
                    <th className="px-4 py-2 text-left font-medium">Cultivo</th>
                    <th className="px-4 py-2 text-left font-medium">Rango</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {phytos.map((phyto) => (
                    <tr
                      key={phyto.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setSelectedPhyto(phyto)}
                    >
                      <td className="px-4 py-2 font-medium">{phyto.name}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">{phyto.type ?? '—'}</Badge>
                      </td>
                      <td className="px-4 py-2">{phyto.default_crop?.name ?? '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {phyto.min_ref_value != null || phyto.max_ref_value != null
                          ? `${phyto.min_ref_value ?? 0}–${phyto.max_ref_value ?? '?'}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateCropDialog open={createCropOpen} onOpenChange={setCreateCropOpen} />
      <CreatePhytosanitaryDialog open={createPhytoOpen} onOpenChange={setCreatePhytoOpen} />

      {selectedCrop && (
        <CropPanel crop={selectedCrop} onClose={() => setSelectedCrop(null)} />
      )}
      {selectedPhyto && (
        <PhytosanitaryPanel phyto={selectedPhyto} onClose={() => setSelectedPhyto(null)} />
      )}
    </div>
  )
}
