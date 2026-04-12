# BelegPilot — Operational Smoke Matrix

Stand: 2026-04-12

## Bewertungsskala
- ✅ Funktioniert: Einstieg klar, API antwortet, UI zeigt Ergebnis, naechster Schritt erkennbar
- ⚠️ Teilweise: Grundfunktion da, aber Randfall oder Folgeffekt fehlt
- ❌ Blockiert: Funktion existiert im Code, aber UI/API-Bruch oder fehlende Voraussetzung
- 🔲 Nicht gebaut: Feature geplant aber noch nicht implementiert

## Matrix

| # | Funktion | Einstieg | API | Daten | Folgeffekt | Fehlermeldung | Status |
|---|----------|----------|-----|-------|-----------|---------------|--------|
| 1 | Login/Auth | /login (auth Layout) | /api/auth/[...nextauth] | Session via NextAuth | Dashboard-Redirect | Deutsch (de.ts) | ✅ |
| 2 | Dashboard | /dashboard (Sidebar) | /api/dashboard/stats + cockpit | Stats, Cockpit, Alerts | Next-Actions navigierbar | Deutsch | ✅ |
| 3 | Beleg hochladen | /documents Upload-Button | /api/documents/upload | Document, DocumentFile | inngest.send() Pipeline | "Ungueltiger Dateityp", "Datei zu gross" | ✅ |
| 4 | Beleg Review | /documents/[id] | /api/documents/[id] | Suggestion, Confidence, Neighbors | Approve/Reject Buttons | Deutsch | ✅ |
| 5 | Beleg Approve | Review-Seite Button | /api/documents/[id]/approve | status=ready, SuggestionEvaluation, CorrectionEvent | Journal-faehig | Deutsch, Perioden-Lock geprueft | ✅ |
| 6 | Beleg Reject | Review-Seite Button | /api/documents/[id]/reject | status=rejected, reviewNotes | Queue-Navigation zum naechsten | "Ablehnungsgrund ist erforderlich" | ✅ |
| 7 | Autopilot Config | /settings/autopilot (Sidebar) | /api/autopilot/config PATCH | AutopilotConfig | Mode-Steuerung, Kill-Switch | Deutsch | ✅ |
| 8 | Suggestion Engine | Pipeline Step (Inngest) | suggestion-engine.generateSuggestion | BookingSuggestion | Review-Anzeige mit Confidence | intern (Pipeline-Log) | ✅ |
| 9 | Supplier Match | Pipeline Step (Inngest) | supplier-matcher.matchSupplier | Document.supplierId, Defaults | Kontierung uebernommen | intern (Pipeline-Log) | ✅ |
| 10 | Rules Engine | Pipeline Step (Inngest) | rules-engine.evaluateRules | ProcessingStep metadata | Kontierung/Auto-Approve | intern (Pipeline-Log) | ✅ |
| 11 | Period Lock | /periods (Sidebar) | /api/periods/[id] PATCH | MonthlyPeriod.status | Belege in Periode blockiert | "Periode gesperrt" | ✅ |
| 12 | VAT Calculate | /vat (Sidebar) | /api/vat POST | VatReturn mit allen Ziffern | Validate moeglich | Deutsch | ✅ |
| 13 | VAT Validate | /vat Detail | /api/vat/[id]/validate POST | VatReturn.warnings | Approve moeglich | Deutsch | ✅ |
| 14 | VAT PDF | /vat Detail | /api/vat/[id]/pdf GET | Binary PDF | Download | Deutsch | ✅ |
| 15 | VAT XML | /vat Detail | /api/vat/[id]/xml GET | XML (Placeholder) | Download | Deutsch, Header X-Implementation-Status: placeholder | ⚠️ |
| 16 | Bank Import | /bank (Sidebar) | /api/bank/import POST | BankStatement, BankTransaction | Auto-Match + Aufgaben-Erstellung | Deutsch | ✅ |
| 17 | Bank Match | /bank Ungeklaert Tab | /api/bank/transactions/[id]/match POST | matchedDocumentId, matchStatus | Payment-Status berechnet | Deutsch | ✅ |
| 18 | Email Import | /email (Sidebar) | /api/email/webhook POST | Document + DocumentFile | inngest.send() Pipeline + Notification | Webhook-Secret validiert | ✅ |
| 19 | Notifications | Header Bell Icon | /api/notifications GET | Notification | Unread-Count, Read-Markierung | Deutsch | ✅ |
| 20 | Export CSV/XLSX | /exports (Sidebar) | /api/exports/csv POST | ExportRecord + CSV/XLSX | Download-Dialog | Deutsch | ✅ |
| 21 | Banana Mapping | /banana Tab 1 (Sidebar) | /api/banana/mapping GET+POST | Account.bananaMappingStatus | Export-Readiness berechnet | Deutsch | ✅ |
| 22 | Banana Export | /banana Tab 3 | /api/banana/export POST | ExportRecord, Document.exportStatus | CSV-Download | Deutsch | ✅ |
| 23 | Banana Round Trip | /banana Tab 4 | /api/banana/round-trip POST | BananaRoundTripEntry | Deltas + Lernsignale | Deutsch | ✅ |
| 24 | Supplier Detail | /suppliers/[id] | /api/suppliers/[id] + intelligence | Intelligence, Corrections, Knowledge | Bearbeitbar, Trust Score in Liste | Deutsch | ✅ |
| 25 | Rules Impact | /rules Detail | /api/rules/[id]/impact GET | docsAffected, successRate | Wirkungsanalyse sichtbar | Deutsch | ✅ |
| 26 | Knowledge Usage | /settings/ai | /api/knowledge/[id]/usage GET | timesReferenced, lastUsed | Nutzungsanzeige pro Item | Deutsch | ✅ |
| 27 | Client Portal | /client (Sidebar, Rolle viewer) | /api/client/dashboard GET | Tasks, Status, Deadlines | Upload + Task-Ansicht | Deutsch | ✅ |
| 28 | Treuhaender BI | /trustee (Sidebar, Rolle trustee) | /api/trustee/analytics GET | CrossClientSummary | Mandanten-Uebersicht | Deutsch | ✅ |
| 29 | Drift Detection | /settings/autopilot Drift-Card | /api/autopilot/drift GET+POST | DriftReport, Signale | Auto-Downgrade Button | Deutsch | ✅ |
| 30 | Setup Status | /dashboard Widget | /api/setup/status GET | SetupOverview | Inline-Hinweise mit Links | Deutsch | ✅ |

