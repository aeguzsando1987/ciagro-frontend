/**
 * Memoria de la ultima CIAgro usada en el Task Manager.
 *
 * Existe para que quien entra siempre a la misma CIAgro no tenga que elegirla en cada
 * visita: es el unico motivo, y por eso vive aqui y no en el store de workspace, que es
 * estado de sesion y se pierde al recargar.
 *
 * Se guarda SOLO el id de la CIAgro hija. El padre se deduce de /users/me/, asi que
 * persistirlo tambien seria un segundo dato capaz de quedar desincronizado del primero.
 *
 * Todo va en try/catch: en ventana privada, con las cookies de sitio bloqueadas o
 * durante un render sin DOM, el mero acceso a localStorage lanza. Una pantalla de
 * entrada que revienta ahi deja al usuario sin Task Manager, y lo unico que estamos
 * guardando es una comodidad.
 */
const CLAVE = 'ciagro.task-manager.dc'

/** Ultima CIAgro usada, o null si no hay ninguna o el almacenamiento no esta disponible. */
export function readRememberedDc(): string | null {
  try {
    return window.localStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

/** Recuerda la CIAgro en la que el usuario esta trabajando. */
export function rememberDc(dcId: string): void {
  try {
    window.localStorage.setItem(CLAVE, dcId)
  } catch {
    // Sin memoria, el usuario vuelve a elegir en la siguiente visita. No es un error.
  }
}

/** Olvida la CIAgro recordada. */
export function forgetRememberedDc(): void {
  try {
    window.localStorage.removeItem(CLAVE)
  } catch {
    // Ver readRememberedDc: el almacenamiento puede no estar disponible.
  }
}
