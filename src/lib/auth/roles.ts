export const ROLE_LEVELS = {
  GUEST: 1,
  TECHNICIAN: 2,
  SUPERVISOR: 3,
  MANAGER: 4,
  SUPER_ADMIN: 5,
} as const

export type RoleLevel = (typeof ROLE_LEVELS)[keyof typeof ROLE_LEVELS]