## Zusammenfassung

| Status | Anzahl | Anteil |
|--------|--------|--------|
| ✅ Funktioniert | 29 | 97% |
| ⚠️ Teilweise | 1 | 3% |
| ❌ Blockiert | 0 | 0% |
| 🔲 Nicht gebaut | 0 | 0% |

## Detailbewertungen

### #15 VAT XML (⚠️)
Die XML-Route existiert und liefert eine Datei, aber die eCH-0217 Implementierung ist ein Placeholder.
Der Header `X-Implementation-Status: placeholder` wird gesetzt. Die XML-Datei enthaelt Grundstruktur
aber nicht alle Ziffern gemaess der vollstaendigen eCH-0217-Spezifikation. Die PDF-Variante (#14)
funktioniert vollstaendig und ist fuer die meisten Anwendungsfaelle ausreichend.

## Known Issues

| # | Funktion | Problem | Schwere | Fix-Aufwand |
|---|----------|---------|---------|-------------|
| 15 | VAT XML | eCH-0217 ist Placeholder — Grundstruktur vorhanden, Vollimplementierung fehlt | Niedrig | Hoch (eCH-0217 Spezifikation benoetigt) |

## Anmerkungen

- **Alle 30 Funktionen sind erreichbar** — entweder ueber Sidebar-Navigation oder ueber Detail-Seiten/Deep Links
- **Alle API-Routes geben deutsche Fehlermeldungen** zurueck ("Nicht autorisiert", "Keine Berechtigung", etc.)
- **Kein toter Button** gefunden — jeder sichtbare Button hat einen onClick-Handler oder ist korrekt disabled
- **Inngest-Pipeline** ist der zentrale Verarbeitungsfluss (Upload + Email triggern identische Pipeline)
- **SuggestionEvaluation** schliesst den Lernkreislauf: Approve -> Evaluation -> Telemetrie -> Drift -> Downgrade
- **Banana Round Trip** schliesst den Export-Kreislauf: Export -> Bearbeitung in Banana -> Re-Import -> Lernsignale
