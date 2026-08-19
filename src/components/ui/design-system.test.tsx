import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataToolbar } from '@/components/ui/data-toolbar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { SearchInput } from '@/components/ui/search-input'
import { SafeImage } from '@/components/ui/safe-image'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/features/admin/components/Field'

describe('CIAgro design system', () => {
  it('mantiene aliases compatibles para las variantes de botón', () => {
    render(
      <div>
        <Button>Guardar</Button>
        <Button variant="secondary">Cancelar</Button>
        <Button variant="danger">Eliminar</Button>
        <Button variant="destructive">Eliminar alias</Button>
      </div>
    )

    expect(screen.getByRole('button', { name: 'Guardar' })).toHaveClass('bg-primary', 'h-10')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveClass(
      'bg-surface',
      'border-default'
    )
    expect(screen.getByRole('button', { name: 'Eliminar' })).toHaveClass('bg-danger')
    expect(screen.getByRole('button', { name: 'Eliminar alias' })).toHaveClass('bg-danger')
  })

  it('expone estados accesibles en inputs y textareas', () => {
    render(
      <div>
        <Input aria-label="Código" state="error" />
        <Input aria-label="Nombre" state="success" />
        <Textarea aria-label="Descripción" disabled />
      </div>
    )

    expect(screen.getByLabelText('Código')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Código')).toHaveAttribute('data-state', 'error')
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('data-state', 'success')
    expect(screen.getByLabelText('Descripción')).toBeDisabled()
  })

  it('asocia las etiquetas administrativas con sus controles y errores', () => {
    render(
      <Field label="Código" error="El código es obligatorio">
        <Input />
      </Field>
    )

    const input = screen.getByRole('textbox', { name: 'Código' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('El código es obligatorio')
  })

  it('permite limpiar una búsqueda sin inventar un control por pantalla', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <SearchInput
        aria-label="Buscar parcelas"
        value="maíz"
        onChange={() => {}}
        onClear={onClear}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('ofrece controles de selección accesibles', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <Checkbox aria-label="Seleccionar parcela" />
        <Switch aria-label="Activar monitoreo" />
        <RadioGroup aria-label="Tipo" defaultValue="ranch">
          <RadioGroupItem aria-label="Rancho" value="ranch" />
          <RadioGroupItem aria-label="Parcela" value="plot" />
        </RadioGroup>
      </div>
    )

    const checkbox = screen.getByRole('checkbox', { name: 'Seleccionar parcela' })
    await user.click(checkbox)
    expect(checkbox).toBeChecked()

    const toggle = screen.getByRole('switch', { name: 'Activar monitoreo' })
    await user.click(toggle)
    expect(toggle).toBeChecked()

    expect(screen.getByRole('radio', { name: 'Rancho' })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: 'Parcela' }))
    expect(screen.getByRole('radio', { name: 'Parcela' })).toBeChecked()
  })

  it('normaliza estados, jerarquía y paginación', async () => {
    const user = userEvent.setup()
    const onPageChange = vi.fn()
    render(
      <div>
        <PageHeader title="Parcelas" description="Administra las parcelas del rancho." />
        <Badge variant="success">Activo</Badge>
        <EmptyState title="Sin parcelas" description="Crea la primera parcela para continuar." />
        <LoadingState label="Cargando ranchos…" compact />
        <Pagination page={2} totalPages={4} onPageChange={onPageChange} />
      </div>
    )

    expect(screen.getByRole('heading', { name: 'Parcelas' })).toHaveClass('text-page-title')
    expect(screen.getByText('Activo')).toHaveClass('bg-success-soft')
    expect(screen.getByText('Sin parcelas')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Cargando ranchos…')

    await user.click(screen.getByRole('button', { name: 'Página siguiente' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })

  it('compone encabezado y toolbar sin estilos particulares por pantalla', async () => {
    const user = userEvent.setup()
    const onSearchChange = vi.fn()
    const onClear = vi.fn()

    render(
      <div>
        <PageHeader
          title="Usuarios"
          description="Administra usuarios."
          breadcrumbs={<span>Administración</span>}
          actions={<Button>Nuevo usuario</Button>}
        />
        <DataToolbar
          searchValue="ana"
          onSearchChange={onSearchChange}
          resultCount={3}
          resultLabel="usuarios"
          hasActiveFilters
          onClearFilters={onClear}
        />
      </div>
    )

    expect(screen.getByText('Administración')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nuevo usuario' })).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /limpiar filtros/i }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('reemplaza fotografías ausentes o rotas con un placeholder consistente', () => {
    const { rerender } = render(
      <SafeImage src={null} alt="Maíz" className="h-10 w-10 rounded-lg object-cover" />
    )

    expect(screen.getByRole('img', { name: 'Sin fotografía de Maíz' })).toHaveClass(
      'h-10',
      'w-10',
      'rounded-lg'
    )

    rerender(<SafeImage src="/imagen-rota.jpg" alt="Trigo" />)
    fireEvent.error(screen.getByAltText('Trigo'))
    expect(screen.getByRole('img', { name: 'Sin fotografía de Trigo' })).toBeInTheDocument()
  })

  it('mantiene modales centrados y acciones con un área mínima de 40 px', () => {
    render(
      <>
        <Dialog open>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalle</DialogTitle>
              <DialogDescription>Información del registro.</DialogDescription>
            </DialogHeader>
            <Button size="icon-sm" aria-label="Acción compacta">A</Button>
            <Tabs defaultValue="general">
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
              </TabsList>
            </Tabs>
          </DialogContent>
        </Dialog>
      </>
    )

    expect(screen.getByRole('button', { name: 'Acción compacta' })).toHaveClass('h-10', 'w-10')
    expect(screen.getByRole('tab', { name: 'General' })).toHaveClass(
      'h-10',
      'transition-colors',
      'duration-150'
    )
    expect(screen.getByRole('dialog', { name: 'Detalle' })).toHaveClass(
      'left-1/2',
      'top-1/2',
      '-translate-x-1/2',
      '-translate-y-1/2'
    )
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveClass('h-10', 'w-10')
  })
})
