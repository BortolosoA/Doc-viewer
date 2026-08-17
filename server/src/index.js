import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { pool, initSchema } from "./db.js";
import {
  ensureBucket,
  putObject,
  getObjectBuffer,
  deleteObject,
  BUCKET,
} from "./storage.js";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

// ---------- Health ----------
app.get("/health", (_req, res) => res.json({ ok: true }));

// ---------- Users (cadastros) ----------
app.get("/users", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, username, email, created_at FROM users ORDER BY id",
  );
  res.json(rows);
});

app.post("/users", async (req, res) => {
  const { username, email } = req.body || {};
  if (!username) return res.status(400).json({ error: "username é obrigatório" });
  try {
    const { rows } = await pool.query(
      "INSERT INTO users (username, email) VALUES ($1, $2) RETURNING id, username, email, created_at",
      [username, email || null],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "username ou email já existe" });
    res.status(500).json({ error: err.message });
  }
});

// ---------- Documents ----------
// Lista todos os documentos (metadados)
app.get("/documents", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, original_name, mime_type, size_bytes, created_at
     FROM documents ORDER BY created_at DESC`,
  );
  res.json(rows);
});

// Retorna o conteúdo bruto de um documento (markdown)
app.get("/documents/:name/raw", async (req, res) => {
  const { name } = req.params;
  const { rows } = await pool.query(
    "SELECT storage_key, mime_type FROM documents WHERE name = $1",
    [name],
  );
  if (rows.length === 0) return res.status(404).json({ error: "não encontrado" });
  try {
    const buf = await getObjectBuffer(rows[0].storage_key);
    res.setHeader("Content-Type", rows[0].mime_type);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload de documento (suporte especial para .md)
app.post("/documents", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "arquivo é obrigatório (campo 'file')" });

  const original = req.file.originalname;
  const ext = (original.split(".").pop() || "").toLowerCase();

  // Suporte específico para .md — valida e normaliza mime
  const isMarkdown = ext === "md" || ext === "markdown";
  const mime = isMarkdown ? "text/markdown" : (req.file.mimetype || "application/octet-stream");

  // Nome único baseado no original (sem extensão)
  const base = original.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
  const name = `${base}.${ext || "bin"}`;
  const storageKey = `${name}`;

  try {
    await putObject(storageKey, req.file.buffer, mime);
    const { rows } = await pool.query(
      `INSERT INTO documents (name, original_name, mime_type, size_bytes, storage_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO UPDATE
         SET original_name = EXCLUDED.original_name,
             mime_type = EXCLUDED.mime_type,
             size_bytes = EXCLUDED.size_bytes,
             storage_key = EXCLUDED.storage_key,
             created_at = NOW()
       RETURNING id, name, original_name, mime_type, size_bytes, created_at`,
      [name, original, mime, req.file.size, storageKey],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete de documento
app.delete("/documents/:name", async (req, res) => {
  const { name } = req.params;
  const { rows } = await pool.query(
    "SELECT storage_key FROM documents WHERE name = $1",
    [name],
  );
  if (rows.length === 0) return res.status(404).json({ error: "não encontrado" });
  try {
    await deleteObject(rows[0].storage_key);
    await pool.query("DELETE FROM documents WHERE name = $1", [name]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Bootstrap ----------
const PORT = Number(process.env.PORT || 3001);

async function start() {
  // Aguarda DB e MinIO ficarem prontos (retry simples)
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query("SELECT 1");
      await ensureBucket();
      await initSchema();
      break;
    } catch (err) {
      console.log(`[boot] aguardando dependências... (${i + 1}/30)`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  app.listen(PORT, () => console.log(`API ouvindo em :${PORT} (bucket=${BUCKET})`));
}

start();
