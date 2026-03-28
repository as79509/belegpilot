-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'reviewer', 'accounting', 'readonly');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('uploaded', 'processing', 'extracted', 'validated', 'needs_review', 'ready', 'exported', 'export_failed', 'rejected', 'failed', 'archived');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('invoice', 'credit_note', 'receipt', 'reminder', 'other');

-- CreateEnum
CREATE TYPE "ProcessingDecision" AS ENUM ('auto_ready', 'needs_review', 'failed');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('not_exported', 'exporting', 'exported', 'export_failed');

-- CreateEnum
CREATE TYPE "ProcessingStepStatus" AS ENUM ('started', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "IntegrationProviderType" AS ENUM ('ocr', 'ai', 'export');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('supplier_default', 'auto_approve', 'category_mapping', 'vat_logic');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "vat_number" TEXT,
    "address" JSONB,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CHF',
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'readonly',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'uploaded',
    "document_type" "DocumentType" NOT NULL DEFAULT 'other',
    "supplier_name_raw" TEXT,
    "supplier_name_normalized" TEXT,
    "supplier_id" UUID,
    "invoice_number" TEXT,
    "invoice_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "currency" VARCHAR(3),
    "net_amount" DECIMAL(12,2),
    "vat_amount" DECIMAL(12,2),
    "gross_amount" DECIMAL(12,2),
    "vat_rates_detected" JSONB,
    "iban" TEXT,
    "payment_reference" TEXT,
    "expense_category" TEXT,
    "account_code" TEXT,
    "cost_center" TEXT,
    "confidence_score" DOUBLE PRECISION,
    "processing_decision" "ProcessingDecision",
    "validation_results" JSONB,
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "review_notes" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "export_status" "ExportStatus" NOT NULL DEFAULT 'not_exported',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_files" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_results" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "page_count" INTEGER,
    "processing_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_results" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL,
    "prompt_version" TEXT,
    "raw_payload" JSONB NOT NULL,
    "normalized_data" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "processing_time_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name_normalized" TEXT NOT NULL,
    "name_variants" JSONB NOT NULL DEFAULT '[]',
    "vat_number" TEXT,
    "iban" TEXT,
    "address" JSONB,
    "country" VARCHAR(2),
    "default_category" TEXT,
    "default_account_code" TEXT,
    "default_cost_center" TEXT,
    "default_vat_code" TEXT,
    "document_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_steps" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "step_name" TEXT NOT NULL,
    "status" "ProcessingStepStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "error_details" JSONB,
    "metadata" JSONB,

    CONSTRAINT "processing_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "export_records" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "export_target" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "external_id" TEXT,
    "error_message" TEXT,
    "payload_sent" JSONB,
    "response_received" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "changes" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "provider_type" "IntegrationProviderType" NOT NULL,
    "provider_name" TEXT NOT NULL,
    "credentials" JSONB,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_tested_at" TIMESTAMP(3),
    "last_test_status" TEXT,
    "settings" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rule_type" "RuleType" NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "documents_company_id_status_idx" ON "documents"("company_id", "status");

-- CreateIndex
CREATE INDEX "documents_company_id_supplier_id_idx" ON "documents"("company_id", "supplier_id");

-- CreateIndex
CREATE INDEX "documents_company_id_invoice_date_idx" ON "documents"("company_id", "invoice_date");

-- CreateIndex
CREATE INDEX "documents_company_id_export_status_idx" ON "documents"("company_id", "export_status");

-- CreateIndex
CREATE UNIQUE INDEX "document_files_document_id_key" ON "document_files"("document_id");

-- CreateIndex
CREATE INDEX "document_files_file_hash_idx" ON "document_files"("file_hash");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_results_document_id_key" ON "ocr_results"("document_id");

-- CreateIndex
CREATE INDEX "ai_results_document_id_idx" ON "ai_results"("document_id");

-- CreateIndex
CREATE INDEX "suppliers_company_id_name_normalized_idx" ON "suppliers"("company_id", "name_normalized");

-- CreateIndex
CREATE INDEX "suppliers_company_id_vat_number_idx" ON "suppliers"("company_id", "vat_number");

-- CreateIndex
CREATE INDEX "suppliers_company_id_iban_idx" ON "suppliers"("company_id", "iban");

-- CreateIndex
CREATE INDEX "processing_steps_document_id_idx" ON "processing_steps"("document_id");

-- CreateIndex
CREATE INDEX "export_records_document_id_idx" ON "export_records"("document_id");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_company_id_provider_type_provider_name_key" ON "integrations"("company_id", "provider_type", "provider_name");

-- CreateIndex
CREATE INDEX "rules_company_id_rule_type_idx" ON "rules"("company_id", "rule_type");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_files" ADD CONSTRAINT "document_files_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_results" ADD CONSTRAINT "ocr_results_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_results" ADD CONSTRAINT "ai_results_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_steps" ADD CONSTRAINT "processing_steps_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_records" ADD CONSTRAINT "export_records_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
