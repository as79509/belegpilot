/**
 * Mapping: API-Route-Pattern -> benoetigte Permission fuer mutierende Aktionen.
 * Wird vom Enforcement-Test und optional von einer Middleware verwendet.
 *
 * Konvention: Keys sind relative Pfade ab src/app/api/ ohne "/route.ts".
 * Dynamische Segmente als [param].
 */

export const ROUTE_PERMISSION_MAP: Record<string, {
  POST?: string;
  PATCH?: string;
  DELETE?: string;
  PUT?: string;
}> = {
  // Kontenplan
  "accounts": { POST: "accounts:write" },
  "accounts/[id]": { PATCH: "accounts:write", DELETE: "accounts:write" },
  "accounts/import": { POST: "accounts:write" },

  // Buchhaltung
  "journal": { POST: "journal:write" },
  "journal/[id]": { PATCH: "journal:write", DELETE: "journal:write" },
  "recurring": { POST: "recurring:write" },
  "recurring/[id]": { PATCH: "recurring:write", DELETE: "recurring:write" },
  "recurring/generate": { POST: "recurring:write" },
  "assets": { POST: "assets:write" },
  "assets/[id]": { PATCH: "assets:write", DELETE: "assets:write" },
  "assets/depreciate": { POST: "assets:write" },

  // Belege
  "documents/[id]": { PATCH: "documents:write" },
  "documents/[id]/approve": { POST: "documents:approve" },
  "documents/[id]/reject": { POST: "documents:approve" },
  "documents/[id]/suggestion": { POST: "documents:write" },
  "documents/bulk-approve": { POST: "documents:bulk" },
  "documents/bulk-reject": { POST: "documents:bulk" },
  "documents/bulk-reprocess": { POST: "documents:bulk" },
  "documents/download-zip": { POST: "exports:create" },

  // Lieferanten
  "suppliers/[id]": { PATCH: "suppliers:write" },
  "suppliers/merge": { POST: "suppliers:write" },
  "suppliers/[id]/verify": { POST: "suppliers:verify" },
  "suppliers/[id]/suggest-defaults": { POST: "suppliers:write" },

  // Stammdaten
  "contracts": { POST: "contracts:write" },
  "contracts/[id]": { PATCH: "contracts:write", DELETE: "contracts:write" },
  "expected-documents": { POST: "expected-docs:write" },
  "expected-documents/[id]": { PATCH: "expected-docs:write", DELETE: "expected-docs:write" },
  "company": { PATCH: "company:write" },
  "knowledge": { POST: "knowledge:write" },
  "knowledge/[id]": { PATCH: "knowledge:write", DELETE: "knowledge:write" },

  // Regeln + Eskalation
  "rules": { POST: "rules:write" },
  "rules/[id]": { PATCH: "rules:write", DELETE: "rules:delete" },
  "rules/quick": { POST: "rules:write" },
  "rules/templates": { POST: "rules:write" },
  "escalation-rules": { POST: "escalation:write" },
  "escalation-rules/[id]": { PATCH: "escalation:write", DELETE: "escalation:write" },
  "escalation-rules/defaults": { POST: "escalation:write" },

  // Perioden + MwSt
  "periods": { POST: "periods:write" },
  "periods/[id]": { PATCH: "periods:lock" },
  "vat": { POST: "vat:write" },
  "vat/[id]": { PATCH: "vat:write" },
  "vat/[id]/validate": { POST: "vat:write" },
  "vat/[id]/approve": { POST: "vat:approve" },

  // Bank
  "bank/accounts": { POST: "bank:write" },
  "bank/accounts/[id]": { PATCH: "bank:write", DELETE: "bank:write" },
  "bank/import": { POST: "bank:write" },
  "bank/transactions/[id]/match": { POST: "bank:write" },

  // Aufgaben
  "tasks": { POST: "tasks:write" },
  "tasks/[id]": { PATCH: "tasks:write", DELETE: "tasks:write" },

  // Email
  "email/inboxes": { POST: "email:write" },
  "email/inboxes/[id]": { PATCH: "email:write", DELETE: "email:write" },

  // Bexio / Export
  "bexio/settings": { PATCH: "integrations:write" },
  "bexio/test": { POST: "integrations:write" },
  "bexio/export": { POST: "exports:create" },
  "exports/csv": { POST: "exports:create" },

  // Autopilot
  "autopilot/config": { PATCH: "autopilot:configure" },
  "autopilot/kill-switch": { POST: "autopilot:kill-switch" },
  "autopilot/drift": { POST: "autopilot:configure" },

  // Korrekturen
  "corrections/patterns/[id]/dismiss": { POST: "corrections:read" },
  "corrections/patterns/[id]/promote": { POST: "corrections:promote" },

  // Nachrichten
  "messages": { POST: "documents:write" },

  // Onboarding
  "onboarding/analyze": { POST: "onboarding:execute" },
  "onboarding/apply": { POST: "onboarding:execute" },

  // Treuhaender
  "trustee/clients": { POST: "company:write" },
  "trustee/clients/[id]": { PATCH: "company:write" },

  // Integrations
  "integrations/[providerId]/import": { POST: "integrations:write" },

  // Banana Mapping + Export + Round Trip
  "banana/mapping": { POST: "integrations:write" },
  "banana/mapping/vat-codes": { POST: "integrations:write" },
  "banana/export": { POST: "exports:create" },
  "banana/round-trip": { POST: "integrations:write" },

  // Supplier Autopilot Override
  "suppliers/[id]/autopilot-override": { PUT: "autopilot:configure" },
};

/**
 * Routes die KEINE hasPermission-Pruefung brauchen (definierte Ausnahmen).
 * Jede Route hier MUSS trotzdem getActiveCompany() verwenden (Auth),
 * ausser sie hat eigene Authentifizierung (z.B. Webhook-Secret).
 */
export const PERMISSION_EXEMPT_ROUTES = [
  "auth",                    // NextAuth routes
  "health",                  // Health-Check
  "inngest",                 // Inngest webhook
  "email/webhook",           // Webhook mit eigenem Secret
  "notifications/[id]/read", // Jeder darf eigene Notifications lesen
  "notifications/read-all",  // Jeder darf eigene Notifications als gelesen markieren
  "telemetry/feedback",      // Hat bereits eigenen hasPermission-Check
  "documents/upload",        // Upload ist fuer alle authentifizierten User
  "documents/reset-stuck",   // Internes Maintenance
  "documents/[id]/reprocess",// Reprocess ist bereits auth-gesichert
  "setup/status",            // Setup-Status fuer jeden auth User
  "autopilot/calibration",   // Read-only, auth-gesichert
  "trustee/analytics",       // Eigener hasPermission-Check (session-basiert)
];
