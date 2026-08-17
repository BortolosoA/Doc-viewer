import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://docs:docs@db:5432/docs",
});

export async function initSchema() {
  // Users with role-based access + email verification
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(64) UNIQUE,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL DEFAULT '',
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      role VARCHAR(16) NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Idempotent column additions for already-created tables
  try { await pool.query(`ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT ''`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE`); } catch {}
  try { await pool.query(`ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'user'`); } catch {}

  // Email verification tokens
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token VARCHAR(255) UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
  `);

  // Documents
  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(127) NOT NULL,
      size_bytes BIGINT NOT NULL,
      storage_key VARCHAR(512) NOT NULL,
      uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Tags
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      name VARCHAR(64) UNIQUE NOT NULL
    );
  `);

  // N:N between documents and tags
  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_tags (
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (document_id, tag_id)
    );
  `);
}

export async function seedAdmin() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@admin.com";
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin!123";
  const ADMIN_USERNAME = "admin";

  const { hashPassword } = await import("./auth.js");
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash, email_verified, role)
     VALUES ($1, $2, $3, TRUE, 'admin')
     ON CONFLICT (email) DO UPDATE
       SET email_verified = TRUE,
           role = 'admin',
           password_hash = EXCLUDED.password_hash
     RETURNING id, email, email_verified, role`,
    [ADMIN_USERNAME, ADMIN_EMAIL, passwordHash],
  );
  console.log(`[seedAdmin] admin user:`, JSON.stringify(result.rows[0]));
}