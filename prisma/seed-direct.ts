import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;

async function main() {
  const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  const client = await pool.connect();

  try {
    const companyId = "00000000-0000-0000-0000-000000000001";

    // Upsert company
    await client.query(
      `INSERT INTO companies (id, name, legal_name, vat_number, currency, address, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [
        companyId,
        "BelegPilot Demo",
        "BelegPilot Demo GmbH",
        "CHE-123.456.789",
        "CHF",
        JSON.stringify({
          street: "Bahnhofstrasse 1",
          zip: "8001",
          city: "Zürich",
          country: "CH",
        }),
      ]
    );

    // Hash passwords
    const adminHash = await bcrypt.hash("admin123", 12);
    const reviewerHash = await bcrypt.hash("reviewer123", 12);

    // Upsert admin user
    await client.query(
      `INSERT INTO users (id, company_id, email, name, password_hash, role, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (email) DO NOTHING`,
      [companyId, "admin@belegpilot.ch", "Admin", adminHash, "admin"]
    );

    // Upsert reviewer user
    await client.query(
      `INSERT INTO users (id, company_id, email, name, password_hash, role, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (email) DO NOTHING`,
      [companyId, "reviewer@belegpilot.ch", "Reviewer", reviewerHash, "reviewer"]
    );

    console.log("Seed complete: company + 2 users created");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
