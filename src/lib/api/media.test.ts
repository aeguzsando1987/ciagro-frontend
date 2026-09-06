/**
 * Resolucion de rutas de media (RS-17).
 *
 * DEFECTO HALLADO EN LA PRUEBA MANUAL: la imagen de la capa "simplemente no se
 * veia". Django devuelve rutas relativas y el front vive en otro origen, asi que el
 * navegador las pedia a su propio host: 404 silencioso, sin error en pantalla.
 */
import { describe, expect, it } from 'vitest'
import { mediaUrl } from './media'

describe('mediaUrl', () => {
  it('antepone el origen de la API a una ruta relativa', () => {
    // VITE_API_BASE_URL de pruebas termina en /api/v1; el sufijo se recorta.
    expect(mediaUrl('/media/attachments/ph.png')).toMatch(
      /^https?:\/\/[^/]+\/media\/attachments\/ph\.png$/
    )
  })

  it('no toca una URL ya absoluta (S3, CDN)', () => {
    const url = 'https://cdn.ejemplo.com/ph.png'
    expect(mediaUrl(url)).toBe(url)
  })

  it('sin ruta devuelve null en vez de una URL rota', () => {
    // Una capa sin preparar no tiene imagen: pintar <img src=""> pediria la pagina.
    expect(mediaUrl(null)).toBeNull()
    expect(mediaUrl(undefined)).toBeNull()
    expect(mediaUrl('')).toBeNull()
  })

  it('no duplica la barra si la ruta no la trae', () => {
    expect(mediaUrl('media/x.png')).toMatch(/\/media\/x\.png$/)
    expect(mediaUrl('media/x.png')).not.toMatch(/\/\/media/)
  })
})
