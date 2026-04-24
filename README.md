# BelegPilot Lite

Mobile-first PWA für Treuhänder zum Erfassen, Prüfen und Exportieren von Belegen als Banana-Importdatei.

## MVP Umfang

- Mandanten anlegen und bearbeiten
- Kontenplan als Rohtext speichern
- Kontenplan heuristisch oder per AI strukturieren
- Belege per Kamera oder Mehrfach-Upload erfassen
- AI-Auslesen und Vorschlag für genau ein Aufwandskonto
- Mobile Prüfmaske für Korrektur und Statuswechsel
- Banana Export pro Mandant und Zeitraum
- Installierbare PWA mit Manifest, Icons, Apple-Touch-Support und Service Worker

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- Prisma 7
- SQLite

## Lokal starten

1. `npm install`
2. `npx prisma generate`
3. `npm run db:bootstrap`
4. `npm run dev`

Die lokale SQLite-Datei liegt standardmäßig unter `data/dev.db`.

## Verifikation

- TypeScript: `npx tsc --noEmit`
- Tests: `npm run test`
- Produktions-Build: `npm run build`

## Wichtige Dateien

- `prisma/schema.prisma`
- `prisma/migrations/20260424023000_init/migration.sql`
- `prisma/bootstrap.ts`
- `src/app/mandanten/page.tsx`
- `src/app/belege/page.tsx`
- `src/app/belege/[id]/page.tsx`
- `src/app/export/page.tsx`
- `src/app/einstellungen/page.tsx`
- `src/app/api/documents/upload/route.ts`
- `src/app/api/documents/[id]/process/route.ts`
- `src/app/api/export/route.ts`
- `src/lib/ai.ts`
- `src/lib/chart-of-accounts.ts`
- `src/lib/banana.ts`
- `src/lib/db.ts`

## Umgebungsvariablen

### Optional für lokale Datenbank

- `DATABASE_URL`
  Standard: `file:./data/dev.db`
  Wenn eine alte Nicht-SQLite-URL in `.env` steht, fällt die Lite-App automatisch auf die lokale SQLite-Datei zurück.

### Optional für AI

- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_MODEL`
- `AI_OCR_MODEL`
- `AI_TIMEOUT_MS`

Ohne AI-Konfiguration läuft der Upload weiter mit sauberem Fallback:

- Lieferant aus Dateiname
- Standardwährung des Mandanten
- Fallback-Aufwandskonto des Mandanten
- Status bleibt prüfbar

## AI Annahmen

- Erwartet wird ein OpenAI-kompatibler `chat/completions` Endpunkt.
- Bilder werden direkt als Base64-Bildinput gesendet.
- PDFs werden serverseitig in PNG-Seiten umgewandelt und dann an das Modell gesendet.
- Der Kontierungsprompt enthält die strukturierten Konten des aktuellen Mandanten.
- Wenn das Modell ein unbekanntes Konto liefert, fällt die App auf das Standard-Aufwandskonto zurück.

## Banana Export Annahmen

Vor der Implementierung wurden die offiziellen Banana-Dokumentationsseiten geprüft:

- [Import "Text file with columns header"](https://www.banana.ch/doc/en/node/9966)
- [Multi-currency accounting tables and columns structure](https://www.banana.ch/doc/en/node/10133)
- [Import Transactions dialog](https://www.banana.ch/doc/en/node/9964)

Umgesetzt wurde die konservative, einfache Importvariante:

- UTF-8 Textdatei mit Spaltenkopf in der ersten Zeile
- Tab-separiert
- Datum im Format `yyyy-mm-dd`
- Dezimaltrennzeichen `.`
- Keine Tausendertrennzeichen
- Stabile Spaltenreihenfolge:
  `Date`, `DateDocument`, `Doc`, `DocInvoice`, `ExternalReference`, `Description`, `AccountDebit`, `AccountCredit`, `Amount`
- `DocInvoice` wird gesetzt, wenn eine Rechnungsnummer vorhanden ist
- `ExternalReference` wird immer gesetzt
- Pro Beleg genau eine Buchungszeile
- Export optional nur für geprüfte Belege
- Nach erfolgreichem Export werden die exportierten Belege als `exportiert` markiert

## Datenbank und Migration

- Die Initialmigration liegt als SQL-Datei unter `prisma/migrations/20260424023000_init/migration.sql`
- `npm run db:bootstrap` wendet diese Initialmigration lokal an
- Zusätzlich initialisiert sich die App auf einer leeren lokalen SQLite-Datei beim ersten Zugriff selbst

## Demo Daten

In den Einstellungen gibt es einen Button für Demo-Daten.

Alternativ per Laufzeit:

- `POST /api/demo`

## Bewusst klein gehalten

- Keine Benutzer- und Rollenverwaltung
- Keine Bank-, Mail- oder Bexio-Integration
- Kein Analytics- oder Cockpit-Bereich
- Keine komplexe OCR-Pipeline außerhalb des Modell-Inputs
- Kein mehrstufiges Freigabe- oder Regelwerk
- Kein Desktop-zentriertes Tabellenprodukt
