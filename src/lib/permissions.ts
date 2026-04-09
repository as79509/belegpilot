/**
 * Phase 8.9.2 — Feinere Rollenberechtigungen
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
  | "documents:read"
  | "documents:write"
  | "documents:approve"
  | "documents:bulk"
  | "suppliers:read"
  | "suppliers:write"
  | "suppliers:verify"
  | "rules:read"
  | "rules:write"
  | "rules:delete"
  | "knowledge:read"
  | "knowledge:write"
  | "autopilot:read"
  | "autopilot:configure"
  | "autopilot:kill-switch"
  | "telemetry:read"
  | "telemetry:feedback"
  | "exports:read"
  | "exports:create"
  | "exports:retry"
  | "corrections:read"
  | "corrections:promote"
  | "system:health"
  | "system:admin";

const ALL: "*" = "*";

export const ROLE_PERMISSIONS: Record<string, Permission[] | ["*"]> = {
  admin: [ALL],
  trustee: [
    "documents:read",
    "documents:write",
    "documents:approve",
    "documents:bulk",
    "suppliers:read",
    "suppliers:write",
    "suppliers:verify",
    "rules:read",
    "rules:write",
    "knowledge:read",
    "knowledge:write",
    "autopilot:read",
    "autopilot:configure",
    "autopilot:kill-switch",
    "telemetry:read",
    "telemetry:feedback",
    "exports:read",
    "exports:create",
    "exports:retry",
    "corrections:read",
    "corrections:promote",
    "system:health",
  ],
  reviewer: [
    "documents:read",
    "documents:write",
    "documents:approve",
    "suppliers:read",
    "rules:read",
    "knowledge:read",
    "autopilot:read",
    "telemetry:read",
    "exports:read",
    "corrections:read",
  ],
  viewer: [
    "documents:read",
    "suppliers:read",
    "exports:read",
  ],
  // Legacy-Alias für viewer
  readonly: [
    "documents:read",
    "suppliers:read",
    "exports:read",
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
    // Liefere alle bekannten Permissions zurück
    return ALL_PERMISSIONS;
  }
  return perms as Permission[];
}

export const ALL_PERMISSIONS: readonly Permission[] = [
  "documents:read",
  "documents:write",
  "documents:approve",
  "documents:bulk",
  "suppliers:read",
  "suppliers:write",
  "suppliers:verify",
  "rules:read",
  "rules:write",
  "rules:delete",
  "knowledge:read",
  "knowledge:write",
  "autopilot:read",
  "autopilot:configure",
  "autopilot:kill-switch",
  "telemetry:read",
  "telemetry:feedback",
  "exports:read",
  "exports:create",
  "exports:retry",
  "corrections:read",
  "corrections:promote",
  "system:health",
  "system:admin",
];
