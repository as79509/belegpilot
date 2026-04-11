import { NextResponse } from "next/server";
import { getActiveCompany } from "@/lib/get-active-company";
import { permissionsForRole, hasPermission } from "@/lib/permissions";

export async function GET() {
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const role = ctx.session.user.role || "viewer";
  const permissions = permissionsForRole(role);

  const canMutate: Record<string, boolean> = {
    documents: hasPermission(role, "documents:write"),
    documentsApprove: hasPermission(role, "documents:approve"),
    documentsBulk: hasPermission(role, "documents:bulk"),
    suppliers: hasPermission(role, "suppliers:write"),
    suppliersVerify: hasPermission(role, "suppliers:verify"),
    rules: hasPermission(role, "rules:write"),
    rulesDelete: hasPermission(role, "rules:delete"),
    knowledge: hasPermission(role, "knowledge:write"),
    journal: hasPermission(role, "journal:write"),
    assets: hasPermission(role, "assets:write"),
    recurring: hasPermission(role, "recurring:write"),
    contracts: hasPermission(role, "contracts:write"),
    bank: hasPermission(role, "bank:write"),
    expectedDocs: hasPermission(role, "expected-docs:write"),
    periods: hasPermission(role, "periods:write"),
    periodsLock: hasPermission(role, "periods:lock"),
    vat: hasPermission(role, "vat:write"),
    vatApprove: hasPermission(role, "vat:approve"),
    tasks: hasPermission(role, "tasks:write"),
    email: hasPermission(role, "email:write"),
    integrations: hasPermission(role, "integrations:write"),
    escalation: hasPermission(role, "escalation:write"),
    company: hasPermission(role, "company:write"),
    accounts: hasPermission(role, "accounts:write"),
    autopilot: hasPermission(role, "autopilot:configure"),
    system: hasPermission(role, "system:admin"),
    onboarding: hasPermission(role, "onboarding:execute"),
    exports: hasPermission(role, "exports:create"),
  };

  return NextResponse.json({
    role,
    permissions: [...permissions],
    canMutate,
    companyId: ctx.companyId,
  });
}
