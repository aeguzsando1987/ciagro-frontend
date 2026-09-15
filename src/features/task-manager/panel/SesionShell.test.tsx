import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AdminActions,
  DatosSesionCard,
  FichaImportStatus,
  FichaItem,
  ImportStatusPanels,
  SesionActions,
  SesionBody,
  SesionFicha,
  SesionShell,
} from './SesionShell'

vi.mock('./PlotMiniMap', () => ({
  PlotMiniMap: ({ plotId }: { plotId: string | null }) => (
    <div data-testid="plot-mini-map">Parcela {plotId}</div>
  ),
}))

// usePlotGeometry usa apiClient, que escapa al interceptor de MSW en jsdom (documentado
// en HijoModal.test.tsx). Se mockea el hook, que es la via que ya usa el resto del repo.
const plotData = vi.fn()
vi.mock('../hooks/usePlotGeometry', () => ({
  usePlotGeometry: () => ({ data: plotData() }),
}))

afterEach(() => {
  vi.clearAllMocks()
})

/**
 * El chasis es lo que hace que los cinco tipos de sesion se vean igual. Si algo de aqui se
 * rompe, se rompe en los cinco a la vez, asi que se prueba una vez y en serio.
 */
describe('SesionShell', () => {
  function renderShell(status?: string | null) {
    const onBack = vi.fn()
    const onClose = vi.fn()
    render(
      <SesionShell
        icon={<span data-testid="icono-tipo" />}
        title="Sesión de Prueba"
        status={status}
        onBack={onBack}
        onClose={onClose}
      >
        <SesionBody>contenido</SesionBody>
      </SesionShell>
    )
    return { onBack, onClose }
  }

  it('rinde titulo, icono de tipo y el boton de volver como icono accesible', () => {
    renderShell('pending')
    // El titulo aparece dos veces a proposito: como encabezado visible y como descripcion
    // accesible sr-only que Radix exige. Se afirma sobre el encabezado.
    expect(screen.getByRole('heading', { name: /Sesión de Prueba/ })).toBeInTheDocument()
    expect(screen.getByTestId('icono-tipo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument()
  })

  it('pinta el estado de la sesion en la cabecera, con su variante', () => {
    renderShell('cancelled')
    expect(screen.getByText('Cancelado')).toBeInTheDocument()
  })

  it('omite el badge cuando la sesion no trae estado', () => {
    renderShell(null)
    expect(screen.queryByText('Pendiente')).not.toBeInTheDocument()
  })

  it('separa volver de cerrar: volver no cierra el modal', async () => {
    const user = userEvent.setup()
    const { onBack, onClose } = renderShell('pending')

    await user.click(screen.getByRole('button', { name: 'Volver' }))

    expect(onBack).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('SesionFicha', () => {
  it('agrega rancho y parcela siempre, sin que el modal los pida', () => {
    plotData.mockReturnValue({ properties: { ranch_name: 'AGUILARES Ranch', code: 'GU-AG-SM01' } })
    render(
      <SesionFicha plotId="plot-1">
        <FichaItem label="Fecha">2026-07-12</FichaItem>
      </SesionFicha>
    )

    expect(screen.getByText('AGUILARES Ranch')).toBeInTheDocument()
    expect(screen.getByText('GU-AG-SM01')).toBeInTheDocument()
    expect(screen.getByTestId('plot-mini-map')).toHaveTextContent('Parcela plot-1')
  })

  it('no revienta cuando la parcela todavia no cargo', () => {
    plotData.mockReturnValue(undefined)
    render(
      <SesionFicha plotId={null}>
        <FichaItem label="Fecha">2026-07-12</FichaItem>
      </SesionFicha>
    )

    expect(screen.getByText('Rancho')).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(2)
  })
})

describe('FichaImportStatus', () => {
  it('usa la redaccion canonica, no la que tenia cada modal', () => {
    render(<FichaImportStatus status="done" />)
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.queryByText('Cargado')).not.toBeInTheDocument()
  })
})

describe('ImportStatusPanels', () => {
  const base = {
    processingLabel: 'Procesando CSV…',
    mappingHint: 'Faltan columnas obligatorias.',
  }

  it('no pinta nada cuando la importacion no esta ni en curso ni fallida', () => {
    const { container } = render(<ImportStatusPanels status="done" {...base} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('anuncia el proceso en curso', () => {
    render(<ImportStatusPanels status="processing" {...base} />)
    expect(screen.getByRole('status')).toHaveTextContent('Procesando CSV…')
  })

  it('explica el mapeo pendiente en vez de dejarlo como procesando eterno', () => {
    render(<ImportStatusPanels status="pending_mapping" {...base} />)
    expect(screen.getByText('Faltan columnas obligatorias.')).toBeInTheDocument()
  })

  // Sin este panel una importacion fallida se ve como una sesion normal con cero puntos
  // y sin motivo a la vista, que es lo que pasaba en aspersion y suelo.
  it('muestra el motivo del fallo, no solo que fallo', () => {
    render(
      <ImportStatusPanels
        status="error"
        errors={{ error: 'csv_outside_selected_plot' }}
        {...base}
      />
    )
    expect(screen.getByText('La importación falló')).toBeInTheDocument()
    expect(screen.getByText(/csv_outside_selected_plot/)).toBeInTheDocument()
  })
})

describe('DatosSesionCard', () => {
  it('no se ofrece a quien no puede editar', () => {
    render(<DatosSesionCard description="d" canEdit={false} onEdit={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
  })

  it('oculta el disparador mientras el formulario en linea esta abierto', () => {
    render(
      <DatosSesionCard description="d" canEdit onEdit={vi.fn()} editing>
        <div>formulario</div>
      </DatosSesionCard>
    )
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
    expect(screen.getByText('formulario')).toBeInTheDocument()
  })
})

describe('AdminActions y SesionActions', () => {
  it('rotula las acciones destructivas, que antes colgaban sueltas', () => {
    render(
      <AdminActions>
        <button type="button">Eliminar la sesión completa</button>
      </AdminActions>
    )
    expect(screen.getByText('Acciones de administrador')).toBeInTheDocument()
  })

  // El aviso de reimportacion aditiva de aspersion y suelo vive aqui: perderlo al mover
  // el boton a la fila de acciones habria sido una regresion de informacion.
  it('conserva la nota al pie de la fila de acciones', () => {
    render(
      <SesionActions note="La reimportación añade puntos a los existentes, no los reemplaza.">
        <button type="button">Importar datos</button>
      </SesionActions>
    )
    expect(screen.getByText(/añade puntos a los existentes/)).toBeInTheDocument()
  })
})
