import { describe, it, expect } from "vitest";
import { hasPermission, ROLE_PERMISSIONS } from "@/lib/permissions";

/**
 * Tests that the permission system correctly restricts roles.
 * The actual route-level enforcement is tested in permission-enforcement.test.ts.
 * This test validates the ROLE_PERMISSIONS configuration.
 */

describe("Rollen-Berechtigungen", () => {
  it("admin hat alle Permissions (*)", () => {
    expect(hasPermission("admin", "documents:write")).toBe(true);
    expect(hasPermission("admin", "system:admin")).toBe(true);
    expect(hasPermission("admin", "vat:approve")).toBe(true);
    expect(hasPermission("admin", "rules:delete")).toBe(true);
  });

  it("trustee hat Schreibzugriff auf Stammdaten und Buchhaltung", () => {
    expect(hasPermission("trustee", "journal:write")).toBe(true);
    expect(hasPermission("trustee", "suppliers:write")).toBe(true);
    expect(hasPermission("trustee", "rules:write")).toBe(true);
    expect(hasPermission("trustee", "knowledge:write")).toBe(true);
    expect(hasPermission("trustee", "vat:approve")).toBe(true);
    expect(hasPermission("trustee", "periods:lock")).toBe(true);
    expect(hasPermission("trustee", "escalation:write")).toBe(true);
    // But not system:admin
    expect(hasPermission("trustee", "system:admin")).toBe(false);
  });

  it("reviewer kann Belege genehmigen aber keine Regeln schreiben", () => {
    expect(hasPermission("reviewer", "documents:approve")).toBe(true);
    expect(hasPermission("reviewer", "documents:write")).toBe(true);
    expect(hasPermission("reviewer", "rules:write")).toBe(false);
    expect(hasPermission("reviewer", "knowledge:write")).toBe(false);
    expect(hasPermission("reviewer", "vat:approve")).toBe(false);
  });

  it("viewer/readonly hat keinen Schreibzugriff", () => {
    const writePerms = [
      "documents:write", "documents:approve", "rules:write", "knowledge:write",
      "journal:write", "suppliers:write", "system:admin", "vat:write",
    ] as const;

    for (const perm of writePerms) {
      expect(hasPermission("viewer", perm), `viewer should not have ${perm}`).toBe(false);
      expect(hasPermission("readonly", perm), `readonly should not have ${perm}`).toBe(false);
    }
  });

  it("unbekannte Rolle hat keine Permissions", () => {
    expect(hasPermission("unknown", "documents:read")).toBe(false);
    expect(hasPermission(null, "documents:read")).toBe(false);
    expect(hasPermission(undefined, "documents:read")).toBe(false);
  });
});
