import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  const companyId = "00000000-0000-0000-0000-000000000001";
  const company2Id = "00000000-0000-0000-0000-000000000002";

  // Companies
  await pool.query(
    `INSERT INTO companies (id, name, legal_name, vat_number, currency, address, settings, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
    [companyId, "Demo AG", "Demo AG", "CHE-123.456.789 MWST", "CHF",
     JSON.stringify({ street: "Bahnhofstrasse 1", zip: "8001", city: "Zürich", country: "CH" }),
     JSON.stringify({ aiMonthlyBudgetUsd: 50 })]
  );

  await pool.query(
    `INSERT INTO companies (id, name, legal_name, vat_number, currency, address, settings, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) ON CONFLICT (id) DO NOTHING`,
    [company2Id, "Müller GmbH", "Müller Handels GmbH", "CHE-987.654.321 MWST", "CHF",
     JSON.stringify({ street: "Hauptgasse 12", zip: "3011", city: "Bern", country: "CH" }),
     JSON.stringify({ aiMonthlyBudgetUsd: 30 })]
  );

  // Users
  const hash = await bcrypt.hash("demo2026", 12);

  const adminRes = await pool.query(
    `INSERT INTO users (id, company_id, email, name, password_hash, role, is_active, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET password_hash = $4 RETURNING id`,
    [companyId, "admin@belegpilot.ch", "Admin", hash, "admin"]
  );
  const adminId = adminRes.rows[0].id;

  await pool.query(
    `INSERT INTO users (id, company_id, email, name, password_hash, role, is_active, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET password_hash = $4 RETURNING id`,
    [companyId, "reviewer@belegpilot.ch", "Reviewer", hash, "reviewer"]
  );

  const trusteeRes = await pool.query(
    `INSERT INTO users (id, company_id, email, name, password_hash, role, is_active, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET password_hash = $4 RETURNING id`,
    [company2Id, "trustee@belegpilot.ch", "Treuhänder", hash, "trustee"]
  );
  const trusteeId = trusteeRes.rows[0].id;

  // UserCompany entries
  for (const uc of [
    { userId: adminId, companyId, role: "admin", isDefault: true },
    { userId: trusteeId, companyId, role: "reviewer", isDefault: false },
    { userId: trusteeId, companyId: company2Id, role: "admin", isDefault: true },
  ]) {
    await pool.query(
      `INSERT INTO user_companies (id, user_id, company_id, role, is_default, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, company_id) DO UPDATE SET role = $3, is_default = $4`,
      [uc.userId, uc.companyId, uc.role, uc.isDefault]
    );
  }

  // Suppliers
  const suppliers = [
    { name: "Swisscom", vat: "CHE-100.022.551 MWST", iban: "CH93 0076 2011 6238 5295 7", city: "Bern", cat: "Telekommunikation", acc: "6200" },
    { name: "GoMore", vat: null, iban: "DK50 0040 0440 1162 63", city: "Copenhagen", cat: "Vehicle Rental", acc: "6300" },
    { name: "Migros", vat: "CHE-105.805.898 MWST", iban: "CH35 0078 8000 0500 0845 8", city: "Zürich", cat: "Büromaterial", acc: "6500" },
    { name: "PostFinance", vat: "CHE-114.583.629 MWST", iban: "CH92 0900 0000 1530 5068 3", city: "Bern", cat: "Bankgebühren", acc: "6800" },
    { name: "Coop", vat: "CHE-106.004.989 MWST", iban: "CH72 0070 0110 0006 0379 7", city: "Basel", cat: "Büromaterial", acc: "6500" },
  ];

  for (const s of suppliers) {
    const existing = await pool.query(`SELECT id FROM suppliers WHERE company_id = $1 AND name_normalized = $2`, [companyId, s.name]);
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO suppliers (id, company_id, name_normalized, name_variants, vat_number, iban, city, country, default_category, default_account_code, is_verified, document_count, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, true, 0, NOW(), NOW())`,
        [companyId, s.name, JSON.stringify([s.name]), s.vat, s.iban, s.city, s.city === "Copenhagen" ? "DK" : "CH", s.cat, s.acc]
      );
    }
  }

  // Rules
  const ruleCount = await pool.query(`SELECT COUNT(*) FROM rules WHERE company_id = $1`, [companyId]);
  if (parseInt(ruleCount.rows[0].count) === 0) {
    for (const r of [
      { name: "Swisscom → Telekommunikation", type: "supplier_default", cond: [{ field: "supplierName", operator: "contains", value: "Swisscom" }], act: [{ type: "set_category", value: "Telekommunikation" }, { type: "set_account_code", value: "6200" }] },
      { name: "GoMore → Vehicle Rental", type: "supplier_default", cond: [{ field: "supplierName", operator: "contains", value: "GoMore" }], act: [{ type: "set_category", value: "Vehicle Rental" }, { type: "set_account_code", value: "6300" }] },
      { name: "Kleinbeträge Auto-Genehmigung", type: "auto_approve", cond: [{ field: "grossAmount", operator: "less_than", value: "50" }], act: [{ type: "auto_approve" }] },
    ]) {
      await pool.query(
        `INSERT INTO rules (id, company_id, name, rule_type, conditions, actions, priority, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 10, true, NOW(), NOW())`,
        [companyId, r.name, r.type, JSON.stringify(r.cond), JSON.stringify(r.act)]
      );
    }
  }

  console.log("Seed complete: 2 companies, 3 users, 3 user-company mappings, 5 suppliers, 3 rules");
}

main()
  .catch(console.error)
  .finally(() => pool.end());
