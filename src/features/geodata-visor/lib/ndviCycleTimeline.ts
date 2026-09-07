import type { NdviAgronomicCycle, NdviReferenceConfig } from '../hooks/useNdviTimeline'



export interface NdviCycleSessionLike {
  id: string
  session_date: string | null

  status: string
  import_status: string

  points_count: number

  has_ndvi: boolean
  mean: number | null
  min: number | null
  max: number | null
  stddev: number | null

  /**
   * Información del Programa hijo / subciclo productivo.
   */
  program_id: string
  program_name: string

  master_program_id: string | null
  master_program_name: string | null

  productive_cycle_id: string
  productive_cycle_name: string
  productive_cycle_start: string | null
  productive_cycle_end: string | null

  cycle_start: string | null
  cycle_end: string | null

  crop_id: number | null
  crop_name: string | null
  crop_code: string | null
  crop_variety_id: number | null
  crop_variety_name: string | null

  reference_start: string | null
  reference_end: string | null
  ndvi_reference: NdviReferenceConfig | null

  agronomic_cycle_id: string | null
  agronomic_cycle_name: string | null
  agronomic_cycles: NdviAgronomicCycle[]
}

/* =========================================================
   SLOT SEMANAL
   ========================================================= */

export interface NdviWeekSlot {
  /**
   * Identificador único del periodo.
   *
   * Ejemplo:
   * 2024-08-05_2024-08-11
   */
  key: string

  /**
   * Texto que se utilizará cuando NO exista NDVI.
   *
   * Ejemplo:
   * 05–11 ago
   */
  labelTop: string

  /**
   * Año.
   *
   * Ejemplo:
   * 2024
   */
  labelBottom: string

  /**
   * Inicio real de la semana.
   */
  start: string

  /**
   * Fin real de la semana.
   */
  end: string

  /**
   * Sesión representativa de la semana.
   *
   * Si existen varias sesiones dentro del periodo,
   * se conserva la más reciente.
   */
  session: NdviCycleSessionLike | null

  /**
   * true solamente cuando realmente existe
   * información NDVI.
   *
   * NDVI = 0 continúa siendo válido.
   */
  has_ndvi: boolean
}

/* =========================================================
   GRUPO POR SUBCICLO PRODUCTIVO
   ========================================================= */

export interface NdviCycleGroup {
  key: string

  program_id: string
  program_name: string

  master_program_id: string | null
  master_program_name: string | null

  productive_cycle_id: string
  productive_cycle_name: string
  productive_cycle_start: string | null
  productive_cycle_end: string | null

  cycle_start: string | null
  cycle_end: string | null

  crop_id: number | null
  crop_name: string | null
  crop_code: string | null
  crop_variety_id: number | null
  crop_variety_name: string | null

  reference_start: string | null
  reference_end: string | null
  ndvi_reference: NdviReferenceConfig | null

  agronomic_cycles: NdviAgronomicCycle[]

  sessions: NdviCycleSessionLike[]

  /**
   * Semanas correspondientes exclusivamente
   * a este subciclo productivo.
   */
  slots: NdviWeekSlot[]
}

/* =========================================================
   UTILIDADES DE FECHA
   ========================================================= */

/**
 * Convierte YYYY-MM-DD a Date evitando problemas
 * de zona horaria.
 */
function toDate(
  value: string
): Date {
  return new Date(
    `${value}T12:00:00`
  )
}

/**
 * Convierte Date a YYYY-MM-DD usando valores locales.
 *
 * Evitamos toISOString() porque puede cambiar el día
 * dependiendo de la zona horaria.
 */
function toIso(
  date: Date
): string {
  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    )

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    )

  return `${year}-${month}-${day}`
}

/**
 * Suma cierta cantidad de días
 * sin modificar el Date original.
 */
function addDays(
  date: Date,
  days: number
): Date {
  const result =
    new Date(date)

  result.setDate(
    result.getDate() +
      days
  )

  result.setHours(
    12,
    0,
    0,
    0
  )

  return result
}

/**
 * Regresa la fecha menor.
 */
function minDate(
  a: Date,
  b: Date
): Date {
  return a <= b
    ? a
    : b
}

/**
 * Día con dos dígitos.
 *
 * Ejemplo:
 * 5 → 05
 */
function day2(
  date: Date
): string {
  return new Intl.DateTimeFormat(
    'es-MX',
    {
      day: '2-digit',
    }
  ).format(date)
}

/**
 * Nombre corto del mes.
 *
 * Ejemplo:
 * agosto → ago
 */
