import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgres://docs:docs@db:5432/docs",
});

export async function initSchema() {
  // Tabela de usuários (cadastro)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Tabela de documentos (metadados; o conteúdo fica no MinIO)
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

  // Tabela de tags (preparada para uso futuro)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tags (
      id SERIAL PRIMARY KEY,
      name VARCHAR(64) UNIQUE NOT NULL
    );
  `);

  // N:N entre documentos e tags
  await pool.query(`
    CREATE TABLE IF NOT EXISTS document_tags (
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (document_id, tag_id)
    );
  `);
}
