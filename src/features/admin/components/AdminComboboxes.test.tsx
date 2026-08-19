import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AssignCombobox } from './AssignCombobox'
import { CountryCombobox } from './CountryCombobox'

describe('comboboxes administrativos', () => {
  it('permite seleccionar un país con teclado', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <CountryCombobox
        countries={[
          { id: 1, name: 'México', iso_2: 'MX', iso_3: 'MEX' },
          { id: 2, name: 'Colombia', iso_2: 'CO', iso_3: 'COL' },
        ]}
        value={undefined}
        onChange={onChange}
      />
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveClass('h-11', 'duration-150')
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')

    const option = screen.getByRole('option', { name: 'México' })
    option.focus()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('1')
  })

  it('expone selección y foco en asignaciones', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <AssignCombobox
        items={[{ id: 'unit-1', label: 'Campos del Valle' }]}
        value=""
        onChange={onChange}
      />
    )

    await user.click(screen.getByRole('combobox'))
    const option = screen.getByRole('option', { name: 'Campos del Valle' })
    option.focus()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledWith('unit-1')
  })
})
