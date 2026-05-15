import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina classes de Tailwind sin conflictos. Patrón estándar que usa
 * shadcn/ui en cada componente. Permite escribir:
 *   cn('px-4 py-2', condition && 'bg-red-500', className)
 * y obtener una string final con conflictos resueltos (la última gana).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
