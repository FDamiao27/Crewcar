// Perfis e permissões administrativas (partilhado entre servidor e interface).

export const ROLES = {
  owner: "Proprietário",
  admin: "Administrador",
  editor: "Editor",
} as const;
export type Role = keyof typeof ROLES;

export const PERMISSIONS = {
  "vehicles.manage": "Gerir viaturas, fotografias e preços",
  "vehicles.delete": "Eliminar viaturas definitivamente",
  "costs.view": "Ver preços de aquisição e margens",
  "leads.manage": "Gerir contactos de clientes",
  "leads.delete": "Eliminar contactos de clientes",
  "content.manage": "Editar conteúdos do website",
  "settings.manage": "Alterar definições gerais",
  "users.manage": "Gerir utilizadores administrativos",
} as const;
export type Permission = keyof typeof PERMISSIONS;

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: Object.keys(PERMISSIONS) as Permission[],
  admin: [
    "vehicles.manage",
    "vehicles.delete",
    "costs.view",
    "leads.manage",
    "leads.delete",
    "content.manage",
    "settings.manage",
  ],
  editor: ["vehicles.manage", "leads.manage", "content.manage"],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function permissionsFor(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role];
}
