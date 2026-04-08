# BelegPilot — Schweizer KMU Buchhaltungsautomatisierung

## Status

Phase 7x Premium Upgrade — KOMPLETT
Phase 8 (Autopilot + Intelligence) — BEREIT

## Stack

- **Frontend**: Next.js 16, React 19, TypeScript (strict), Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Prisma 7, PostgreSQL (Supabase)
- **AI**: Anthropic Claude Vision API (claude-sonnet-4)
- **Queue**: Inngest (async document processing)
- **Storage**: Supabase Storage
- **Export**: Bexio API, CSV, XLSX
- **Testing**: Vitest

## Features

- **AI-gestützte Belegextraktion** mit 11 Validierungschecks
- **Multi-Mandanten** mit Cookie-basiertem Company-Switching
- **Review Cockpit** mit Keyboard-Shortcuts + Queue-Navigation
- **Monatsabschluss** mit Live-Checkliste + Periodensperre
- **Soll-Ist Dokumentenvollständigkeit** pro Mandant
- **Regel-Engine** mit globalen Regeln + Vorlagen
- **Knowledge Base** mit Versionierung
- **Mandanten-Risiko-Board** für Treuhänder
- **Erklärbare AI-Entscheidungen** (Decision Reasons)
- **Vollständiger Audit-Trail** für alle Entitäten
- **Bexio-Integration** + CSV/XLSX Export
- **Anlagenbuchhaltung** mit Abschreibungen (linear/degressiv)
- **Verträge & Fristen** mit Ablauf-Erinnerungen
- **Buchungsjournal** mit wiederkehrenden Buchungen
- **Pendenzen** mit Prioritäten + Nachrichten-Templates
- **Reporting**: Monatsübersicht, MwSt-Zusammenfassung, Mandantenvergleich
- **Smart Suggestions**: Lernt aus Entscheidungen, schlägt Regeln vor
- **Security**: Multi-Tenant Isolation Tests, Rollen-Matrix, Period Guard

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

## Tests

```bash
npm run test        # Einmalig
npm run test:watch  # Watch-Modus
```

86+ Tests: Security Audit, Rollen-Matrix, Period Guard, Pipeline Regression, Validation Engine, Rules Engine, Confidence Scoring, Decision Logic, Risk Score.

## Lizenz

Privat. Nicht zur Weiterverbreitung bestimmt.
