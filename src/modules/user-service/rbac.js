/**
 * Role-Based Access Control catalog — the single source of truth for what each
 * role can do. Defined in code (versioned, reviewable) rather than a DB table:
 * a broker's roles are a fixed, security-sensitive set, and code keeps them
 * auditable. Users are assigned exactly one role (stored on the user row); their
 * effective permissions are resolved from this map.
 *
 * Permission format: `domain:action`. Wildcards are supported:
 *   '*'          → everything (super admin)
 *   'reports:*'  → every reports permission
 */

/** Full permission catalog, grouped by domain (drives the frontend UI too). */
export const PERMISSIONS = Object.freeze({
  users: ['users:read', 'users:manage'],
  clients: ['clients:read', 'clients:manage'],
  esign: ['esign:read', 'esign:sign', 'esign:config'],
  email: ['email:read', 'email:send', 'email:suppress', 'email:config'],
  reports: ['reports:read', 'reports:generate', 'reports:bulk'],
  documents: ['documents:read', 'documents:operate'],
  system: ['audit:read', 'system:config'],
  // Client self-service (their own data only — enforced per-endpoint by client_ref).
  self: ['self:profile', 'self:reports:read', 'self:documents:read'],
});

/** Flat list of every concrete permission. */
export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flat();

/** User scope. Broker = internal staff; client = external customer. */
export const USER_TYPE = Object.freeze({ BROKER: 'broker', CLIENT: 'client' });

/**
 * Role → permissions. Wildcards expand via hasPermission/effectivePermissions.
 * Sensitive config (DSC PIN, SMTP/relay, system) is reserved to super_admin.
 */
export const ROLES = Object.freeze({
  // ── Broker side ──────────────────────────────────────────────────────────
  super_admin: {
    type: USER_TYPE.BROKER,
    label: 'Super Admin',
    description: 'Full control including system configuration and user management.',
    permissions: ['*'],
  },
  admin: {
    type: USER_TYPE.BROKER,
    label: 'Admin',
    description: 'Manage users, clients, and all day-to-day operations.',
    permissions: [
      'users:read', 'users:manage',
      'clients:read', 'clients:manage',
      'esign:read', 'esign:sign',
      'email:read', 'email:send', 'email:suppress',
      'reports:*',
      'documents:*',
      'audit:read',
    ],
  },
  compliance: {
    type: USER_TYPE.BROKER,
    label: 'Compliance',
    description: 'Sign documents, run/inspect reports, review audit trail.',
    permissions: [
      'esign:read', 'esign:sign',
      'reports:read', 'reports:generate',
      'documents:read', 'documents:operate',
      'clients:read', 'audit:read',
    ],
  },
  operations: {
    type: USER_TYPE.BROKER,
    label: 'Operations',
    description: 'Generate reports, process documents, and send client emails.',
    permissions: [
      'reports:read', 'reports:generate', 'reports:bulk',
      'documents:read', 'documents:operate',
      'email:read', 'email:send',
      'esign:read', 'clients:read',
    ],
  },
  support: {
    type: USER_TYPE.BROKER,
    label: 'Support',
    description: 'Assist clients — view data and re-send communications.',
    permissions: ['clients:read', 'reports:read', 'documents:read', 'email:read', 'email:send'],
  },
  auditor: {
    type: USER_TYPE.BROKER,
    label: 'Auditor',
    description: 'Read-only access across the backoffice for audit.',
    permissions: [
      'users:read', 'clients:read', 'esign:read', 'email:read',
      'reports:read', 'documents:read', 'audit:read',
    ],
  },
  // ── Client side ──────────────────────────────────────────────────────────
  client: {
    type: USER_TYPE.CLIENT,
    label: 'Client',
    description: 'View and download own statements, reports, and signed documents.',
    permissions: ['self:profile', 'self:reports:read', 'self:documents:read'],
  },
});

export const ROLE_NAMES = Object.keys(ROLES);

export function isValidRole(role) {
  return Object.prototype.hasOwnProperty.call(ROLES, role);
}

/** Does `role` grant `permission` (honoring '*' and 'domain:*' wildcards)? */
export function hasPermission(role, permission) {
  const def = ROLES[role];
  if (!def) return false;
  const perms = def.permissions;
  if (perms.includes('*')) return true;
  if (perms.includes(permission)) return true;
  const domain = permission.split(':')[0];
  return perms.includes(`${domain}:*`);
}

/** Resolve a role's wildcards into the concrete list of permissions. */
export function effectivePermissions(role) {
  const def = ROLES[role];
  if (!def) return [];
  if (def.permissions.includes('*')) return [...ALL_PERMISSIONS];
  const out = new Set();
  for (const p of def.permissions) {
    if (p.endsWith(':*')) {
      const domain = p.slice(0, -2);
      (PERMISSIONS[domain] || []).forEach((x) => out.add(x));
    } else {
      out.add(p);
    }
  }
  return [...out];
}

/** Public catalog for the frontend (roles + their effective permissions). */
export function roleCatalog() {
  return ROLE_NAMES.map((name) => ({
    role: name,
    ...ROLES[name],
    permissions: effectivePermissions(name),
  }));
}
