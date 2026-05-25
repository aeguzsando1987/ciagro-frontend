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

/** Organización raíz (CIAgro Padre) — con owner, status, country, datacentrals_count. */
export type DataCentralMainDetail = components['schemas']['DataCentralMainDetail']
/** Workspace (CIA Hija) con conteos de usuarios y AgroUnits asignadas. */
export type DataCentralDetail = components['schemas']['DataCentralDetail']
/** Asignación AgroUnit ↔ DataCentral. */
export type DataCentralAssignment = components['schemas']['DataCentralAssignment']
/** Asignación usuario ↔ DataCentral. */
export type UserAssignment = components['schemas']['UserAssignment']

/** Cultivo o variedad del catálogo global. */
export type CropCatalog = components['schemas']['CropCatalog']
/** Problema fitosanitario (plaga o enfermedad) con cultivo y etapas anidadas. */
export type PhytosanitaryCatalog = components['schemas']['PhytosanitaryCatalog']
/** Foto de una etapa de desarrollo de un fitosanitario. */
export type PhytosanitaryPhoto = components['schemas']['PhytosanitaryPhoto']
/** Payload de respuesta al crear una foto (incluye phytosanitary_id). */
export type PhytosanitaryPhotoCreate = components['schemas']['PhytosanitaryPhotoCreate']
/** Enum de tipo de fitosanitario. */
export type PhytosanitaryType = components['schemas']['PhytosanitaryCatalogTypeEnum']
/** Enum de etapa de desarrollo. */
export type PhytosanitaryStage = components['schemas']['Stage74bEnum']

// ── Activos Agrícolas (Fase 5) ───────────────────────────────────────────────

/** GeoJSON Feature de un Rancho (Point). Respuesta de GET /geo_assets/ranches/{id}/. */
export type RanchFeature = components['schemas']['Ranch']
/** GeoJSON Feature de una Parcela (Polygon). Respuesta de GET /geo_assets/plots/{id}/. */
export type PlotFeature = components['schemas']['Plot']
/** Relación Rancho–Socio (tabla pivote). */
export type RanchPartner = components['schemas']['RanchPartner']
/** Enum de tipo de relación rancho-socio. */
export type RelationType = components['schemas']['RelationTypeEnum']
/** Vértice de entrada para importación de parcela. */
export type PlotVertexInput = components['schemas']['PlotVertexInput']

/**
 * Rancho con campos aplanados — derivado de la FeatureCollection del backend.
 * Los hooks aplanan: {...f.properties, id: f.id!, geom: f.geometry ?? null}
 */
export type RanchFlat = NonNullable<RanchFeature['properties']> & {
  id: string
  geom: RanchFeature['geometry'] | null
}

/**
 * Parcela con campos aplanados — derivado de la FeatureCollection del backend.
 * Los hooks aplanan: {...f.properties, id: f.id!, geom: f.geometry ?? null}
 */
export type PlotFlat = NonNullable<PlotFeature['properties']> & {
  id: string
  geom: PlotFeature['geometry'] | null
}
