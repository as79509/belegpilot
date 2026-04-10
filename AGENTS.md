<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BelegPilot — Agent-Anleitung

## Projekt
- Pfad: `c:\Users\AliSe\OneDrive\Dokumente\Claude Projects\Bookkeeping Automation\belegpilot`
- Repo: https://github.com/as79509/belegpilot

## Befehle
- `npm run dev` — Entwicklungsserver (Port 3000)
- `npm run build` — Produktions-Build
- `npm run test` — Vitest Tests
- `npx tsc --noEmit` — TypeScript-Prüfung
- `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` — Inngest DevServer

## Coding-Standards
- Immer volle Pfade in Terminal-Commands verwenden
- Max 5–6 Dateien pro Prompt ändern (außer Refactor-Tasks)
- Nach jedem Prompt: `npx tsc --noEmit` + `npm run build`
- Immer `git add -A && git commit -m "..." && git push origin main` am Ende
- `.env` niemals committen — `git check-ignore .env` verifizieren
- Prisma 7: Generator ist `prisma-client`, Import aus `@/generated/prisma/client`
- Next.js 16: `params` ist async (`await params`), `middleware.ts` deprecated (funktioniert aber noch)
- Niemals hardcoded Strings im UI — alles via `src/lib/i18n/de.ts`
- Fehlermeldungen IMMER auf Deutsch
- Multi-Tenant: jede Prisma-Query muss nach `companyId` filtern
- Permissions via `hasPermission()` aus `@/lib/permissions` prüfen, nicht inline `["admin", ...].includes(...)`

## Phase-8 Patterns
Seiten und Komponenten sollen das Design System aus `components/ds/` nutzen:

- **`<EntityHeader>`** für Detailseiten-Köpfe (Title, Subtitle, Status, Actions, Tabs)
- **`<FilterBar>`** für Listen-Filter (Search, Selects, Reset-Button)
- **`<StatusBadge status="ready|needs_review|...">`** — Status farblich nach `design-tokens.ts`
- **`<ConfidenceBadge confidence={0.85}>`** — KI-Konfidenz als Pill
- **`<InfoPanel tone="info|warning|error|success" title="..." icon={X}>`** — Hinweis-Boxen (z.B. Regelkonflikte)
- **`<ActionBar>`** — sticky Multi-Select-Aktionen
- **`<AuditPanel entries={...}>`** — Audit-Trail-Anzeige mit `formatRelativeTime`
- **`<EmptyState icon={X} title="..." description="...">`** — leere Zustände
- **`<SectionCard title="...">`** — gruppierte Inhalte
- **`<DataTableWrapper>`** — TanStack-Table-Wrapper

Tokens (Farben, Spacings, Status-Mapping) zentral in `src/lib/design-tokens.ts`.

## i18n-Konventionen
- Datei: `src/lib/i18n/de.ts`
- Alle Strings als geschachtelte Objekte gruppiert nach Feature: `de.documents`, `de.suppliers`, `de.rules`, `de.ruleConflicts`, `de.permissions`, `de.autopilot`, `de.telemetry`, etc.
- Verwendung: `import { de } from "@/lib/i18n/de"` → `<h1>{de.rules.title}</h1>`
- Pluralformen / Variablen: Platzhalter `{name}`, `{count}` und String-Replace im Component
- Test `i18n-completeness.test.ts` stellt sicher, dass keine UI-Datei hardcoded deutsche Strings hat
- Datums-/Zahlenformatierung: `src/lib/i18n/format.ts` (`formatDate`, `formatRelativeTime`, `formatCurrency`)

## Auth + Permissions
- API-Routes beginnen immer mit:
  ```ts
  const ctx = await getActiveCompany();
  if (!ctx) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  ```
- Permission-Check für mutierende Endpoints:
  ```ts
  import { hasPermission } from "@/lib/permissions";
  if (!hasPermission(ctx.session.user.role, "autopilot:configure")) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }
  ```
- Permissions Format: `resource:action` (siehe `src/lib/permissions.ts`)
- Rollen: `admin` (alles), `trustee`, `reviewer`, `viewer`/`readonly`

## Audit-Logging
- Jede Mutation MUSS `logAudit()` aus `@/lib/services/audit/audit-service` aufrufen
- `computeChanges(before, after, fields)` für Diff-Berechnung
- `audit-coverage.test.ts` prüft Vollständigkeit

## Tests
- Vitest, Tests liegen in `src/lib/services/__tests__/` und neben Komponenten in `__tests__/`
- Neue Routes → Eintrag in `security-audit.test.ts` (Phase-8-Suite) prüfen
- Mutierende Routes → in `roles.test.ts` und `audit-coverage.test.ts` aufnehmen
- Tests bewusst Datei-basiert (lesen Source-Code), nicht runtime-basiert — schnell und stabil

## Git-Workflow
1. Änderungen machen
2. `npx tsc --noEmit` — muss grün sein
3. `npm run build` — muss grün sein
4. `npm run test` — muss grün sein
5. `git add -A`
6. `git commit -m "Phase X.Y: <kurze Beschreibung>"`
7. `git push origin main`
- Niemals `git push --force` ohne explizite Bestätigung
- Niemals `--no-verify`
- Commits sind klein und atomar pro Phase/Sub-Phase

## Häufige Stolperfallen
- Next.js 16: `params` ist immer ein `Promise<…>`. `await params` vergessen → 404
- Prisma 7: `prisma.$transaction([...])` für Batch-Updates, nicht parallel `Promise.all`
- Supabase Storage: Pfade enthalten `companyId/...` für Mandantentrennung
- Inngest: Lokal nur via `npx inngest-cli@latest dev -u ...` triggerbar
- React 19: `use()` für Promises in Server Components, `useActionState` statt `useFormState`
