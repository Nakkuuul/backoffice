/**
 * The static navigation manifest — the single source consumed by the sidebar,
 * breadcrumb, and command palette. Each entry's `anyPermission` is asserted
 * against the real backend RBAC catalog (src/shared/rbac.js). Sections/leaves
 * the user can't access are pruned client-side (and re-enforced server-side).
 */
export type IconName =
  | "home"
  | "masters"
  | "clients"
  | "ekyc"
  | "accounting"
  | "reports"
  | "documents"
  | "esign"
  | "email"
  | "users"
  | "system"
  | "self";

export interface NavLeaf {
  label: string;
  href: string;
  anyPermission?: string[];
  soon?: boolean;
}

export interface NavSection {
  key: string;
  label: string;
  icon: IconName;
  href?: string;
  anyPermission?: string[];
  children?: NavLeaf[];
}

export const NAV: NavSection[] = [
  { key: "overview", label: "Overview", icon: "home", href: "/overview" },

  {
    key: "masters",
    label: "Masters",
    icon: "masters",
    anyPermission: ["clients:read", "clients:manage"],
    children: [
      { label: "Clients", href: "/masters/clients", anyPermission: ["clients:read"] },
      { label: "General Accounts", href: "/masters/general-accounts", anyPermission: ["clients:read"] },
      { label: "Brokerages", href: "/masters/brokerages", anyPermission: ["clients:read"] },
      { label: "Statutory Charges", href: "/masters/statutory-charges", anyPermission: ["clients:read"] },
      { label: "Our DPs", href: "/masters/our-dps", anyPermission: ["clients:read"] },
      { label: "DP", href: "/masters/dp", anyPermission: ["clients:read"] },
      { label: "Securities", href: "/masters/securities", anyPermission: ["clients:read"] },
      { label: "Collateral Type Definition", href: "/masters/collateral-types", anyPermission: ["clients:read"] },
      { label: "Settlements", href: "/masters/settlements", anyPermission: ["clients:read"] },
      { label: "Branches", href: "/masters/branches", anyPermission: ["clients:read"] },
      { label: "Authorised Persons", href: "/masters/authorised-persons", anyPermission: ["clients:read"] },
      { label: "Group / Family", href: "/masters/group-family", anyPermission: ["clients:read"] },
      { label: "Holidays", href: "/masters/holidays", anyPermission: ["clients:read"] },
      { label: "CTCL", href: "/masters/ctcl", anyPermission: ["clients:read"] },
      { label: "Company Info", href: "/masters/company-info", anyPermission: ["clients:read"] },
    ],
  },
  {
    key: "ekyc",
    label: "eKYC / reKYC",
    icon: "ekyc",
    anyPermission: ["kyc:read", "kyc:manage", "kyc:verify"],
    children: [
      { label: "Applications", href: "/ekyc", anyPermission: ["kyc:read"] },
      { label: "Intake queue", href: "/ekyc/intake", anyPermission: ["kyc:manage"] },
      { label: "Checks", href: "/ekyc/checks", anyPermission: ["kyc:verify"] },
      { label: "Approvals", href: "/ekyc/approvals", anyPermission: ["kyc:verify"] },
    ],
  },
  {
    key: "accounting",
    label: "Accounting",
    icon: "accounting",
    anyPermission: ["accounting:read", "accounting:manage"],
    children: [
      { label: "Group master", href: "/accounting/masters/groups", anyPermission: ["accounting:read"] },
      { label: "Ledger master", href: "/accounting/masters/ledgers", anyPermission: ["accounting:read"] },
      { label: "Trial Balance", href: "/accounting/statements/trial-balance", anyPermission: ["accounting:read"] },
      { label: "Balance Sheet", href: "/accounting/statements/balance-sheet", anyPermission: ["accounting:read"] },
      { label: "Profit & Loss", href: "/accounting/statements/profit-loss", anyPermission: ["accounting:read"] },
      { label: "Vouchers", href: "/accounting/vouchers", anyPermission: ["accounting:manage"], soon: true },
      { label: "Day Book", href: "/accounting/day-book", anyPermission: ["accounting:read"], soon: true },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: "reports",
    anyPermission: ["reports:read", "reports:generate", "reports:bulk"],
    children: [
      { label: "Generate", href: "/reports/generate", anyPermission: ["reports:generate"] },
      { label: "Bulk run", href: "/reports/bulk", anyPermission: ["reports:bulk"] },
      { label: "History", href: "/reports", anyPermission: ["reports:read"] },
      { label: "Definitions", href: "/reports/definitions", anyPermission: ["reports:read"] },
    ],
  },
  {
    key: "documents",
    label: "Documents",
    icon: "documents",
    anyPermission: ["documents:read", "documents:operate"],
    children: [
      { label: "Compress", href: "/documents/compress", anyPermission: ["documents:operate"] },
      { label: "Lock / Unlock", href: "/documents/lock", anyPermission: ["documents:operate"] },
      { label: "Registry", href: "/documents", anyPermission: ["documents:read"] },
    ],
  },
  {
    key: "esign",
    label: "eSign",
    icon: "esign",
    anyPermission: ["esign:read", "esign:sign", "esign:config"],
    children: [
      { label: "Requests", href: "/esign/requests", anyPermission: ["esign:read"] },
      { label: "Sign", href: "/esign/sign", anyPermission: ["esign:sign"] },
      { label: "Settings", href: "/esign/settings", anyPermission: ["esign:config"] },
    ],
  },
  {
    key: "email",
    label: "Email",
    icon: "email",
    anyPermission: ["email:read", "email:send", "email:suppress", "email:config"],
    children: [
      { label: "Compose", href: "/email/compose", anyPermission: ["email:send"] },
      { label: "Outbox", href: "/email/outbox", anyPermission: ["email:read"] },
      { label: "Suppressions", href: "/email/suppressions", anyPermission: ["email:suppress"] },
      { label: "Templates", href: "/email/templates", anyPermission: ["email:read"] },
      { label: "Inbound", href: "/email/inbound", anyPermission: ["email:read"] },
    ],
  },
  {
    key: "users",
    label: "Users",
    icon: "users",
    anyPermission: ["users:read", "users:manage"],
    children: [
      { label: "Directory", href: "/users", anyPermission: ["users:read"] },
      { label: "Roles", href: "/users/roles", anyPermission: ["users:read"] },
      { label: "Register user", href: "/users/new", anyPermission: ["users:manage"] },
    ],
  },
  {
    key: "system",
    label: "System",
    icon: "system",
    anyPermission: ["audit:read", "system:config"],
    children: [
      { label: "Audit log", href: "/system/audit", anyPermission: ["audit:read"] },
      { label: "Settings", href: "/system/settings", anyPermission: ["system:config"], soon: true },
      { label: "Integrations", href: "/system/integrations", anyPermission: ["system:config"], soon: true },
    ],
  },
  {
    key: "self",
    label: "Self-service",
    icon: "self",
    anyPermission: ["self:profile", "self:reports:read", "self:documents:read"],
    children: [
      { label: "My reports", href: "/me/reports", anyPermission: ["self:reports:read"] },
      { label: "My documents", href: "/me/documents", anyPermission: ["self:documents:read"] },
      { label: "Profile", href: "/me/profile", anyPermission: ["self:profile"] },
    ],
  },
];
