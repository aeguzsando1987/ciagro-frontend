/**
 * Entregables del reporte (RS-16).
 *
 * El componente no tenia tests propios y es el que gobierna publicar y las cuatro
 * exportaciones. Se cubren las dos ramas —aspersion y suelo— porque divergen en lo
 * que exigen para publicar, y R2, que hasta RS-15 dejaba que el 409 del backend
 * saliera como error suelto tras esperar la descarga.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mutations = {
  update: vi.fn(),
  upload: vi.fn(),
  pdf: vi.fn(),
  kmz: vi.fn(),
  csv: vi.fn(),
}

vi.mock('../hooks/useSessionReport', () => ({
  useUpdateSessionReport: () => ({ mutate: mutations.update, isPending: false }),
}))
vi.mock('../hooks/useReportAssets', () => ({
  useUploadReportAssets: () => ({ mutate: mutations.upload, isPending: false }),
  useDownloadReportPdf: () => ({ mutate: mutations.pdf, isPending: false }),
  useDownloadReportKmz: () => ({ mutate: mutations.kmz, isPending: false }),
  useDownloadReportCsv: () => ({ mutate: mutations.csv, isPending: false }),
}))
vi.mock('./ReportMapCapture', () => ({
  ReportMapCapture: () => <div data-testid="captura-aspersion" />,
}))
vi.mock('./SoilPublishFlow', () => ({
  SoilPublishFlow: () => <div data-testid="flujo-suelo" />,
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { ReportDeliverables } from './ReportDeliverables'
import type { SessionReport } from '../types'

function reporte(over: Record<string, unknown> = {}): SessionReport {
  return {
    id: 'r1', status: 'en_proceso', map_snapshot: null, analyst_signature: null,
    stats_snapshot: {}, ...over,
  } as unknown as SessionReport
}

function renderDeliverables(report: SessionReport, sessionType: 'aspersion' | 'soilmap') {
  return render(
    <ReportDeliverables
      report={report}
      sessionType={sessionType}
      objectId="h1"
      plotId="p1"
      canWrite
    />
  )
}

const btn = (name: RegExp | string) => screen.getByRole('button', { name })

beforeEach(() => Object.values(mutations).forEach((m) => m.mockReset()))

describe('ReportDeliverables — aspersión', () => {
  it('publicar captura el mapa antes de marcar publicado', () => {
    renderDeliverables(reporte(), 'aspersion')
    fireEvent.click(btn('Publicar reporte'))

    expect(screen.getByTestId('captura-aspersion')).toBeTruthy()
    // No se publica hasta tener la imagen: el backend responde 400 sin ella.
    expect(mutations.update).not.toHaveBeenCalled()
  })

  it('sin captura no ofrece PDF', () => {
    renderDeliverables(reporte(), 'aspersion')
    expect(btn('Descargar PDF')).toBeDisabled()
  })

  it('no ofrece CSV: la telemetría ya viaja en su propio reporte', () => {
    renderDeliverables(reporte(), 'aspersion')
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).toBeNull()
  })

  it('no monta el flujo por capas', () => {
    renderDeliverables(reporte(), 'aspersion')
    expect(screen.queryByTestId('flujo-suelo')).toBeNull()
  })
})

describe('ReportDeliverables — suelo', () => {
  it('sin capas preparadas no deja publicar ni generar PDF', () => {
    // El entregable de suelo son las capas: ambas puertas usan ese criterio, y el
    // backend valida lo mismo. Antes exigia map_snapshot y suelo no podia publicar.
    renderDeliverables(reporte(), 'soilmap')
    expect(btn('Publicar reporte')).toBeDisabled()
    expect(btn('Descargar PDF')).toBeDisabled()
    expect(screen.getByText(/Prepara las capas que quieras publicar/)).toBeTruthy()
  })

  it('con capas preparadas publica directo, sin captura única', () => {
    const r = reporte({ stats_snapshot: { published_layers: ['ph', 'clay'] } })
    renderDeliverables(r, 'soilmap')

    fireEvent.click(btn('Publicar reporte'))
    // Las imagenes ya las congelo el flujo por capas: aqui no hay que capturar nada.
    expect(screen.queryByTestId('captura-aspersion')).toBeNull()
    expect(mutations.update).toHaveBeenCalledWith(
      { status: 'publicado' },
      expect.anything()
    )
    expect(screen.getByText(/2 capas preparadas/)).toBeTruthy()
  })

  it('ofrece CSV y el flujo por capas', () => {
    renderDeliverables(reporte(), 'soilmap')
    fireEvent.click(btn('Exportar CSV'))

    expect(mutations.csv).toHaveBeenCalled()
    expect(screen.getByTestId('flujo-suelo')).toBeTruthy()
  })

  it('publicado ya no ofrece preparar capas', () => {
    // Publicado congela: cambiar capas ahí daría 409 del backend.
    const r = reporte({ status: 'publicado', stats_snapshot: { published_layers: ['ph'] } })
    renderDeliverables(r, 'soilmap')

    expect(screen.queryByTestId('flujo-suelo')).toBeNull()
    expect(btn('Copiar liga pública')).toBeTruthy()
  })
})

describe('descarga del PDF', () => {
  /**
   * El PDF se maqueta en el servidor y tarda unos segundos. La version anterior
   * abria la pestaña dentro del clic —obligada por el bloqueador de popups, que
   * corta cualquier ventana abierta despues de un `await`— y el usuario se quedaba
   * mirando una pestaña EN BLANCO. Descargar no necesita ese truco.
   */
  it('descarga en vez de abrir una pestaña en blanco', () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)
    const r = reporte({ stats_snapshot: { published_layers: ['ph'] } })
    renderDeliverables(r, 'soilmap')

    fireEvent.click(btn('Descargar PDF'))

    expect(mutations.pdf).toHaveBeenCalled()
    expect(abrir).not.toHaveBeenCalled()
    abrir.mockRestore()
  })
})

describe('R2 — cancelado bloquea las exportaciones', () => {
  it('deshabilita PDF, KML y CSV en vez de esperar el 409', () => {
    const r = reporte({ status: 'cancelado', stats_snapshot: { published_layers: ['ph'] } })
    renderDeliverables(r, 'soilmap')

    expect(btn('Descargar PDF')).toBeDisabled()
    expect(btn('Exportar KML')).toBeDisabled()
    expect(btn('Exportar CSV')).toBeDisabled()
    expect(btn('Publicar reporte')).toBeDisabled()
  })

  it('en aspersión bloquea igual', () => {
    const r = reporte({ status: 'cancelado', map_snapshot: 'x.png' })
    renderDeliverables(r, 'aspersion')

    expect(btn('Descargar PDF')).toBeDisabled()
    expect(btn('Exportar KML')).toBeDisabled()
  })

  it('en proceso NO bloquea el KML: congela datos, no exportaciones', () => {
    renderDeliverables(reporte(), 'aspersion')
    fireEvent.click(btn('Exportar KML'))
    expect(mutations.kmz).toHaveBeenCalled()
  })
})
