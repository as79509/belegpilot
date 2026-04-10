# BelegPilot — Schweizer KMU Buchhaltungsautomatisierung

## Status

Phase 7x Premium Upgrade — KOMPLETT
Phase 8 (Autopilot + Intelligence + Governance) — KOMPLETT

## Stack

- **Frontend**: Next.js 16, React 19, TypeScript (strict), Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma 7, PostgreSQL (Supabase)
- **AI**: Anthropic Claude Vision API (claude-sonnet-4)
- **Queue**: Inngest (async document processing)
- **Storage**: Supabase Storage
- **Export**: Bexio API, CSV, XLSX
- **Testing**: Vitest

## Architektur-Übersicht

```
src/
├── app/
│   ├── (auth)/           Login, Reset
│   ├── (dashboard)/      Hauptseiten (30 Seiten)
│   └── api/              93 Routes nach Feature gruppiert
├── components/
│   ├── ui/               shadcn/ui Primitives
│   ├── ds/               Design System (StatusBadge, EntityHeader,
│   │                     FilterBar, InfoPanel, AuditPanel, ActionBar,
│   │                     ConfidenceBadge, EmptyState, SectionCard,
│   │                     DataTableWrapper)
│   ├── shared/           Command Palette, Global Shortcuts
│   ├── layout/           Sidebar, Header
│   ├── dashboard/        Dashboard-spezifische Widgets
│   ├── documents/        Document Detail Komponenten
│   ├── review/           Review Cockpit
│   └── suppliers/        Lieferanten-Komponenten
├── lib/
│   ├── auth.ts           NextAuth Setup
│   ├── permissions.ts    Permission-System (Phase 8.9.2)
│   ├── get-active-company.ts Multi-Tenant Cookie + UserCompany
│   ├── i18n/             Vollständige DE-Übersetzungen
│   ├── design-tokens.ts  Farben, Spacings, Status-Mappings
│   ├── inngest/          Background Jobs
│   ├── hooks/            React Query / SWR Hooks
│   ├── services/         Business Logic
│   │   ├── ai/           Claude Vision Pipeline
│   │   ├── ocr/          OCR Fallback
│   │   ├── pdf/          PDF-Splitting + Vorschau
│   │   ├── validation/   11 Validierungs-Checks
│   │   ├── rules/        Regel-Engine + Konflikterkennung
│   │   ├── suggestions/  Smart Suggestions
│   │   ├── autopilot/    Autopilot Decision Engine
│   │   ├── corrections/  Korrekturmuster-Erkennung
│   │   ├── telemetry/    System Metriken
│   │   ├── cockpit/      Review-Cockpit-Helpers
│   │   ├── export/       Bexio + CSV + XLSX
│   │   ├── bexio/        Bexio API Client
│   │   ├── audit/        Audit-Service
│   │   ├── actions/      Next-Action-Engine
│   │   ├── supplier-matching/ Fuzzy Matching
│   │   └── storage/      Supabase Storage
│   └── types/            Shared Types
└── generated/prisma/     Prisma Client
```

## Features

### Phase 1–7 (Basis)
- AI-gestützte Belegextraktion mit 11 Validierungs-Checks
- Multi-Mandanten mit Cookie-basiertem Company-Switching
- Review Cockpit mit Keyboard-Shortcuts + Queue-Navigation
- Monatsabschluss mit Live-Checkliste + Periodensperre
- Soll-Ist Dokumentenvollständigkeit pro Mandant
- Regel-Engine mit globalen Regeln + Vorlagen
- Knowledge Base mit Versionierung
- Mandanten-Risiko-Board für Treuhänder
- Erklärbare AI-Entscheidungen (Decision Reasons)
- Vollständiger Audit-Trail für alle Entitäten
- Bexio-Integration + CSV/XLSX Export
- Anlagenbuchhaltung mit Abschreibungen (linear/degressiv)
- Verträge & Fristen mit Ablauf-Erinnerungen
- Buchungsjournal mit wiederkehrenden Buchungen
- Pendenzen mit Prioritäten + Nachrichten-Templates
- Reporting: Monatsübersicht, MwSt-Zusammenfassung, Mandantenvergleich
- Smart Suggestions: Lernt aus Entscheidungen, schlägt Regeln vor

