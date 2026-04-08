-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contract_type" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "notice_period" TEXT,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "monthly_amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'CHF',
    "frequency" TEXT NOT NULL,
    "debit_account" TEXT,
    "vat_rate" DOUBLE PRECISION,
    "linked_supplier_id" UUID,
    "linked_asset_id" UUID,
    "deposit_amount" DECIMAL(12,2),
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reminder_days" INTEGER NOT NULL DEFAULT 30,
    "last_invoice_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contracts_company_id_status_idx" ON "contracts"("company_id", "status");

-- CreateIndex
CREATE INDEX "contracts_company_id_contract_type_idx" ON "contracts"("company_id", "contract_type");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_linked_supplier_id_fkey" FOREIGN KEY ("linked_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_linked_asset_id_fkey" FOREIGN KEY ("linked_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

