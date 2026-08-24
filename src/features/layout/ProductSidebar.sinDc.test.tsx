/**
 * El menú cuando el usuario aterriza SIN una CIAgro determinada.
 *
 * Es el caso que estrena esta fase: quien alcanza varias CIAgros entra al Visor sin
 * preseleccionar ninguna. Antes ese caso no existía —siempre se elegía antes de
 * entrar—, y el menú lo trataba como "todavía no ha empezado": el primer item era
 * "Panel general" y **el Task Manager ni siquiera se pintaba**.
 *
 * Los tests con CIAgro determinada viven en `AppSidebar.test.tsx`; aquí solo se cubre
 * la mitad que no existía.
 */
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderInRouter } from '@/test/test-utils'
import { ProductSidebar } from './ProductSidebar'
import { ROLE_LEVELS } from '@/lib/auth/roles'

function montarSinDc(roleLevel: number) {
  renderInRouter(() => <ProductSidebar roleLevel={roleLevel} />)
}

describe('ProductSidebar sin CIAgro determinada', () => {
  it('el Visor está presente incluso para el rol más bajo', async () => {
    // Es la pantalla principal del producto: que dependa de haber elegido antes una
    // CIAgro es justamente lo que esta fase elimina.
    montarSinDc(ROLE_LEVELS.GUEST)
    await waitFor(() => expect(screen.getByText('Visor agrícola')).toBeInTheDocument())
  })

  it('ya no hay un item "Panel general" ocupando el sitio del Visor', async () => {
    montarSinDc(ROLE_LEVELS.GUEST)
    // Control positivo: se espera a que el menú exista antes de afirmar una ausencia.
    await waitFor(() => expect(screen.getByText('Visor agrícola')).toBeInTheDocument())
    expect(screen.queryByText('Panel general')).not.toBeInTheDocument()
  })

  it('el Task Manager sigue alcanzable, pasando por el selector', async () => {
    // Sus datos son de UNA CIAgro concreta, así que necesita elegirla antes; lo que no
    // puede es desaparecer del menú.
    montarSinDc(ROLE_LEVELS.SUPERVISOR)
    await waitFor(() => expect(screen.getByText('Task Manager')).toBeInTheDocument())
    const enlace = screen.getByText('Task Manager').closest('a')
    expect(enlace).toHaveAttribute('href', expect.stringContaining('/workspaces'))
    expect(enlace).toHaveAttribute('href', expect.stringContaining('task-manager'))
  })

  it('el Visor lleva al Visor sin CIAgro fija', async () => {
    montarSinDc(ROLE_LEVELS.SUPERVISOR)
    await waitFor(() => expect(screen.getByText('Visor agrícola')).toBeInTheDocument())
    expect(screen.getByText('Visor agrícola').closest('a')).toHaveAttribute(
      'href',
      expect.stringContaining('/visor-datos')
    )
  })
})