function monthShort(
  date: Date
): string {
  return new Intl.DateTimeFormat(
    'es-MX',
    {
      month: 'short',
    }
  )
    .format(date)
    .replace(
      '.',
      ''
    )
}

/* =========================================================
   ETIQUETA DEL RANGO SEMANAL
   ========================================================= */

/**
 * Ejemplos:
 *
 * 05 ago → 11 ago
 *      05–11 ago
 *
 * 29 abr → 05 may
 *      29 abr–05 may
 *
 * Esta etiqueta solamente se utilizará cuando
 * la semana NO tenga NDVI.
 *
 * Si sí existe NDVI, NdviTimeline mostrará
 * la fecha exacta de la sesión.
 */
function weeklyRangeLabel(
  start: Date,
  end: Date
): string {
  const sameMonth =
    start.getMonth() ===
      end.getMonth() &&
    start.getFullYear() ===
      end.getFullYear()

  if (sameMonth) {
    return (
      `${day2(start)}–` +
      `${day2(end)} ` +
      `${monthShort(start)}`
    )
  }

  return (
    `${day2(start)} ` +
    `${monthShort(start)}–` +
    `${day2(end)} ` +
    `${monthShort(end)}`
  )
}

/* =========================================================
   CONSTRUCCIÓN DE SEMANAS
   ========================================================= */

/**
 * Genera semanas consecutivas a partir
 * de la fecha REAL de inicio del ciclo.
 *
 * Ejemplo:
 *
 * Ciclo:
 * 29 abr 2023 → 20 may 2023
 *
 * Resultado:
 *
 * 29 abr–05 may
 * 06–12 may
 * 13–19 may
 * 20 may
 *
 * La última semana se corta exactamente
 * en cycle_end.
 */
export function buildWeeklySlots(
  cycleStartValue: string,
  cycleEndValue: string
): Omit<
  NdviWeekSlot,
  'session' | 'has_ndvi'
>[] {
  const cycleStart =
    toDate(
      cycleStartValue
    )

  const cycleEnd =
    toDate(
      cycleEndValue
    )

  /**
   * Protección contra ciclos mal formados.
   */
  if (
    Number.isNaN(
      cycleStart.getTime()
    ) ||
    Number.isNaN(
      cycleEnd.getTime()
    ) ||
    cycleStart >
      cycleEnd
  ) {
    return []
  }

  const result: Omit<
    NdviWeekSlot,
    'session' | 'has_ndvi'
  >[] = []

  let cursor =
    new Date(
      cycleStart
    )

  while (
    cursor <=
    cycleEnd
  ) {
    /**
     * Una semana tiene siete días:
     *
     * inicio
     * +
     * 6 días
     *
     * porque ambos extremos son inclusivos.
     */
    const naturalEnd =
      addDays(
        cursor,
        6
      )

    /**
     * Si estamos en la última semana,
     * no nos podemos pasar del final
     * real del ciclo.
     */
    const slotEnd =
      minDate(
        naturalEnd,
        cycleEnd
      )

    const startIso =
      toIso(
        cursor
      )

    const endIso =
      toIso(
        slotEnd
      )

    result.push({
      key:
        `${startIso}_${endIso}`,

      labelTop:
        weeklyRangeLabel(
          cursor,
          slotEnd
        ),

      labelBottom:
        String(
          cursor.getFullYear()
        ),

      start:
        startIso,

      end:
        endIso,
    })

    /**
     * La siguiente semana comienza
     * exactamente un día después.
     */
    cursor =
      addDays(
        slotEnd,
        1
      )
  }

  return result
}

/* =========================================================
   AGRUPAR SESIONES POR SUBCICLO PRODUCTIVO
   ========================================================= */

