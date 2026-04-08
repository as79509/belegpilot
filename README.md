# BelegPilot

Intelligente Buchhaltungsautomatisierung für Schweizer KMU.

## Übersicht

BelegPilot verarbeitet Eingangsrechnungen und Belege automatisch: Hochladen → KI-Extraktion → Validierung → Kategorisierung → Bexio-Export. Entwickelt für Treuhänder und Unternehmer die ihre Buchhaltung beschleunigen wollen.

## Features

- **KI-gestützte Extraktion**: Claude Vision AI erkennt Lieferant, Beträge, MwSt, IBAN aus PDFs und Bildern
- **11 Validierungschecks**: Mathe, Duplikate, Plausibilität, Währung, Daten
- **Regelbasierte Automatisierung**: Lieferanten-Standards, Auto-Genehmigung, Kategorie-Zuordnung
- **Bexio-Integration**: Direkte Buchungsübertragung mit Konten-Mapping und MwSt
- **Treuhänder-Portal**: Multi-Mandant, Prüfungs-Queue, Mandanten-Onboarding, Nachrichten-Templates
- **Buchungsjournal**: Manuelle, wiederkehrende und automatische Buchungen
- **Anlagenbuchhaltung**: Anlagen erfassen, Abschreibungen (linear/degressiv), Privatanteile
- **Verträge & Fristen**: Vertragsmanagement mit Ablauf-Erinnerungen und Vollständigkeitsprüfung
- **Monatsabschluss**: Perioden-Management mit Checkliste und Sperrung
- **Pendenzen**: Task-Management mit Prioritäten, Zuweisung und Nachrichten-Templates
- **Reporting**: Monatsübersicht, MwSt-Zusammenfassung, Mandantenvergleich
- **Smart Suggestions**: Lernt aus deinen Entscheidungen und schlägt Regeln vor
- **Multi-Tenant**: Mandantenfähig von Anfang an

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma 7, PostgreSQL (Supabase)
- **AI**: Anthropic Claude Vision API
- **Queue**: Inngest (async document processing)
- **Storage**: Supabase Storage
- **Export**: Bexio API, CSV, XLSX
- **Testing**: Vitest (40 Tests)

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
# .env ausfüllen (siehe unten)
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

### Umgebungsvariablen

| Variable | Beschreibung |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL (Pooler, Port 6543) |
| `DIRECT_URL` | Supabase PostgreSQL (Direkt, Port 5432) |
| `NEXTAUTH_SECRET` | Geheimer Schlüssel für Sessions |
| `AUTH_SECRET` | Alias für NEXTAUTH_SECRET |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Projekt-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (JWT) |
| `SUPABASE_STORAGE_BUCKET` | Storage Bucket (Standard: "Documents") |
| `INNGEST_DEV` | `1` für lokale Entwicklung |
| `AI_PROVIDER` | `claude` oder `mock` |
| `ANTHROPIC_API_KEY` | Claude API Key |

### Inngest (Background Processing)

