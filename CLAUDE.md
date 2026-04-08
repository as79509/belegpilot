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

## Aktueller Stand
Phase 7 komplett. 22 Prisma-Models, 63 API-Routes, 40 Tests, 24 Seiten.
Nächste Phase: Phase 8 (Autopilot + Intelligence).
