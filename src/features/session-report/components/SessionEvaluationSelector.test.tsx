import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { renderWithQueryClient } from '@/test/test-utils'
import { SessionEvaluationSelector } from './SessionEvaluationSelector'

const endpoint = `${import.meta.env.VITE_API_BASE_URL}/field_ops/aspersion-sessions/h1/evaluation/`
const id = '8f9f7ab3-a8ef-44dc-8452-43e1c92a4382'
const catalog = { id, name: 'Catálogo prueba', code: 'TEST', revision: 'v1', context: 'Equipo de prueba',
  description: null, scope_note: 'Confirmar contexto', configured_count: 1,
  ranges: { speed_kmh: null, pressure_bar: { min: 1, max: 2 }, flow_ls: null, productivity_hah: null } }
function open() {
  renderWithQueryClient(<SessionEvaluationSelector objectId="h1" />)
  fireEvent.click(screen.getByRole('button', { name: 'Seleccionar catálogo de evaluación' }))
}

describe('Asociación explícita de catálogo', () => {
  it('consulta toda la paginación, muestra rangos y exige confirmación', async () => {
    const pages: string[] = []
    let saved: unknown
    server.use(http.get(endpoint, ({ request }) => {
      const page = new URL(request.url).searchParams.get('page')!
      pages.push(page)
      return HttpResponse.json({ results: page === '1' ? [{ ...catalog, id: '8f9f7ab3-a8ef-44dc-8452-43e1c92a4381', name: 'Otro' }] : [catalog],
        next: page === '1' ? `${endpoint}?page=2` : null, current_evaluation_id: null })
    }), http.patch(endpoint, async ({ request }) => { saved = await request.json(); return HttpResponse.json({ evaluation_id: id }) }))
    open()
    const select = await screen.findByLabelText('Catálogo disponible')
    expect(pages).toEqual(['1', '2'])
    expect(select).toHaveValue('')
    expect(saved).toBeUndefined()
    fireEvent.change(select, { target: { value: id } })
    expect(screen.getByText('14.50 – 29.01 psi')).toBeInTheDocument()
    expect(screen.getByText(/1 de 4 rangos configurados/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Asociar a esta sesión' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Asociar a esta sesión' }))
    await waitFor(() => expect(saved).toEqual({ evaluation_id: id, expected_evaluation_id: null, catalog_revision: 'v1', confirm_context: true }))
    expect(await screen.findByText(/Asociación guardada/)).toBeInTheDocument()
  })
  it('muestra un catálogo vacío sin inventar opciones', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ results: [], next: null, current_evaluation_id: null })))
    open()
    expect(await screen.findByText('No hay catálogos disponibles dentro de tu alcance.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asociar a esta sesión' })).toBeNull()
  })
  it('maneja errores y respuestas inválidas sin map indefinido', async () => {
    server.use(http.get(endpoint, () => HttpResponse.json({ results: null })))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('inválida')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled()
  })
})
