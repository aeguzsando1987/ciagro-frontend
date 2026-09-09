import type { components } from '@/types/api'

/**
 * Tipos compartidos del modulo Task Manager (Fase 2).
 * Derivados del schema OpenAPI del backend para mantener una sola fuente de verdad.
 */

/** Programa Maestro (nivel superior del Gantt). */
export type MasterProgram = components['schemas']['MasterProgram']

/** Programa Hijo anidado bajo un Maestro. */
export type YieldMapSessionSummary = {
  id: string
  type: 'yield_map'
  harvest_date: string
  import_status: string
  status: string
}

export type ProgramaTree = components['schemas']['ProgramaTree'] & {
  yield_map_headers?: YieldMapSessionSummary[]
}

/** Arbol completo Maestro + Hijos + Sesiones (endpoint /tree/).
 * El schema generado todavía no conoce Rendimiento; reemplazamos solo `programas`
 * para conservar el contrato OpenAPI y sumar el quinto dominio sin usar `any`.
 */
export type MasterProgramTree = Omit<components['schemas']['MasterProgramTree'], 'programas'> & {
  programas: ProgramaTree[]
}

/** Estados validos del Programa Maestro y Programa Hijo. */
export type ProgramaStatus = components['schemas']['Status5a4Enum']

/** Lista paginada estandar DRF de Programas Maestros. */
export type PaginatedMasterProgramList = components['schemas']['PaginatedMasterProgramList']

/** Impacto de un borrado: que caeria y que lo impide (FASE BC). */
export type DeleteImpact = components['schemas']['DeleteImpact']

/** Sesion con datos cargados que impide borrar su programa. */
export type DeleteBlockerSession = components['schemas']['DeleteBlockerSession']

/** Reporte publicado que impide borrar su sesion. */
export type DeleteBlockerReport = components['schemas']['DeleteBlockerReport']
