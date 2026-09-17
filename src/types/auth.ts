/**
 * Tipos del dominio de autenticación.
 * Prefijados por dominio (AuthUser, WorkspaceDataCentral) para claridad
 * al importarlos desde cualquier feature (regla verbose 1.5).
 */

/** CIAgro padre a la que pertenece una CIAgro hija. */
export interface WorkspaceDataCentralMain {
  id: string
  name: string
}

/** DataCentral visible para el usuario — viene del array datacentrals en /users/me/ */
export interface WorkspaceDataCentral {
  id: string
  name: string
  slug: string
  is_owner: boolean
  /**
   * CIAgro padre. Viaja aquí para que el selector de alcance del Task Manager agrupe
   * las hijas por padre sin una llamada extra y, sobre todo, sin una segunda fuente de
   * verdad: este array es exactamente el criterio del guard de /w/$dc, así que una hija
   * que no esté aquí no es alcanzable aunque /organizations/ la liste.
   */
  data_central_main: WorkspaceDataCentralMain
}

/**
 * Usuario autenticado (sesión activa).
 * Construido desde /auth/login/ (tokens + requires_password_change)
 * y /users/me/ (rol, datacentrals).
 */
export interface AuthUser {
  id: string
  username: string
  email: string
  role_name: string
  /** 1=Guest 2=Technician 3=Supervisor 4=Gerente 5=SuperAdmin */
  role_level: number
  requires_password_change: boolean
  datacentrals: WorkspaceDataCentral[]
}
