/**
 * Phase 8.9.2 + 9X.1a — Feinere Rollenberechtigungen
 *
 * Definiert ein Permission-System zusätzlich zu den groben UserRoles
 * (admin, trustee, reviewer, viewer/readonly). Jede Rolle erhält eine
 * Liste konkreter Permissions, die in API-Routes geprüft werden können.
 *
 * Verwendung in API-Routes:
 *   import { hasPermission } from "@/lib/permissions";
 *   if (!hasPermission(ctx.session.user.role, "autopilot:configure")) {
 *     return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
 *   }
 */

export type Permission =
  // Belege
  | "documents:read"
  | "documents:write"
  | "documents:approve"
  | "documents:bulk"
  // Lieferanten
  | "suppliers:read"
  | "suppliers:write"
  | "suppliers:verify"
  // Regeln
  | "rules:read"
  | "rules:write"
  | "rules:delete"
  // Knowledge
  | "knowledge:read"
  | "knowledge:write"
  // Autopilot
  | "autopilot:read"
  | "autopilot:configure"
  | "autopilot:kill-switch"
  // Telemetrie
  | "telemetry:read"
  | "telemetry:feedback"
  // Export
  | "exports:read"
  | "exports:create"
  | "exports:retry"
  // Korrekturen
  | "corrections:read"
  | "corrections:promote"
  // System
  | "system:health"
  | "system:admin"
  // Buchhaltung
  | "journal:read"
  | "journal:write"
  | "assets:read"
  | "assets:write"
  | "recurring:read"
  | "recurring:write"
  // Stammdaten
  | "contracts:read"
  | "contracts:write"
  | "bank:read"
  | "bank:write"
  | "expected-docs:read"
  | "expected-docs:write"
  // Perioden + MwSt
  | "periods:read"
  | "periods:write"
  | "periods:lock"
  | "vat:read"
  | "vat:write"
  | "vat:approve"
  // Aufgaben
  | "tasks:read"
  | "tasks:write"
  // Email + Integrationen
  | "email:read"
  | "email:write"
  | "integrations:read"
  | "integrations:write"
  // Eskalation
  | "escalation:read"
  | "escalation:write"
  // Kontenplan
  | "accounts:write"
  // Company
  | "company:read"
  | "company:write"
  // Onboarding
  | "onboarding:read"
  | "onboarding:execute";

const ALL: "*" = "*";

export const ROLE_PERMISSIONS: Record<string, Permission[] | ["*"]> = {
  admin: [ALL],
  trustee: [
    // Belege
    "documents:read", "documents:write", "documents:approve", "documents:bulk",
    // Lieferanten
    "suppliers:read", "suppliers:write", "suppliers:verify",
    // Regeln + Knowledge
    "rules:read", "rules:write",
    "knowledge:read", "knowledge:write",
    // Autopilot
    "autopilot:read", "autopilot:configure", "autopilot:kill-switch",
    // Telemetrie + Export
    "telemetry:read", "telemetry:feedback",
    "exports:read", "exports:create", "exports:retry",
    // Korrekturen
    "corrections:read", "corrections:promote",
    // System
    "system:health",
    // Buchhaltung
    "journal:read", "journal:write",
    "assets:read", "assets:write",
    "recurring:read", "recurring:write",
    // Stammdaten
    "contracts:read", "contracts:write",
    "bank:read", "bank:write",
    "expected-docs:read", "expected-docs:write",
    // Kontenplan
    "accounts:write",
    // Perioden + MwSt
    "periods:read", "periods:write", "periods:lock",
    "vat:read", "vat:write", "vat:approve",
    // Aufgaben
    "tasks:read", "tasks:write",
    // Email + Integrationen
    "email:read", "email:write",
    "integrations:read", "integrations:write",
    // Eskalation
    "escalation:read", "escalation:write",
    // Company + Onboarding
    "company:read", "company:write",
    "onboarding:read", "onboarding:execute",
  ],
  reviewer: [
    // Belege
    "documents:read", "documents:write", "documents:approve", "documents:bulk",
    // Lieferanten (nur lesen)
    "suppliers:read",
    // Regeln + Knowledge (nur lesen)
    "rules:read",
    "knowledge:read",
    // Buchhaltung
    "journal:read", "journal:write",
    "assets:read",
    "recurring:read",
    // Stammdaten (nur lesen)
    "contracts:read",
    "bank:read",
    "expected-docs:read",
    // Perioden + MwSt (nur lesen)
    "periods:read",
    "vat:read",
    // Aufgaben
    "tasks:read", "tasks:write",
    // Email (nur lesen)
    "email:read",
    // Integrationen (nur lesen)
    "integrations:read",
    // Eskalation (nur lesen)
    "escalation:read",
    // Company (nur lesen)
    "company:read",
    // Onboarding (nur lesen)
    "onboarding:read",
    // Weitere Lese-Rechte
    "autopilot:read",
    "telemetry:read",
    "exports:read",
    "corrections:read",
  ],
  viewer: [
    "documents:read",
    "suppliers:read",
    "journal:read",
    "assets:read",
    "contracts:read",
    "bank:read",
    "expected-docs:read",
    "periods:read",
    "vat:read",
    "tasks:read",
    "email:read",
    "company:read",
    "exports:read",
    "onboarding:read",
  ],
  // Legacy-Alias für viewer
  readonly: [
    "documents:read",
    "suppliers:read",
    "journal:read",
    "assets:read",
    "contracts:read",
    "bank:read",
    "expected-docs:read",
    "periods:read",
    "vat:read",
    "tasks:read",
    "email:read",
    "company:read",
    "exports:read",
    "onboarding:read",
  ],
};

export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if ((perms as string[]).includes("*")) return true;
  return (perms as Permission[]).includes(permission);
}

export function requirePermission(role: string | undefined | null, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Keine Berechtigung: ${permission}`);
  }
}

export function permissionsForRole(role: string): readonly Permission[] {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  if ((perms as string[]).includes("*")) {
    return ALL_PERMISSIONS;
  }
  return perms as Permission[];
}

export const ALL_PERMISSIONS: readonly Permission[] = [
  // Belege
  "documents:read", "documents:write", "documents:approve", "documents:bulk",
  // Lieferanten
  "suppliers:read", "suppliers:write", "suppliers:verify",
  // Regeln
  "rules:read", "rules:write", "rules:delete",
  // Knowledge
  "knowledge:read", "knowledge:write",
  // Autopilot
  "autopilot:read", "autopilot:configure", "autopilot:kill-switch",
  // Telemetrie
  "telemetry:read", "telemetry:feedback",
  // Export
  "exports:read", "exports:create", "exports:retry",
  // Korrekturen
  "corrections:read", "corrections:promote",
  // System
  "system:health", "system:admin",
  // Buchhaltung
  "journal:read", "journal:write",
  "assets:read", "assets:write",
  "recurring:read", "recurring:write",
  // Stammdaten
  "contracts:read", "contracts:write",
  "bank:read", "bank:write",
  "expected-docs:read", "expected-docs:write",
  // Kontenplan
  "accounts:write",
  // Perioden + MwSt
  "periods:read", "periods:write", "periods:lock",
  "vat:read", "vat:write", "vat:approve",
  // Aufgaben
  "tasks:read", "tasks:write",
  // Email + Integrationen
  "email:read", "email:write",
  "integrations:read", "integrations:write",
  // Eskalation
  "escalation:read", "escalation:write",
  // Company + Onboarding
  "company:read", "company:write",
  "onboarding:read", "onboarding:execute",
];
