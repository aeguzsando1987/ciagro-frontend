import { z } from 'zod'

/**
 * Schema zod del formulario de cambio de contraseña forzado (Paso 1.2 product-doc).
 * El refine compara new_password con new_password_confirm en cliente para
 * dar feedback inmediato — el backend también lo valida con 400.
 */
export const changePasswordSchema = z
  .object({
    old_password: z.string().min(1, 'La contraseña actual es requerida'),
    new_password: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
    new_password_confirm: z.string().min(1, 'Confirma la nueva contraseña'),
  })
  .refine((data) => data.new_password === data.new_password_confirm, {
    message: 'Las contraseñas no coinciden',
    path: ['new_password_confirm'],
  })

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>