export function groupSessionsByCycle(
  sessions: NdviCycleSessionLike[]
): NdviCycleGroup[] {
  const map =
    new Map<
      string,
      NdviCycleSessionLike[]
    >()

  /* -------------------------------------------------------
     1. AGRUPAMOS POR PROGRAMA HIJO / SUBCICLO
     ------------------------------------------------------- */

  for (
    const session
    of sessions
  ) {
    /**
     * El `program_id` corresponde al Programa hijo (subciclo).
     * Cada Programa hijo tiene su propia línea de tiempo y nunca
     * se mezcla con otro subciclo del mismo Programa Maestro.
     */
    const key = session.program_id
      ? `program:${session.program_id}`
      : [
          'sin-programa',
          session.program_name,
          session.cycle_start ?? '',
          session.cycle_end ?? '',
        ].join('|')

    const current =
      map.get(key) ??
      []

    current.push(
      session
    )

    map.set(
      key,
      current
    )
  }

  const groups:
    NdviCycleGroup[] = []

  /* -------------------------------------------------------
     2. GENERAMOS LA LÍNEA DE TIEMPO
        DE CADA SUBCICLO
     ------------------------------------------------------- */

  for (
    const [
      key,
      cycleSessions,
    ]
    of map.entries()
  ) {
    if (
      cycleSessions.length ===
      0
    ) {
      continue
    }

    /**
     * Sesiones ordenadas de la más antigua
     * a la más reciente.
     */
    const orderedSessions =
      [
        ...cycleSessions,
      ].sort(
        (
          a,
          b
        ) =>
          (
            a.session_date ??
            ''
          ).localeCompare(
            b.session_date ??
              ''
          )
      )

    const base =
      orderedSessions[0]

    if (!base) {
      continue
    }

    const firstSession =
      orderedSessions[0]

    const lastSession =
      orderedSessions[
        orderedSessions.length -
          1
      ]

    /**
     * Siempre preferimos las fechas
     * reales del subciclo productivo.
     *
     * Solo usamos primera/última sesión
     * como respaldo si el backend
     * no devuelve las fechas.
     */
    const cycleStart =
      base.cycle_start ??
      firstSession
        ?.session_date ??
      null

    const cycleEnd =
      base.cycle_end ??
      lastSession
        ?.session_date ??
      null

    let slots:
      NdviWeekSlot[] = []

    if (
      cycleStart &&
      cycleEnd
    ) {
      const emptySlots =
        buildWeeklySlots(
          cycleStart,
          cycleEnd
        )

      slots =
        emptySlots.map(
          (
            slot
          ): NdviWeekSlot => {
            /* ---------------------------------------------
               SESIONES QUE CAEN EN ESTA SEMANA
               --------------------------------------------- */

            const matches =
              orderedSessions.filter(
                (
                  session
                ) => {
                  const date =
                    session.session_date

                  if (!date) {
                    return false
                  }

                  return (
                    date >=
                      slot.start &&
                    date <=
                      slot.end
                  )
                }
              )

            /**
             * Las sesiones ya están ordenadas.
             *
             * Si hay varias dentro de la misma semana,
             * usamos la más reciente.
             *
             * Ejemplo:
             *
             * 06 ago → 0.71
             * 09 ago → 0.76
             *
             * La tarjeta mostrará:
             *
             * 09 ago
             * 0.76
             */
            const selectedSession:
              NdviCycleSessionLike | null =
                matches.length >
                0
                  ? (
                      matches[
                        matches.length -
                          1
                      ] ??
                      null
                    )
                  : null

            /**
             * IMPORTANTE:
             *
             * mean === 0
             *
             * sigue siendo información válida.
             *
             * Solamente es "Sin NDVI" cuando:
             *
             * - no existe sesión;
             * - has_ndvi es false;
             * - mean es null.
             */
            const hasNdvi =
              selectedSession !==
                null &&
              selectedSession.has_ndvi &&
              selectedSession.mean !==
                null

            return {
              ...slot,

              session:
                selectedSession,

              has_ndvi:
                hasNdvi,
            }
          }
        )
    }

    groups.push({
      key,

      program_id:
        base.program_id,

      program_name:
        base.program_name,

      master_program_id:
        base.master_program_id,

      master_program_name:
        base.master_program_name,

      productive_cycle_id:
        base.productive_cycle_id,

      productive_cycle_name:
        base.productive_cycle_name,

      productive_cycle_start:
        base.productive_cycle_start,

      productive_cycle_end:
        base.productive_cycle_end,

      cycle_start:
        cycleStart,

      cycle_end:
        cycleEnd,

      crop_id:
        base.crop_id,

      crop_name:
        base.crop_name,

      crop_code:
        base.crop_code,

      crop_variety_id:
        base.crop_variety_id,

      crop_variety_name:
        base.crop_variety_name,

      reference_start:
        base.reference_start,

      reference_end:
        base.reference_end,

      ndvi_reference:
        base.ndvi_reference,

      agronomic_cycles:
        base.agronomic_cycles ?? [],

      sessions:
        orderedSessions,

      slots,
    })
  }

  /* -------------------------------------------------------
     3. ORDENAMOS LOS CICLOS
     ------------------------------------------------------- */

  return groups.sort(
    (
      a,
      b
    ) =>
      (
        a.cycle_start ??
        ''
      ).localeCompare(
        b.cycle_start ??
          ''
      )
  )
}