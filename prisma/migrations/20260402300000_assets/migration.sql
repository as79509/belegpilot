-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "acquisition_date" TIMESTAMP(3) NOT NULL,
    "acquisition_cost" DECIMAL(12,2) NOT NULL,
    "residual_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "useful_life_months" INTEGER NOT NULL,
    "depreciation_method" TEXT NOT NULL DEFAULT 'linear',
    "degressive_rate" DOUBLE PRECISION,
    "asset_account" TEXT NOT NULL,
    "depreciation_account" TEXT NOT NULL,
    "location" TEXT,
    "cost_center" TEXT,
    "assigned_to" TEXT,
    "description" TEXT,
    "serial_number" TEXT,
    "supplier" TEXT,
    "license_plate" TEXT,
    "private_use_percent" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'active',
    "disposal_date" TIMESTAMP(3),
    "disposal_amount" DECIMAL(12,2),
    "total_depreciated" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "book_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_company_id_status_idx" ON "assets"("company_id", "status");

-- CreateIndex
CREATE INDEX "assets_company_id_category_idx" ON "assets"("company_id", "category");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

