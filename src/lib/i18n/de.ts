export const de = {
  // Navigation
  nav: {
    dashboard: "Übersicht",
    documents: "Belege",
    suppliers: "Lieferanten",
    exports: "Exporte",
    settings: "Einstellungen",
    auditLog: "Protokoll",
  },

  // Document statuses
  status: {
    uploaded: "Hochgeladen",
    processing: "Wird verarbeitet",
    extracted: "Extrahiert",
    validated: "Validiert",
    needs_review: "Prüfung nötig",
    ready: "Bereit",
    exported: "Exportiert",
    export_failed: "Export fehlgeschlagen",
    rejected: "Abgelehnt",
    failed: "Fehlgeschlagen",
    archived: "Archiviert",
  },

  // Document types
  documentType: {
    invoice: "Rechnung",
    credit_note: "Gutschrift",
    receipt: "Quittung",
    reminder: "Mahnung",
    other: "Sonstiges",
  },

  // Export statuses
  exportStatus: {
    not_exported: "Nicht exportiert",
    exporting: "Wird exportiert",
    exported: "Exportiert",
    export_failed: "Export fehlgeschlagen",
  },

  // Review statuses
  reviewStatus: {
    pending: "Ausstehend",
    approved: "Genehmigt",
    rejected: "Abgelehnt",
  },

  // Roles
  role: {
    admin: "Administrator",
    reviewer: "Prüfer",
    accounting: "Buchhaltung",
    readonly: "Nur Lesen",
  },

  // Dashboard
  dashboard: {
    title: "Übersicht",
    uploaded: "Hochgeladen",
    processing: "In Verarbeitung",
    needsReview: "Prüfung nötig",
    ready: "Bereit",
    failed: "Fehlgeschlagen",
    exported: "Exportiert",
    recentDocuments: "Letzte Belege",
    noDocuments: "Noch keine Belege vorhanden. Laden Sie Ihre erste Rechnung hoch.",
    todayUploaded: "Heute hochgeladen",
    avgConfidence: "Ø Konfidenz",
    upload: "Hochladen",
  },

  // Documents
  documents: {
    title: "Belege",
    upload: "Beleg hochladen",
    uploadZoneTitle: "Belege hochladen",
    uploadZoneDescription: "Dateien hierher ziehen oder klicken",
    uploadZoneFormats: "PDF, JPG, PNG — max. 20 MB",
    uploading: "Wird hochgeladen...",
    uploadSuccess: "Beleg erfolgreich hochgeladen",
    uploadError: "Fehler beim Hochladen",
    duplicateWarning: "Dieses Dokument wurde bereits hochgeladen",
    duplicateLink: "Zum bestehenden Beleg",
    noDocuments: "Noch keine Belege vorhanden.",
    supplier: "Lieferant",
    invoiceNumber: "Rechnungsnr.",
    date: "Datum",
    amount: "Betrag",
    confidence: "Konfidenz",
    uploadedAt: "Hochgeladen",
    status: "Status",
    search: "Suchen...",
    allStatuses: "Alle Status",
    filterByStatus: "Nach Status filtern",
    sortBy: "Sortieren nach",
    page: "Seite",
    of: "von",
    showing: "Zeige",
    entries: "Einträge",
    previous: "Zurück",
    next: "Weiter",
  },

  // Document detail
  detail: {
    backToList: "← Zurück zur Liste",
    supplier: "Lieferant",
    supplierRaw: "Name (Original)",
    supplierNormalized: "Name (Normalisiert)",
    vatNumber: "USt-IdNr.",
    invoiceData: "Rechnungsdaten",
    type: "Typ",
    invoiceNumber: "Rechnungsnummer",
    invoiceDate: "Rechnungsdatum",
    dueDate: "Fälligkeitsdatum",
    amounts: "Beträge",
    netAmount: "Netto",
    vatAmount: "MwSt.",
    grossAmount: "Brutto",
    vatRates: "MwSt.-Sätze",
    payment: "Zahlung",
    iban: "IBAN",
    paymentReference: "Zahlungsreferenz",
    categorization: "Kategorisierung",
    expenseCategory: "Ausgabenkategorie",
    accountCode: "Kontennummer",
    costCenter: "Kostenstelle",
    processing: "Verarbeitung",
    confidenceScore: "Konfidenz",
    processingDecision: "Entscheidung",
    createdAt: "Erstellt",
    updatedAt: "Aktualisiert",
    rawOcr: "Rohdaten OCR",
    rawAi: "Rohdaten KI",
    processingHistory: "Verarbeitungshistorie",
    stepName: "Schritt",
    stepStatus: "Status",
    duration: "Dauer",
    error: "Fehler",
    timestamp: "Zeitstempel",
    previewNotAvailable: "Vorschau nicht verfügbar",
    noData: "Keine Daten",
  },

  // Processing steps
  processingStep: {
    upload: "Upload",
    processing: "Verarbeitung",
    ocr: "Texterkennung",
    normalization: "Normalisierung",
    extraction: "Extraktion",
    validation: "Validierung",
    decision: "Entscheidung",
  },

  // Suppliers
  suppliers: {
    title: "Lieferanten",
    noSuppliers: "Noch keine Lieferanten vorhanden. Lieferanten werden automatisch beim Verarbeiten von Belegen erstellt.",
  },

  // Exports
  exports: {
    title: "Exporte",
    noExports: "Noch keine Exporte vorhanden. CSV-Export kommt in Phase 4.",
  },

  // Settings
  settings: {
    title: "Einstellungen",
    company: "Unternehmen",
    integrations: "Integrationen",
    companySettings: "Unternehmenseinstellungen",
    integrationSettings: "Integrationseinstellungen",
    comingSoon: "Kommt in Phase 5.",
  },

  // Audit log
  auditLog: {
    title: "Protokoll",
    noEntries: "Noch keine Protokolleinträge vorhanden.",
  },

  // Auth
  auth: {
    signIn: "Anmelden",
    signingIn: "Wird angemeldet...",
    signOut: "Abmelden",
    email: "E-Mail",
    password: "Passwort",
    signInTitle: "BelegPilot",
    signInDescription: "Melden Sie sich an",
    invalidCredentials: "Ungültige E-Mail oder Passwort",
    signedInAs: "Angemeldet als",
  },

  // Common
  common: {
    loading: "Wird geladen...",
    error: "Fehler",
    save: "Speichern",
    cancel: "Abbrechen",
    delete: "Löschen",
    edit: "Bearbeiten",
    close: "Schliessen",
    confirm: "Bestätigen",
    yes: "Ja",
    no: "Nein",
    or: "oder",
    noData: "—",
  },

  // Relative time
  time: {
    justNow: "gerade eben",
    minutesAgo: (n: number) => `vor ${n} Min.`,
    hoursAgo: (n: number) => `vor ${n} Std.`,
    daysAgo: (n: number) => `vor ${n} T.`,
    weeksAgo: (n: number) => `vor ${n} Wo.`,
  },
} as const;

export type TranslationKey = typeof de;
