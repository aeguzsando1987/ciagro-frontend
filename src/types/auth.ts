/**
 * Tipos del dominio de autenticación.
 * Prefijados por dominio (AuthUser, WorkspaceDataCentral) para claridad
 * al importarlos desde cualquier feature (regla verbose 1.5).
 */

/** DataCentral visible para el usuario — viene del array datacentrals en /users/me/ */
export interface WorkspaceDataCentral {
  id: string
  name: string
  slug: string
  is_owner: boolean
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
