import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readRememberedDc, rememberDc, forgetRememberedDc } from './scopeStorage'

describe('scopeStorage', () => {
  beforeEach(() => window.localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('sin nada guardado no recuerda ninguna CIAgro', () => {
    expect(readRememberedDc()).toBeNull()
  })

  it('recuerda la ultima CIAgro y la devuelve', () => {
    rememberDc('dc-1')
    expect(readRememberedDc()).toBe('dc-1')
    rememberDc('dc-2')
    expect(readRememberedDc()).toBe('dc-2')
  })

  it('puede olvidarla', () => {
    rememberDc('dc-1')
    forgetRememberedDc()
    expect(readRememberedDc()).toBeNull()
  })

  it('si el almacenamiento no esta disponible no lanza: devuelve null y sigue', () => {
    // Ventana privada o cookies de sitio bloqueadas: el acceso lanza. La pantalla de
    // entrada tiene que aguantarlo, porque lo unico que se pierde es una comodidad.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => rememberDc('dc-1')).not.toThrow()
    expect(readRememberedDc()).toBeNull()
  })
})
