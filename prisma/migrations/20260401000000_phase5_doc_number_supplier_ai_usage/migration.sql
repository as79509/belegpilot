-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "document_number" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "bic" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contact_person" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payment_term_days" INTEGER,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "zip" TEXT;

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "estimated_cost_usd" DECIMAL(8,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_company_id_created_at_idx" ON "ai_usage"("company_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "documents_document_number_key" ON "documents"("document_number");

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
