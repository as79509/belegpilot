@AGENTS.md

# BelegPilot — Projektkontext

Buchhaltungsautomatisierung für Schweizer KMU. Verarbeitet Eingangsrechnungen via Claude Vision AI → Validierung → Bexio-Export.

## Tech Stack
- Next.js 16, React 19, TypeScript, Prisma 7, Supabase (DB + Storage), Inngest, shadcn/ui
- KI: Anthropic Claude Vision API (claude-sonnet-4)
- Export: Bexio API, CSV, XLSX

## Konventionen
- UI komplett auf Deutsch (alle Texte über `src/lib/i18n/de.ts`)
- Alle API-Fehlermeldungen auf Deutsch
- Prisma-Queries immer mit `companyId` aus Session filtern (Mandantentrennung)
- Prisma 7: Import aus `@/generated/prisma/client`, braucht `PrismaPg` Adapter
- Tests mit Vitest: `npm run test`
- Commits immer mit `git push origin main` abschliessen
- `.env` niemals committen
- Berechtigungen via `hasPermission(role, "resource:action")` aus `@/lib/permissions`

## Aktueller Stand
Phase 8 KOMPLETT (inkl. 8.9.2 Rollen, Governance, Security-Härtung).
28 Prisma-Models, 93+ API-Routes, ~21 Test-Dateien, 30 Seiten, ~283 Source-Dateien, ~103k LOC.

## Architektur (Kurzfassung)

### Services (`src/lib/services`)
- `ai/` — Claude-Vision-Pipeline + Prompt-Builder
- `ocr/` — OCR-Fallback (Tesseract)
- `pdf/` — PDF-Splitting + Vorschau-Renderer
- `validation/` — 11 Validation-Checks
- `rules/` — Rules-Engine + `detectRuleConflicts` (Phase 8.9.2) + Eskalation
- `suggestions/` — Smart Suggestions
- `autopilot/` — Decision-Engine, Modi, Kill-Switch
- `corrections/` — Korrekturmuster-Erkennung & Promotion
- `telemetry/` — System-KPIs, Snapshot-Computation
- `cockpit/` — Review-Cockpit-Helpers (Queue-Navigation)
- `export/` — Bexio + CSV + XLSX
- `audit/` — Audit-Service (`logAudit`, `computeChanges`)
- `actions/` — Next-Action-Engine
- `supplier-matching/` — Fuzzy-Matching für Lieferanten

### Hooks (`src/lib/hooks`)
- Datenladende Hooks für Dashboard, Documents, Suppliers, etc.
- React Query / SWR-basiert wo sinnvoll

### Components
- `components/ui/` — shadcn/ui Primitives (Button, Card, Dialog, etc.)
- `components/ds/` — Design System: `StatusBadge`, `EntityHeader`, `FilterBar`, `InfoPanel`, `AuditPanel`, `ActionBar`, `ConfidenceBadge`, `EmptyState`, `SectionCard`, `DataTableWrapper`
- `components/shared/` — `CommandPalette`, `GlobalShortcutsProvider`, `ShortcutHelpDialog`
- `components/dashboard|documents|review|suppliers|layout/` — Feature-spezifisch

## Design System

Alle Phase-8 Seiten verwenden konsistent:
- `<EntityHeader>` für Detailseiten-Köpfe (mit Title, Subtitle, Status, Actions)
- `<FilterBar>` für Filter-Leisten in Listen
- `<StatusBadge>` für Document/Period/Export-Status (gemeinsame Mapping in `design-tokens.ts`)
- `<ConfidenceBadge>` für KI-Konfidenz-Anzeigen
- `<InfoPanel tone="info|warning|error|success">` für Hinweise (z.B. Regelkonflikte)
- `<ActionBar>` für Multi-Select-Aktionen am unteren Rand
- `<AuditPanel>` für Audit-Trail-Anzeige
- `<EmptyState>` für leere Zustände
- `<SectionCard>` für gruppierte Inhalte

Tokens (Farben, Spacings, Status-Mapping) zentral in `src/lib/design-tokens.ts`.

## Permissions (Phase 8.9.2)

Definiert in `src/lib/permissions.ts`. Permissions im Format `resource:action`:

- `documents:read|write|approve|bulk`
- `suppliers:read|write|verify`
- `rules:read|write|delete`
- `knowledge:read|write`
- `autopilot:read|configure|kill-switch`
- `telemetry:read|feedback`
- `exports:read|create|retry`
- `corrections:read|promote`
- `system:health|admin`

Rollen:
- `admin` — alle Permissions (`*`)
- `trustee` — alle außer `system:admin` und `rules:delete`
- `reviewer` — Lese- + Approve-Permissions, kein Write auf Stammdaten
- `viewer` / `readonly` — nur Read

Verwendung in API-Routes:
```ts
import { hasPermission } from "@/lib/permissions";
if (!hasPermission(ctx.session.user.role, "autopilot:configure")) {
  return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
}
```

## Neue API-Endpoints (Phase 8)

- `GET /api/telemetry` — System-KPIs
- `POST /api/telemetry/feedback` — Feedback-Loop
- `GET/PATCH /api/autopilot/config` — Konfiguration
- `POST /api/autopilot/kill-switch` — Notabschaltung
- `GET /api/corrections/patterns` — Liste
- `POST /api/corrections/patterns/[id]/promote` — Zu Regel/Knowledge/Lieferantenstandard übernehmen
- `POST /api/corrections/patterns/[id]/dismiss` — Verwerfen
- `GET /api/next-actions?scope=...` — Next-Action-Vorschläge
- `GET /api/search?q=...` — Globale Suche
- `GET /api/documents/[id]/decision-replay` — Entscheidungswiedergabe
- `GET /api/suppliers/[id]/intelligence` — Lieferanten-Aggregat
- `GET /api/rules/[id]/impact` — Wirkungsanalyse Regel
- `GET /api/rules/conflicts` — Konflikt-Analyse (Phase 8.9.2)
- `GET /api/knowledge/[id]/usage` — Wirkungsanalyse Knowledge

## Test-Strategie

- **Multi-Tenant Security Audit** (`security-audit.test.ts`) — alle Routes nutzen `getActiveCompany()`, Phase-8 Routes haben dedizierten Sub-Suite
- **Rollen-Matrix** (`roles.test.ts`) — admin/trustee/reviewer Pflichten je Route
- **Pipeline Regression** (`pipeline-regression.test.ts`) — End-to-End OCR → Validation → Decision
- **Validation Engine** — alle 11 Checks
- **Rules Engine** — Matching + neue Konflikt-Erkennung
- **i18n Vollständigkeit** (`i18n-completeness.test.ts`) — alle Texte in `de.ts`
- **Audit Coverage** — alle mutierenden Routes loggen
- **API Integration** — Smoke-Tests pro Route
- **Period Integration** — Perioden-Sperrung
- **Alert Builder** — Eskalations-Alerts

## Wichtige Patterns

- **API-Routes mit Auth**: Beginnen IMMER mit `const ctx = await getActiveCompany(); if (!ctx) return 401;`
- **Multi-Tenant**: Alle `prisma.<model>.find*()`-Queries enthalten `companyId: ctx.companyId`
- **Audit**: Mutationen rufen `logAudit({ companyId, userId, action, entityType, entityId, changes })` auf
- **Next.js 16**: Route-Params sind `Promise`: `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params;`
- **i18n**: Niemals hardcoded Strings im JSX — alles über `de.section.key`
