/**
 * Los selectores de alcance del Task Manager.
 *
 * Lo que protegen estos tests es el cambio de esta fase: que elegir CIAgro sea un
 * cambio de parametro de la ruta -- el Gantt se recarga, la pantalla no -- y que no se
 * le pida al usuario un clic cuya respuesta ya se conoce.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', async (importActual) => {
  const actual = await importActual<typeof import('@tanstack/react-router')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { makeDataCentral } from '@/test/test-utils'
import { TaskManagerScopePicker } from './TaskManagerScopePicker'

const org = (id: string, name: string) => ({ id, name })

const UNA_ORG = [
  makeDataCentral({ id: 'dc-norte', name: 'Norte', data_central_main: org('org-1', 'Grupo U') }),
  makeDataCentral({ id: 'dc-sur', name: 'Sur', data_central_main: org('org-1', 'Grupo U') }),
]

const DOS_ORGS = [
  ...UNA_ORG,
  makeDataCentral({ id: 'dc-alfa', name: 'Alfa', data_central_main: org('org-2', 'Organización Beta') }),
]

describe('TaskManagerScopePicker', () => {
  beforeEach(() => mockNavigate.mockClear())

  it('con una sola organizacion no pinta su selector: seria un clic con una sola respuesta', () => {
    render(<TaskManagerScopePicker datacentrals={UNA_ORG} currentDcId="dc-norte" />)
    expect(screen.queryByLabelText('Organización')).not.toBeInTheDocument()
    expect(screen.getByLabelText('CIAgro')).toBeInTheDocument()
  })

  it('con varias organizaciones pinta los dos selectores', () => {
    render(<TaskManagerScopePicker datacentrals={DOS_ORGS} currentDcId="dc-norte" />)
    expect(screen.getByLabelText('Organización')).toBeInTheDocument()
    expect(screen.getByLabelText('CIAgro')).toBeInTheDocument()
  })

  it('muestra la CIAgro abierta y su organizacion como valores actuales', () => {
    render(<TaskManagerScopePicker datacentrals={DOS_ORGS} currentDcId="dc-alfa" />)
    expect(screen.getByLabelText<HTMLSelectElement>('CIAgro').value).toBe('dc-alfa')
    expect(screen.getByLabelText<HTMLSelectElement>('Organización').value).toBe('org-2')
  })

  it('elegir otra CIAgro navega a su Task Manager, sin salir del modulo', async () => {
    render(<TaskManagerScopePicker datacentrals={UNA_ORG} currentDcId="dc-norte" />)
    await userEvent.selectOptions(screen.getByLabelText('CIAgro'), 'dc-sur')
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/w/$dc/task-manager',
      params: { dc: 'dc-sur' },
    })
  })

  it('solo ofrece las CIAgros de la organizacion que se esta mirando', async () => {
    render(<TaskManagerScopePicker datacentrals={DOS_ORGS} currentDcId="dc-norte" />)
    expect(screen.getByRole('option', { name: 'Sur' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Alfa' })).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Organización'), 'org-2')

    expect(screen.getByRole('option', { name: 'Alfa' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Sur' })).not.toBeInTheDocument()
    // Cambiar de organizacion no navega por si solo: falta elegir CIAgro dentro.
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('al mirar otra organizacion el selector de CIAgro no finge una seleccion', async () => {
    // La CIAgro abierta no pertenece a la organizacion que se esta mirando, asi que
    // mostrarla como elegida seria mentir sobre lo que hay debajo en el Gantt.
    render(<TaskManagerScopePicker datacentrals={DOS_ORGS} currentDcId="dc-norte" />)
    await userEvent.selectOptions(screen.getByLabelText('Organización'), 'org-2')
    expect(screen.getByLabelText<HTMLSelectElement>('CIAgro').value).toBe('')
    expect(screen.getByRole('option', { name: 'Selecciona una CIAgro' })).toBeInTheDocument()
  })
})
