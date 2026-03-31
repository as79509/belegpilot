# BelegPilot

Buchhaltungs-Automatisierung für die Schweiz. Verarbeitet Rechnungen und Belege von Rohdateien zu validierten, exportfertigen Buchhaltungsdaten.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Datenbank:** Supabase PostgreSQL + Prisma 7 ORM
- **Authentifizierung:** NextAuth.js v5 (Credentials Provider)
- **UI:** shadcn/ui + Tailwind CSS
- **KI-Extraktion:** Claude Vision API (Anthropic)
- **Hintergrundjobs:** Inngest
- **Dateispeicher:** Supabase Storage
- **Deployment:** Vercel

## Lokale Entwicklung

### Voraussetzungen

- Node.js 20+
- Supabase-Projekt (PostgreSQL + Storage)
- Anthropic API-Schlüssel (für KI-Extraktion)

### Setup

```bash
# Repository klonen
git clone https://github.com/as79509/belegpilot.git
cd belegpilot

# Abhängigkeiten installieren
npm install

# Umgebungsvariablen konfigurieren
cp .env.example .env
# .env mit echten Werten ausfüllen (siehe unten)

# Datenbank-Migration ausführen
npx prisma migrate deploy

# Testdaten erstellen
npx prisma db seed

# Entwicklungsserver starten (Terminal 1)
npm run dev

# Inngest Dev Server starten (Terminal 2)
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

### Umgebungsvariablen

| Variable | Beschreibung |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL Verbindungs-URL (Pooler, Port 6543) |
| `DIRECT_URL` | Supabase PostgreSQL Direkt-URL (Port 5432, für Migrationen) |
| `NEXTAUTH_SECRET` | Geheimer Schlüssel für NextAuth Sessions |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Projekt-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key (JWT) |
| `SUPABASE_STORAGE_BUCKET` | Storage Bucket Name (Standard: "Documents") |
| `INNGEST_DEV` | Auf `1` setzen für lokale Entwicklung |
| `AI_PROVIDER` | `claude` für echte Extraktion, `mock` für Entwicklung |
| `ANTHROPIC_API_KEY` | Anthropic API-Schlüssel |

### Standard-Anmeldedaten

| E-Mail | Passwort | Rolle |
|---|---|---|
| admin@belegpilot.ch | admin123 | Administrator |
| reviewer@belegpilot.ch | reviewer123 | Prüfer |

## Deployment (Vercel)

1. Repository mit Vercel verbinden
2. Umgebungsvariablen in Vercel konfigurieren
3. Build Command: `npx prisma generate && next build`
4. Inngest in Produktion konfigurieren (inngest.com)

## Architektur

### Vier Datenschichten (niemals mischen)

1. **Originaldatei** → `DocumentFile` + Supabase Storage
2. **OCR-Rohtext** → `OcrResult` (JSON)
3. **KI-Normalisierung** → `AiResult` (JSON)
4. **Kanonischer Datensatz** → `Document` Felder

### Verarbeitungspipeline

```
Upload → SHA-256 Hash → Duplikat-Check → Supabase Storage →
Claude Vision API → Extraktion + Normalisierung →
Lieferant-Zuordnung → Validierung → Entscheidung →
Prüfung nötig / Bereit → Export
```
