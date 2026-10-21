export type UserRole = 'utilisateur' | 'administrateur' | 'superadmin' | 'comptabilite' | 'validateur'

const STAFF_PRIORITY: ReadonlyArray<Exclude<UserRole, 'utilisateur'>> = ['superadmin', 'administrateur', 'validateur', 'comptabilite']

export function isAdminRole(role: UserRole): boolean {
  return role !== 'utilisateur'
}

export function primaryRole(kind: string, roles: readonly string[]): UserRole {
  if (kind !== 'staff') return 'utilisateur'
  return STAFF_PRIORITY.find((role) => roles.includes(role)) ?? 'utilisateur'
}