```bash
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Inngest DevServer läuft auf http://localhost:8288

### Standard-Anmeldedaten

| E-Mail | Passwort | Rolle |
|---|---|---|
| admin@belegpilot.ch | demo2026 | Administrator |
| reviewer@belegpilot.ch | demo2026 | Prüfer |

## Projektstruktur

```
src/
├── app/                  # Next.js App Router
│   ├── (auth)/           # Login
│   ├── (dashboard)/      # 25+ Dashboard-Seiten
│   │   ├── assets/       # Anlagenbuchhaltung
│   │   ├── contracts/    # Verträge & Fristen
│   │   ├── journal/      # Buchungsjournal + Wiederkehrende
│   │   ├── periods/      # Monatsabschluss
│   │   ├── reports/      # Reporting & Berichte
│   │   ├── tasks/        # Pendenzen & Nachrichten
│   │   ├── trustee/      # Treuhänder-Portal
│   │   └── ...           # Dashboard, Belege, Lieferanten, etc.
│   └── api/              # 55+ API-Endpunkte
│       ├── reports/      # Reporting (monthly, vat-summary, client-comparison)
│       ├── messages/     # Treuhänder-Nachrichten
│       ├── tasks/        # Pendenzen CRUD
│       ├── periods/      # Monatsabschluss
│       ├── contracts/    # Verträge
│       ├── assets/       # Anlagen + Abschreibungen
│       ├── journal/      # Buchungsjournal
│       ├── recurring/    # Wiederkehrende Buchungen
│       └── ...           # Belege, Exporte, Rules, etc.
├── components/           # React-Komponenten
│   ├── documents/        # Beleg-Tabelle, Upload, PDF-Viewer
│   ├── layout/           # Sidebar, Header
│   ├── review/           # Review-Formular
│   └── ui/               # shadcn/ui Basis-Komponenten
├── lib/
│   ├── i18n/             # Deutsche Übersetzungen
│   ├── inngest/          # Background-Job-Definitionen
│   ├── services/
│   │   ├── ai/           # Claude Vision Normalizer + Kosten-Tracking
│   │   ├── audit/        # Audit-Logging
│   │   ├── bexio/        # Bexio API Client + Export
│   │   ├── export/       # CSV/XLSX Export
│   │   ├── rules/        # Rules Engine
│   │   ├── storage/      # Supabase Storage
│   │   ├── supplier-matching/
│   │   └── validation/   # 11 Checks + Confidence Scoring
│   └── types/            # TypeScript Interfaces
prisma/
├── schema.prisma         # 22 Models
├── seed.ts               # Demo-Daten
└── seed-direct.ts        # Direktes SQL-Seeding
```

## API-Endpunkte

| Pfad | Methode | Beschreibung |
|------|---------|-------------|
| `/api/health` | GET | System Health Check (öffentlich) |
| `/api/documents` | GET | Belege auflisten (Filter, Pagination) |
| `/api/documents/upload` | POST | Belege hochladen (PDF/JPG/PNG) |
| `/api/documents/[id]` | GET/PATCH | Beleg lesen/bearbeiten |
| `/api/documents/[id]/approve` | POST | Beleg genehmigen |
| `/api/documents/[id]/reject` | POST | Beleg ablehnen |
| `/api/documents/[id]/reprocess` | POST | Beleg neu verarbeiten |
| `/api/documents/download-zip` | POST | Bulk-Download als ZIP |
| `/api/documents/bulk-reprocess` | POST | Massenverarbeitung |
| `/api/documents/reset-stuck` | POST | Hängende Belege zurücksetzen |
| `/api/bexio/settings` | GET/PATCH | Bexio-Konfiguration |
| `/api/bexio/test` | POST | Bexio-Verbindungstest |
| `/api/bexio/export` | POST | An Bexio exportieren |
| `/api/bexio/accounts` | GET | Bexio-Kontenrahmen |
| `/api/rules` | GET/POST | Regeln CRUD |
| `/api/rules/[id]` | PATCH/DELETE | Regel bearbeiten/löschen |
| `/api/rules/suggestions` | GET | Regelvorschläge |
| `/api/rules/quick` | POST | Schnellregel erstellen |
| `/api/suppliers` | GET | Lieferanten auflisten |
| `/api/suppliers/[id]` | GET/PATCH | Lieferant bearbeiten |
| `/api/suppliers/[id]/verify` | POST | Lieferant verifizieren |
| `/api/suppliers/merge` | POST | Lieferanten zusammenführen |
| `/api/suppliers/autocomplete` | GET | Lieferanten-Autocomplete |
| `/api/exports` | GET | Export-Verlauf |
| `/api/exports/csv` | POST | CSV/XLSX Export |
| `/api/company` | GET/PATCH | Firmeneinstellungen |
| `/api/alerts/system` | GET | Systemwarnungen |
| `/api/alerts/ai-costs` | GET | KI-Kostenübersicht |
| `/api/dashboard/stats` | GET | Dashboard-Statistiken |
| `/api/dashboard/ai-costs` | GET | KI-Kosten Dashboard |
| `/api/audit-log` | GET | Protokoll-Einträge |
| `/api/trustee/overview` | GET | Treuhänder-Übersicht |
| `/api/trustee/queue` | GET | Prüfungs-Queue |
| `/api/trustee/clients` | GET/POST | Mandanten CRUD |
| `/api/trustee/clients/[id]` | GET/PATCH | Mandant bearbeiten |
| `/api/user/companies` | GET | Benutzer-Firmen |
| `/api/journal` | GET/POST | Buchungsjournal |
| `/api/journal/[id]` | PATCH/DELETE | Buchung bearbeiten |
| `/api/recurring` | GET/POST | Wiederkehrende Vorlagen |
| `/api/recurring/[id]` | PATCH/DELETE | Vorlage bearbeiten |
| `/api/recurring/generate` | POST | Fällige generieren |
| `/api/assets` | GET/POST | Anlagen CRUD |
| `/api/assets/[id]` | GET/PATCH | Anlage bearbeiten |
| `/api/assets/depreciate` | POST | Abschreibungen generieren |
| `/api/knowledge` | GET/POST | Mandantenwissen |
| `/api/knowledge/[id]` | PATCH/DELETE | Wissenseintrag bearbeiten |
| `/api/escalation-rules` | GET/POST | Eskalationsregeln |
| `/api/escalation-rules/[id]` | PATCH/DELETE | Regel bearbeiten |
| `/api/contracts` | GET/POST | Verträge CRUD |
| `/api/contracts/[id]` | GET/PATCH | Vertrag bearbeiten |
| `/api/contracts/check` | POST | Vollständigkeit prüfen |
| `/api/periods` | GET/POST | Monatsperioden |
| `/api/periods/[id]` | PATCH | Periode bearbeiten |
| `/api/tasks` | GET/POST | Pendenzen CRUD |
| `/api/tasks/[id]` | PATCH/DELETE | Task bearbeiten |
| `/api/messages` | GET/POST | Treuhänder-Nachrichten |
| `/api/reports/monthly` | GET | Monatsbericht |
| `/api/reports/vat-summary` | GET | MwSt-Zusammenfassung |
| `/api/reports/client-comparison` | GET | Mandantenvergleich |

## Tests

```bash
npm run test        # Einmalig
npm run test:watch  # Watch-Modus
```

40 Unit-Tests: Validation Engine (14), Rules Engine (10), Confidence (5), Decision (5), weitere (6).

## Aktueller Stand

Phase 7.9 abgeschlossen — Phase 7 komplett.

## Lizenz

Privat. Nicht zur Weiterverbreitung bestimmt.
