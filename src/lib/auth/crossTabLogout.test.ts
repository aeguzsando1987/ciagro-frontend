/**
 * Cuando otra pestaña elimina el refresh token (logout o expiración), esta pestaña
 * recibe el evento `storage` y debe cerrar la sesión local.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { tokens, REFRESH_STORAGE_KEY } from './tokens'
import { useAuthStore } from '@/features/auth/useAuthStore'
import { setupCrossTabLogout } from './crossTabLogout'

describe('setupCrossTabLogout', () => {
  beforeEach(() => {
    setupCrossTabLogout()
    tokens.setAccess('a-token')
    useAuthStore.getState().setUser({
      id: 'u1', username: 'u', email: 'u@x', role_name: 'admin', role_level: 5,
      requires_password_change: false, datacentrals: [],
    })
  })

  afterEach(() => {
    tokens.clear()
    useAuthStore.getState().clearUser()
  })

  it('limpia tokens y user al recibir storage event con la clave del refresh removida', () => {
    expect(tokens.getAccess()).toBe('a-token')
    expect(useAuthStore.getState().user).not.toBeNull()

    window.dispatchEvent(new StorageEvent('storage', {
      key: REFRESH_STORAGE_KEY,
      oldValue: 'old-refresh',
      newValue: null,
      storageArea: window.localStorage,
    }))

    expect(tokens.getAccess()).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('ignora storage events de otras claves', () => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'otra-clave',
      newValue: null,
      storageArea: window.localStorage,
    }))
    expect(tokens.getAccess()).toBe('a-token')
  })

  it('ignora escrituras (login / rotación) — newValue truthy', () => {
    window.dispatchEvent(new StorageEvent('storage', {
      key: REFRESH_STORAGE_KEY,
      oldValue: 'old',
      newValue: 'new-refresh',
      storageArea: window.localStorage,
    }))
    expect(tokens.getAccess()).toBe('a-token')
    expect(useAuthStore.getState().user).not.toBeNull()
  })
})
