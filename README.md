# BelegPilot — Schweizer KMU Buchhaltungsautomatisierung

## Status

Phase 7x Premium Upgrade — KOMPLETT
Phase 8 (Autopilot + Intelligence + Governance) — KOMPLETT
Phase 9/9X (Bank, MwSt, E-Mail, Assets, Contracts, Consolidation) — KOMPLETT
Phase 10/10X (Banana, Evaluation, Drift, Trust, Calibration, Audit) — KOMPLETT
Phase 11 (Onboarding Wizard, Business Chat, Bootstrapping, Go-Live) — KOMPLETT

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
│   ├── (dashboard)/      Hauptseiten (39 Seiten)
│   └── api/              155+ Routes nach Feature gruppiert
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
│   │   ├── autopilot/    Decision Engine, Drift, Trust, Calibration
│   │   ├── evaluation/   SuggestionEvaluation Feld-Level-Accuracy
│   │   ├── corrections/  Korrekturmuster-Erkennung
│   │   ├── telemetry/    System Metriken (echte Evaluations)
│   │   ├── banana/       Mapping, Export, Round Trip, Lernsignale
│   │   ├── cockpit/      Review-Cockpit-Helpers
│   │   ├── export/       Bexio + CSV + XLSX
│   │   ├── bexio/        Bexio API Client
│   │   ├── audit/        Audit-Service
│   │   ├── actions/      Next-Action-Engine
│   │   ├── analytics/    Cross-Client Treuhänder-BI
│   │   ├── supplier-matching/ Fuzzy Matching
│   │   ├── onboarding/   Wizard, Business Chat, Bootstrapping,
│   │   │                 Go-Live, Failure Handler, Telemetrie
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

### Phase 9 (Finanz-Module)
- **Bank-Import**: camt.053 Parser, Auto-Matching, Payment-Status
- **MwSt-Abrechnung**: VAT Calculate, Validate, Approve, PDF, XML (eCH-0217 Placeholder)
- **E-Mail-Import**: Webhook, Attachment-Parser, Auto-Pipeline
- **Anlagenbuchhaltung**: Lineare/Degressive Abschreibung
- **Verträge & Fristen**: Ablauf-Erinnerungen

### Phase 10 (Banana + Intelligence)
- **Banana-Harmonisierung**: Kontenplan-Mapping, MwSt-Code-Mapping, Auto-Mapper
- **Banana-Export**: Readiness-Gate, CSV-Export, ExportRecord
- **Banana Round Trip**: Rückimport, 3-Stufen-Matching, Feld-Level-Deltas, Lernsignale
- **SuggestionEvaluation**: Feld-Level-Accuracy (Konto, Kategorie, KST, MwSt)
- **Drift Detection**: 30-Tage-Vergleich, Auto-Downgrade (auto_ready→prefill→shadow)
- **Supplier Trust Score**: Gewichteter Score aus Korrekturen, Stabilität, Accuracy, Banana-Änderungen
- **Supplier Autopilot Override**: Pro-Lieferant Modus (shadow/prefill/auto_ready/disabled)
- **Konfidenz-Kalibrierung**: Echte vs. erwartete Accuracy pro Confidence-Level

### Phase 10X (Konsolidierung)
- **Dead-End Elimination**: Alle Buttons verdrahtet, keine Stubs
- **Flow Integration Audit**: 37/37 Schritte in 6 Kernflows verdrahtet
- **Operational Smoke Matrix**: 29/30 Funktionen ✅, 1 ⚠️ (VAT XML Placeholder)

### Phase 11: Intelligentes Mandanten-Onboarding
- 11.1+11.2 Wizard-Architektur mit Session-Model, BusinessProfile, First-Useful-State
- 11.3 Geführter Bootstrapping-Upload mit Dokumentklassifikation
- 11.4 Konversationeller Business-Chat mit Claude-Extraktion
- 11.5 Intelligence Bootstrapping Engine (Multi-Source, Governance-Status)
- 11.6 Modul-Readiness mit 10 Modulen × 7 Stufen, Known-Unknowns
- 11.7+11.8 Go-Live mit 5-Phasen-Hochlauf (First-30-Days)
- 11.9 Rollenspezifischer Wizard (Unternehmer vs Treuhänder)
- 11.10 Failure Modes mit konservativen Fallbacks
- 11.11 Onboarding-Telemetrie (15+ KPIs)

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

### Autopilot & Intelligence
- `GET/PATCH /api/autopilot/config` — Konfiguration
- `POST /api/autopilot/kill-switch` — Notabschaltung
- `GET/POST /api/autopilot/drift` — Drift Detection + Auto-Downgrade
- `GET /api/autopilot/calibration` — Konfidenz-Kalibrierung
- `GET /api/telemetry` — Metriken (echte SuggestionEvaluations)
- `POST /api/telemetry/feedback` — Feedback-Loop
- `GET /api/corrections/patterns` (+ `/[id]/promote`, `/[id]/dismiss`)
- `GET /api/suppliers/trust-scores` — Lieferanten-Trust-Scores
- `PUT /api/suppliers/[id]/autopilot-override` — Supplier Autopilot Override

### Banana-Harmonisierung
- `GET/POST /api/banana/mapping` — Kontenplan-Mapping
- `POST /api/banana/mapping/vat-codes` — MwSt-Code-Mapping
- `GET /api/banana/export/readiness` — Export-Readiness
- `POST /api/banana/export` — CSV-Export
- `GET/POST /api/banana/round-trip` — Round Trip Import
- `GET /api/banana/round-trip/[batchId]` — Batch-Detail

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

350+ Tests in 34 Suiten: Multi-Tenant Security, Rollen-Matrix, Permission Enforcement, Period Guard, Pipeline Regression, Validation Engine, Rules + Konflikterkennung, Telemetrie, Evaluation, Flow Integration, Dead-End Audit, Smoke Matrix, Drift/Trust Code Audit, API Contract Audit, i18n-Vollständigkeit, Audit-Coverage, Onboarding Wizard Architecture.

## Lizenz

Privat. Nicht zur Weiterverbreitung bestimmt.
