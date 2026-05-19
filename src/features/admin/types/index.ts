/**
 * Tipos del módulo de administración, derivados del schema OpenAPI generado
 * (src/types/api.d.ts). No se definen formas manualmente: la fuente de verdad
 * es el backend (regla §2.1).
 */
import type { components } from '@/types/api'

/** Referencia a un workspace dentro de UserDetail.datacentrals. */
export type UserDatacentralRef = NonNullable<
  components['schemas']['UserDetail']['datacentrals']
>[number]

/** Usuario con perfil Individual anidado y datacentrals — respuesta de GET /users/. */
export type UserDetail = components['schemas']['UserDetail']
/** Perfil personal 1:1 del usuario. */
export type Individual = components['schemas']['Individual']
/** Rol de acceso (catálogo fijo de niveles 1–5). */
export type UserRole = components['schemas']['UserRole']
/** Rol laboral (ej. "Ingeniero agrónomo"). */
export type WorkRole = components['schemas']['WorkRole']
/** País (catálogo geográfico). */
export type Country = components['schemas']['Country']
/** Estado/provincia con su país anidado. */
export type StateDetail = components['schemas']['StateDetail']
/** Payload de edición de usuario por admin (PATCH /users/{id}/update/).
 *  DRF nombra el cuerpo de un PATCH como `Patched*`. */
export type AdminUserUpdate = components['schemas']['PatchedAdminUserUpdate']
/** Estados de negocio de un User: active | disabled | pending_activation. */
export type UserStatus = components['schemas']['StatusC9fEnum']

/** Sector agrícola (agrupación por giro SCIAN). */
export type AgroSector = components['schemas']['AgroSector']
/** Unidad productiva (AgroUnit). */
export type AgroUnit = components['schemas']['AgroUnit']
/** Contacto del directorio. */
export type Contact = components['schemas']['Contact']
/** Asignación ligera de contacto a unidad (lista). */
export type ContactAssignmentList = components['schemas']['ContactAssignmentList']
