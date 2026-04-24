CREATE TABLE "Client" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "shortName" TEXT NOT NULL,
  "companyName" TEXT,
  "uid" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'CHF',
  "defaultCreditAccount" TEXT NOT NULL,
  "defaultExpenseAccount" TEXT NOT NULL,
  "externalReferencePrefix" TEXT NOT NULL,
  "bookingMethodNote" TEXT,
  "chartOfAccountsRawText" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "Client_shortName_key" ON "Client"("shortName");

CREATE TABLE "Account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "accountNo" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Account_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Account_clientId_accountNo_key" ON "Account"("clientId", "accountNo");
CREATE INDEX "Account_clientId_isActive_idx" ON "Account"("clientId", "isActive");

CREATE TABLE "Document" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientId" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "storedPath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'neu' CHECK ("status" IN ('neu', 'gelesen', 'geprueft', 'exportiert')),
  "supplierName" TEXT,
  "documentDate" DATETIME,
  "invoiceDate" DATETIME,
  "dueDate" DATETIME,
  "invoiceNumber" TEXT,
  "currency" TEXT,
  "grossAmount" REAL,
  "taxHint" TEXT,
  "description" TEXT,
  "suggestedExpenseAccountNo" TEXT,
  "confirmedExpenseAccountNo" TEXT,
  "creditAccountNo" TEXT,
  "externalReference" TEXT NOT NULL,
  "aiReasoningShort" TEXT,
  "aiConfidenceLabel" TEXT,
  "aiRawJson" TEXT,
  "exportedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Document_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Document_externalReference_key" ON "Document"("externalReference");
CREATE INDEX "Document_clientId_status_idx" ON "Document"("clientId", "status");
CREATE INDEX "Document_clientId_createdAt_idx" ON "Document"("clientId", "createdAt");
CREATE INDEX "Document_clientId_documentDate_idx" ON "Document"("clientId", "documentDate");

CREATE TABLE "AppSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "appName" TEXT NOT NULL DEFAULT 'BelegPilot Lite',
  "defaultCurrency" TEXT NOT NULL DEFAULT 'CHF',
  "aiBaseUrl" TEXT,
  "aiApiKey" TEXT,
  "aiModel" TEXT,
  "aiOcrModel" TEXT,
  "aiTimeoutMs" INTEGER NOT NULL DEFAULT 45000,
  "exportDefaultCreditAccount" TEXT,
  "exportDefaultExpenseAccount" TEXT,
  "defaultDateBehavior" TEXT NOT NULL DEFAULT 'document_first',
  "globalExternalReferencePrefix" TEXT NOT NULL DEFAULT 'BPL',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
