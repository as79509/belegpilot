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

  // Contracts (Demo AG)
  const contractCount = await pool.query(`SELECT COUNT(*) FROM contracts WHERE company_id = $1`, [companyId]);
  if (parseInt(contractCount.rows[0].count) === 0) {
    for (const c of [
      { name: "Büro Miete Bahnhofstrasse", type: "rent", party: "Vermieter AG", amount: 2500, freq: "monthly", start: "2024-01-01", account: "6000", notice: "6 Monate" },
      { name: "Swisscom Business", type: "telecom", party: "Swisscom", amount: 89, freq: "monthly", start: "2025-03-01", end: "2026-02-28", account: "6200" },
      { name: "Microsoft 365", type: "software", party: "Microsoft", amount: 45, freq: "monthly", start: "2025-06-01", account: "6500", auto: true },
    ]) {
      await pool.query(
        `INSERT INTO contracts (id, company_id, name, contract_type, counterparty, start_date, end_date, monthly_amount, frequency, debit_account, notice_period, auto_renew, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())`,
        [companyId, c.name, c.type, c.party, c.start, c.end || null, c.amount, c.freq, c.account, c.notice || null, c.auto || false]
      );
    }
  }

  // Assets (Demo AG)
  const assetCount = await pool.query(`SELECT COUNT(*) FROM assets WHERE company_id = $1`, [companyId]);
  if (parseInt(assetCount.rows[0].count) === 0) {
    for (const a of [
      { name: "MacBook Pro 16", cat: "it_hardware", date: "2025-01-15", cost: 3200, rv: 200, life: 36, acc: "1500", depr: "6800" },
      { name: "Tesla Model 3", cat: "vehicles", date: "2024-06-01", cost: 42000, rv: 15000, life: 60, acc: "1530", depr: "6810", plate: "ZH 123456", priv: 30 },
      { name: "Büroeinrichtung", cat: "furniture", date: "2024-03-01", cost: 8500, rv: 500, life: 96, acc: "1510", depr: "6800" },
    ]) {
      await pool.query(
        `INSERT INTO assets (id, company_id, name, category, acquisition_date, acquisition_cost, residual_value, useful_life_months, asset_account, depreciation_account, license_plate, private_use_percent, book_value, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $5, NOW(), NOW())`,
        [companyId, a.name, a.cat, a.date, a.cost, a.rv, a.life, a.acc, a.depr, a.plate || null, a.priv || null]
      );
    }
  }

  // Recurring entries (Demo AG)
  const recurCount = await pool.query(`SELECT COUNT(*) FROM recurring_entries WHERE company_id = $1`, [companyId]);
  if (parseInt(recurCount.rows[0].count) === 0) {
    for (const r of [
      { name: "Monatsmiete Büro", debit: "6000", credit: "2000", amount: 2500, freq: "monthly", day: 1 },
      { name: "Swisscom Abo", debit: "6200", credit: "2000", amount: 89, freq: "monthly", day: 15 },
      { name: "Microsoft 365", debit: "6500", credit: "2000", amount: 45, freq: "monthly", day: 1 },
      { name: "Fahrzeugleasing", debit: "6300", credit: "2000", amount: 450, freq: "monthly", day: 5 },
      { name: "Gebäudeversicherung", debit: "6100", credit: "2000", amount: 125, freq: "quarterly", day: 1 },
    ]) {
      await pool.query(
        `INSERT INTO recurring_entries (id, company_id, name, debit_account, credit_account, amount, frequency, day_of_month, start_date, description, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, '2025-01-01', $2, NOW(), NOW())`,
        [companyId, r.name, r.debit, r.credit, r.amount, r.freq, r.day]
      );
    }
  }

  // Escalation rules (Demo AG)
  const escCount = await pool.query(`SELECT COUNT(*) FROM escalation_rules WHERE company_id = $1`, [companyId]);
  if (parseInt(escCount.rows[0].count) === 0) {
    for (const e of [
      { name: "Neuer Lieferant", cond: "new_supplier" },
      { name: "Betrag über CHF 5000", cond: "amount_above", threshold: 5000 },
      { name: "Auslandsbeleg", cond: "foreign_document" },
    ]) {
      await pool.query(
        `INSERT INTO escalation_rules (id, company_id, name, condition, threshold, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())`,
        [companyId, e.name, e.cond, e.threshold || null]
      );
    }
  }

  // Knowledge items (Demo AG)
  const knCount = await pool.query(`SELECT COUNT(*) FROM knowledge_items WHERE company_id = $1`, [companyId]);
  if (parseInt(knCount.rows[0].count) === 0) {
    for (const k of [
      { cat: "supplier_note", title: "GoMore Buchungslogik", content: "GoMore AG ist ein dänischer Carsharing-Anbieter. Rechnungen kommen in DKK. Immer auf Konto 6300 buchen, Vorsteuer nur bei CH-Rechnung." },
      { cat: "booking_rule", title: "Privatanteil Tesla", content: "Tesla Model 3 hat 30% Privatanteil. Benzin/Strom/Service-Rechnungen mit Bezug zum Fahrzeug müssen um 30% reduziert werden." },
      { cat: "exception", title: "Kassenbelege Migros", content: "Migros-Quittungen unter CHF 50 können automatisch auf 6500 (Büromaterial) gebucht werden. Über CHF 50 manuell prüfen." },
    ]) {
      await pool.query(
        `INSERT INTO knowledge_items (id, company_id, category, title, content, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())`,
        [companyId, k.cat, k.title, k.content]
      );
    }
  }

  // Tasks (Demo AG)
  const taskCount = await pool.query(`SELECT COUNT(*) FROM tasks WHERE company_id = $1`, [companyId]);
  if (parseInt(taskCount.rows[0].count) === 0) {
    for (const t of [
      { title: "Swisscom-Rechnung März fehlt", type: "missing_document", prio: "high" },
      { title: "Privatanteil Tesla Q1 prüfen", type: "check_private_use", prio: "medium" },
      { title: "Neuer Lieferant 'Fiverr' verifizieren", type: "review_needed", prio: "medium" },
      { title: "Leasingvertrag Tesla hochladen", type: "upload_contract", prio: "low" },
      { title: "MwSt-Abrechnung Q4 2025 einreichen", type: "check_vat", prio: "urgent", due: "2026-04-30" },
    ]) {
      await pool.query(
        `INSERT INTO tasks (id, company_id, title, task_type, priority, due_date, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())`,
        [companyId, t.title, t.type, t.prio, t.due || null]
      );
    }
  }

  // Contracts (Müller GmbH)
  const c2contracts = await pool.query(`SELECT COUNT(*) FROM contracts WHERE company_id = $1`, [company2Id]);
  if (parseInt(c2contracts.rows[0].count) === 0) {
    await pool.query(
      `INSERT INTO contracts (id, company_id, name, contract_type, counterparty, start_date, monthly_amount, frequency, debit_account, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'Werkstatt Miete', 'rent', 'Immobilien Bern AG', '2023-07-01', 1800, 'monthly', '6000', NOW(), NOW())`,
      [company2Id]
    );
    await pool.query(
      `INSERT INTO contracts (id, company_id, name, contract_type, counterparty, start_date, monthly_amount, frequency, debit_account, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'Telefonanlage', 'telecom', 'Sunrise', '2025-01-01', 65, 'monthly', '6200', NOW(), NOW())`,
      [company2Id]
    );
  }

  // Asset (Müller GmbH)
  const c2assets = await pool.query(`SELECT COUNT(*) FROM assets WHERE company_id = $1`, [company2Id]);
  if (parseInt(c2assets.rows[0].count) === 0) {
    await pool.query(
      `INSERT INTO assets (id, company_id, name, category, acquisition_date, acquisition_cost, residual_value, useful_life_months, asset_account, depreciation_account, license_plate, private_use_percent, book_value, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'Lieferwagen VW Caddy', 'vehicles', '2023-09-01', 28000, 8000, 60, '1530', '6810', 'BE 987654', 20, 28000, NOW(), NOW())`,
      [company2Id]
    );
  }

  // Expected Documents (Demo AG)
  const expDocCount = await pool.query(`SELECT COUNT(*) FROM expected_documents WHERE company_id = $1`, [companyId]);
  if (parseInt(expDocCount.rows[0].count) === 0) {
    for (const ed of [
      { name: "Swisscom-Rechnung", party: "Swisscom", freq: "monthly", amount: 89.00 },
      { name: "Mietrechnung Büro", party: "Vermieter", freq: "monthly", amount: 2500.00 },
      { name: "Microsoft 365", party: "Microsoft", freq: "monthly", amount: 45.00 },
      { name: "Gebäudeversicherung", party: "Versicherung", freq: "quarterly", amount: 375.00 },
      { name: "Leasingrate Tesla", party: "Leasing", freq: "monthly", amount: 450.00 },
    ]) {
      await pool.query(
        `INSERT INTO expected_documents (id, company_id, name, counterparty, frequency, expected_amount, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())`,
        [companyId, ed.name, ed.party, ed.freq, ed.amount]
      );
    }
  }

  console.log("Seed complete: 2 companies, 3 users, 3 user-company links, 5 suppliers, 3 rules, 5 contracts, 4 assets, 5 recurring, 3 escalation rules, 3 knowledge items, 5 tasks, 5 expected documents");
}

main()
  .catch(console.error)
  .finally(() => pool.end());
