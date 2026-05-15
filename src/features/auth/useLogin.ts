import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { tokens } from '@/lib/auth/tokens'
import { queryClient } from '@/lib/queryClient'
import type { LoginFormValues } from './loginSchema'

// El backend solo devuelve {access, refresh}. El campo requires_password_change
// se obtiene via GET /users/me/ y el guard en _authenticated redirige si es true.
interface LoginResponse {
    access: string
    refresh: string
}

/** POST /api/v1/auth/login/ */
async function loginRequest(values: LoginFormValues): Promise<LoginResponse> {
    const baseUrl = import.meta.env.VITE_API_BASE_URL
    const res = await fetch(`${baseUrl}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
    })
    if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // backend devuelve { detail: "..." } en 401, o errores de campo en 400
        const message =
            (data as Record<string, unknown>)['detail'] ??
            'Usuario o contraseña incorrectos'
        throw new Error(String(message))
    }
    return res.json() as Promise<LoginResponse>
}

/**
 * Mutacion de login. Al exito guarda tokens y navega a /workspaces.
 * El guard en _authenticated maneja requires_password_change via useCurrentUser.
 */
export function useLogin() {
    const navigate = useNavigate()

    return useMutation({
        mutationFn: loginRequest,
        onSuccess(data) {
            tokens.setAccess(data.access)
            tokens.setRefresh(data.refresh)
            // Limpiar cache del usuario anterior para que useCurrentUser refetchee
            // con los nuevos tokens y el guard lea requires_password_change correcto.
            queryClient.removeQueries({ queryKey: ['me'] })
            void navigate({ to: '/workspaces' })
        },
    })
}

