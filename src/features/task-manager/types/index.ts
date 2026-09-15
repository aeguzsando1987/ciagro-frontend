import type { components } from '@/types/api'

/**
 * Tipos compartidos del modulo Task Manager (Fase 2).
 * Derivados del schema OpenAPI del backend para mantener una sola fuente de verdad.
 */

/** Programa Maestro (nivel superior del Gantt). */
export type MasterProgram = components['schemas']['MasterProgram']

/** Sesion de Rendimiento resumida dentro del arbol.
 * Antes se declaraba a mano porque el schema no conocia Rendimiento. Desde la FASE CL-F
 * (2026-09-14) si lo conoce: al regenerar los tipos entraron los diez endpoints de
 * yield-map que nunca se habian publicado, y con ellos este componente. Se deriva del
 * schema para no mantener dos definiciones que se desincronizan en silencio.
 */
export type YieldMapSessionSummary = components['schemas']['YieldMapSessionSummary']

/** Programa Hijo anidado bajo un Maestro. */
export type ProgramaTree = components['schemas']['ProgramaTree']

/** Arbol completo Maestro + Hijos + Sesiones (endpoint /tree/). */
export type MasterProgramTree = components['schemas']['MasterProgramTree']

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