### Phase 8 (Autopilot + Intelligence + Governance)
- **Autopilot** mit Modi (shadow / prefill / auto_ready), Kill-Switch, Audit-Trail
- **Korrekturmuster**: Erkennt wiederholte Korrekturen, Promotion zu Regel/Knowledge/Lieferantenstandard
- **Telemetrie & Feedback**: System-KPIs, Genauigkeit, Feedback-Loop
- **Decision-Replay**: Schritt-für-Schritt Wiedergabe der KI-Entscheidung
- **Lieferanten-Intelligenz**: Verknüpfte Regeln, Wissen, Eskalationen
- **Wirkungsanalyse** für Regeln und Wissen (`/api/rules/[id]/impact`, `/api/knowledge/[id]/usage`)
- **Next-Actions-Engine**: Schlägt nächste sinnvolle Schritte vor
- **Globale Suche** über Belege, Lieferanten, Perioden, Knowledge
- **Permission-System**: Feinkörnige Berechtigungen pro Rolle (Phase 8.9.2)
- **Regelkonflikt-Erkennung**: Findet doppelte und widersprüchliche Regeln (Phase 8.9.2)
- **Erweiterter Security-Audit**: Multi-Tenant Tests für alle Phase-8 Routes (Phase 8.9.2)

## Setup

### Voraussetzungen

- Node.js 20+
- PostgreSQL (Supabase empfohlen)
- Anthropic API Key
- Optional: Bexio Account + PAT

### Installation

```bash
git clone https://github.com/as79509/belegpilot.git
cd belegpilot
npm install
cp .env.example .env
# .env ausfüllen
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

### Inngest (Background Processing)

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

### Standard-Anmeldedaten

| E-Mail | Passwort | Rolle |
|---|---|---|
| admin@belegpilot.ch | demo2026 | Administrator |
| reviewer@belegpilot.ch | demo2026 | Prüfer |
| trustee@belegpilot.ch | demo2026 | Treuhänder |

## API-Übersicht (gruppiert)

### Belege
- `GET/POST /api/documents` — Liste / Erstellen
- `GET/PATCH/DELETE /api/documents/[id]` — Detail
- `POST /api/documents/[id]/approve|reject|reset|reextract` — Workflow
- `POST /api/documents/bulk-approve` / `bulk-reject` / `bulk-reprocess` — Batch
- `GET /api/documents/[id]/decision-replay` — Schritt-für-Schritt-Wiedergabe
- `POST /api/documents/upload` / `download-zip` / `reset-stuck`

### Lieferanten & Stammdaten
- `GET/POST /api/suppliers` (+ `/[id]`, `/autocomplete`, `/merge`, `/intelligence`)
- `GET/POST /api/knowledge` (+ `/[id]`, `/usage`)
- `GET/POST /api/expected-documents`

### Regeln & Eskalation
- `GET/POST /api/rules` (+ `/[id]`, `/quick`, `/templates`, `/suggestions`, `/[id]/impact`)
- `GET /api/rules/conflicts` — Konflikt-Analyse (Phase 8.9.2)
- `GET/POST /api/escalation-rules` (+ `/defaults`)

### Autopilot & Intelligence (Phase 8)
- `GET/PATCH /api/autopilot/config` — Konfiguration
- `POST /api/autopilot/kill-switch` — Notabschaltung
- `GET /api/telemetry` — Metriken
- `POST /api/telemetry/feedback` — Feedback-Loop
- `GET /api/corrections/patterns` (+ `/[id]/promote`, `/[id]/dismiss`)
- `GET /api/next-actions?scope=document|period|company&id=...`
- `GET /api/search?q=...`

### Buchhaltung
- `GET/POST /api/journal` (+ `/[id]`)
- `GET/POST /api/recurring`
- `GET/POST /api/contracts`
- `GET/POST /api/periods` (+ `/[id]`)
- `GET/POST /api/reports`
- `GET/POST /api/assets`

### Exporte & Bexio
- `GET/POST /api/exports` (+ `/[id]`, `/[id]/retry`)
- `GET /api/bexio/...` — Verbindung, Mapping, Sync

### System
- `GET /api/health` — Health Check
- `GET /api/audit-log` (+ `/entity`)
- `GET /api/dashboard`
- `GET/POST /api/tasks`
- `GET/POST /api/messages`

## Tests

```bash
npm run test        # Einmalig
npm run test:watch  # Watch-Modus
npx tsc --noEmit    # TypeScript-Prüfung
```

Tests decken ab: Multi-Tenant Security Audit (inkl. Phase-8 Routes), Rollen-Matrix, Permission-System, Period Guard, Pipeline Regression, Validation Engine, Rules Engine + Konflikterkennung, Confidence Scoring, Decision Logic, Risk Score, i18n-Vollständigkeit, Audit-Coverage, Alert-Builder.

## Lizenz

Privat. Nicht zur Weiterverbreitung bestimmt.
