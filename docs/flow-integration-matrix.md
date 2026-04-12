# BelegPilot — Flow Integration Matrix

Stand: 2026-04-12

## Flow 1: Beleg-Verarbeitung (Kern)

Upload -> OCR -> AI-Extraktion -> Validation -> Supplier-Match -> Rules -> Suggestion -> Autopilot -> Review -> Approve -> Journal

| Schritt | Service/Route | Write | Folge-Effekt | Status |
|---------|---------------|-------|-------------|--------|
| Upload | /api/documents/upload | Document, DocumentFile | inngest.send("document.uploaded") | OK |
| OCR + AI | inngest/functions step "ai-normalize" | OcrResult, AiResult, ProcessingStep | populate-canonical triggert | OK |
| Populate | inngest/functions step "populate-canonical" | Document-Felder aktualisiert | Rules triggert | OK |
| Rules | inngest/functions step "apply-rules" | ProcessingStep metadata | Supplier-Match triggert | OK |
| Supplier-Match | inngest/functions step "supplier-matching" | Document.supplierId, Supplier-Defaults | Validation triggert | OK |
| Validation | inngest/functions step "validate" | ProcessingStep, Document.validationResults | Suggestion triggert | OK |
| Suggestion | inngest/functions step "generate-suggestion" | BookingSuggestion | Autopilot triggert | OK |
| Autopilot | inngest/functions step "autopilot-decision" | AutopilotEvent, ggf. Document.status | Review-Queue aktualisiert | OK |
| Review | /documents/[id] UI | -- | User sieht Vorschlag + Konfidenz | OK |
| Approve | /api/documents/[id]/approve | Document.status=ready, SuggestionEvaluation, CorrectionEvent | Journal-faehig | OK |
| Journal | /api/journal POST (manuell) | JournalEntry | Export-faehig | OK |

Hinweis: Approve erstellt KEINEN automatischen JournalEntry. Das ist by design -- Journalbuchungen werden manuell oder via Banana Export erstellt. Der Approve-Schritt markiert den Beleg als "ready" und erfasst die SuggestionEvaluation fuer Telemetrie.

## Flow 2: Bank-Abstimmung

Bank-Import -> Transaktionen -> Matching -> Payment-Status -> Period Quality

| Schritt | Service/Route | Write | Folge-Effekt | Status |
|---------|---------------|-------|-------------|--------|
| Import | /api/bank/import | BankStatement, BankTransaction | Matching-Kandidaten verfuegbar | OK |
| Auto-Match | /api/bank/transactions/[id]/candidates | -- | Kandidaten-Liste | OK |
| Match | /api/bank/transactions/[id]/match | BankTransaction.matchedDocumentId, matchStatus | Payment-Status aktualisiert | OK |
| Payment-Status | /api/documents/[id]/payment-status | -- (read-only) | Anzeige in UI | OK |
| Period Quality | /api/periods/[id]/quality | -- (read-only) | Perioden-Checkliste | OK |

Hinweis: Bank-Matching aktualisiert automatisch den matchStatus der Transaktion. Der Payment-Status wird live berechnet (nicht gecacht) -- kein Invalidation-Problem.

## Flow 3: Banana Round Trip

Mapping -> Readiness -> Export -> [Banana bearbeitet] -> Round Trip Import -> Delta -> Lernsignal

| Schritt | Service/Route | Write | Folge-Effekt | Status |
|---------|---------------|-------|-------------|--------|
| Mapping | /api/banana/mapping POST | Account.bananaMappingStatus | Export-Readiness berechnet | OK |
| VAT Mapping | /api/banana/mapping/vat-codes POST | VatCodeMapping | Export-Readiness berechnet | OK |
| Readiness | /api/banana/export/readiness | -- (read-only) | Export freigegeben | OK |
| Export | /api/banana/export POST | ExportRecord, Document.exportStatus=exported | CSV-Datei generiert | OK |
| Round Trip | /api/banana/round-trip POST | BananaRoundTripEntry | Deltas + Lernsignale erzeugt | OK |
| Lernsignale | banana-round-trip.generateLearnSignals | -- (in Response) | UI zeigt Regel-Update-Empfehlungen | OK |

## Flow 4: MwSt-Abrechnung

Belege mit MwSt -> Perioden-Ende -> VAT Calculate -> Validate -> Approve -> PDF/XML

| Schritt | Service/Route | Write | Folge-Effekt | Status |
|---------|---------------|-------|-------------|--------|
| VAT Calculate | /api/vat POST | VatReturn mit Ziffern | Validierung moeglich | OK |
| VAT Validate | /api/vat/[id]/validate POST | VatReturn.warnings | Approve freigegeben | OK |
| VAT Approve | /api/vat/[id]/approve POST | VatReturn.status=approved | PDF/XML verfuegbar | OK |
| VAT PDF | /api/vat/[id]/pdf GET | -- | PDF-Download | OK |
| VAT XML | /api/vat/[id]/xml GET | -- | XML-Download (eCH-0217) | OK |

## Flow 5: E-Mail-Import

Webhook -> Email-Parser -> Document erstellt -> Pipeline startet -> Notification

| Schritt | Service/Route | Write | Folge-Effekt | Status |
|---------|---------------|-------|-------------|--------|
| Webhook | /api/email/webhook POST | -- | Email geparst | OK |
| Parser | email-parser.processEmailAttachments | Document, DocumentFile | inngest.send("document.uploaded") | OK |
| Pipeline | inngest/functions | Alle Pipeline-Schritte | Beleg verarbeitet | OK |
| Notification | email-parser | Notification | User informiert | OK |

Hinweis: Der Email-Parser erstellt das Document UND triggert die Inngest-Pipeline -- identischer Flow wie manueller Upload.

## Flow 6: Autopilot-Lernkreislauf

Suggestion -> Approve/Modify -> SuggestionEvaluation -> Telemetrie -> Drift Detection -> Mode-Anpassung

| Schritt | Service/Route | Write | Folge-Effekt | Status |
|---------|---------------|-------|-------------|--------|
| Suggestion | suggestion-engine | BookingSuggestion | User Review | OK |
| Approve/Modify | /api/documents/[id]/approve | SuggestionEvaluation (Feld-Level) | Telemetrie-Daten | OK |
| Telemetrie | telemetry-service.computeTelemetry | -- (read-only) | topFieldAccuracy aus Evaluations | OK |
| Drift Detection | drift-detection.detectDrift | -- (read-only) | DriftReport mit Signalen | OK |
| Auto-Downgrade | autopilot-decision.checkAndApplyDrift | AutopilotConfig.mode, AutopilotEvent, Notification | Modus zurueckgestuft | OK |
| Trust Score | supplier-trust.computeSupplierTrustScores | -- (read-only) | Pro-Lieferant Vertrauenswert | OK |

## Zusammenfassung

| Flow | Schritte | Verdrahtet | Luecken |
|------|----------|-----------|---------|
| 1. Beleg-Verarbeitung | 11 | 11/11 | Keine |
| 2. Bank-Abstimmung | 5 | 5/5 | Keine |
| 3. Banana Round Trip | 6 | 6/6 | Keine |
| 4. MwSt-Abrechnung | 5 | 5/5 | Keine |
| 5. E-Mail-Import | 4 | 4/4 | Keine |
| 6. Autopilot-Lernkreislauf | 6 | 6/6 | Keine |
| **Total** | **37** | **37/37** | **0** |

Alle Flows sind durchgehend verdrahtet. Keine Feature-Isolation erkannt.
