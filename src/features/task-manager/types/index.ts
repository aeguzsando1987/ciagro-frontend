import type { components } from '@/types/api'

/**
 * Tipos compartidos del modulo Task Manager (Fase 2).
 * Derivados del schema OpenAPI del backend para mantener una sola fuente de verdad.
 */

/** Programa Maestro (nivel superior del Gantt). */
export type MasterProgram = components['schemas']['MasterProgram']

/** Arbol completo Maestro + Hijos + Sesiones (endpoint /tree/). */
export type MasterProgramTree = components['schemas']['MasterProgramTree']

/** Programa Hijo anidado bajo un Maestro. */
export type ProgramaTree = components['schemas']['ProgramaTree']

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
