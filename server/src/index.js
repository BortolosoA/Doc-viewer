import "dotenv/config";
import jwt from "jsonwebtoken";
import express from "express";
import cors from "cors";
import multer from "multer";
import {
  createUser,
  loginUser,
  verifyEmailToken,
  resendVerificationEmail,
  generateVerificationLink,
  sendVerificationEmail,
  changePassword,
} from "./auth.js";
import { pool, initSchema, seedAdmin } from "./db.js";
import {
  ensureBucket,
  putObject,
  getObjectBuffer,
  deleteObject,
  BUCKET,
} from "./storage.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

const app = express();

// CORS must be the FIRST middleware so OPTIONS preflight is always answered
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "10mb" }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// JWT helpers
function signToken(user, expiresIn = "7d") {
  return jwt.sign(
    { sub: user.id, username: user.username, email: user.email, email_verified: user.email_verified, role: user.role },
    JWT_SECRET,
    { expiresIn }
  );
}

function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) return res.status(401).json({ error: "não autenticado" });
  const payload = verifyToken(match[1]);
  if (!payload) return res.status(401).json({ error: "token inválido ou expirado" });
  req.user = { userId: payload.sub, username: payload.username, email: payload.email, emailVerified: payload.email_verified, role: payload.role || "user" };
  next();
}

function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "acesso negado — apenas administradores" });
  next();
}

// ---------- Health ----------
app.get("/health", (_req, res) => res.json({ ok: true }));

// Helper: strip sensitive fields from DB row before sending to client
function publicUser(row) {
  return { id: row.id, username: row.username, email: row.email, emailVerified: row.email_verified, role: row.role || "user", created_at: row.created_at };
}

// ---------- Auth ----------
app.post("/auth/register", async (req, res) => {
  const { username, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email e senha são obrigatórios" });
  if (password.length < 6) return res.status(400).json({ error: "senha deve ter ao menos 6 caracteres" });
  try {
    const result = await createUser(username || null, email, password);
    const verifyUrl = `${process.env.APP_URL || "http://localhost:5173"}/verify-email?token=${result.token}`;
    await sendVerificationEmail(email, result.token);
    const token = signToken(result.user, "7d");
    res.status(201).json({
      user: publicUser(result.user),
      sessionId: token,
      verifyUrl,
    });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "email já cadastrado" });
    res.status(500).json({ error: err.message });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email e senha são obrigatórios" });
  const user = await loginUser(email, password);
  if (!user) return res.status(401).json({ error: "credenciais inválidas" });
  const token = signToken(user, "7d");
  res.json({ user: publicUser(user), sessionId: token });
});

app.post("/auth/verify-email", async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: "token é obrigatório" });
  const user = await verifyEmailToken(token);
  if (!user) return res.status(400).json({ error: "token inválido ou expirado" });
  const sessionToken = signToken(user, "7d");
  res.json({ user: publicUser(user), sessionId: sessionToken });
});

app.post("/auth/resend", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email é obrigatório" });
  const result = await resendVerificationEmail(email);
  if (!result) {
    return res.json({ ok: false, error: "Não foi possível enviar e-mail de verificação" });
  }
  const verifyUrl = `${process.env.APP_URL || "http://localhost:5173"}/verify-email?token=${encodeURIComponent(result.token)}`;
  await sendVerificationEmail(email, result.token);
  res.json({ ok: true, verifyUrl, sendEmail: true });
});

app.post("/auth/change-password", authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Senha atual e nova senha são obrigatórias" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "A nova senha deve ter ao menos 6 caracteres" });
  }
  const user = await loginUser(req.user.email, currentPassword);
  if (!user) {
    return res.status(401).json({ error: "Senha atual está incorreta" });
  }
  const updated = await changePassword(req.user.userId, newPassword);
  if (updated) {
    res.json({ ok: true, message: "Senha alterada com sucesso" });
  } else {
    res.status(500).json({ error: "Erro ao alterar senha" });
  }
});

app.post("/admin/resend-verification", authMiddleware, adminOnly, async (req, res) => {
  const { email, sendEmail } = req.body || {};
  if (!email) return res.status(400).json({ error: "email é obrigatório" });
  
  if (sendEmail) {
    const result = await resendVerificationEmail(email);
    if (!result) {
      return res.json({ ok: false, error: "Não foi possível enviar e-mail de verificação" });
    }
    await sendVerificationEmail(email, result.token);
    res.json({ ok: true, verifyUrl: result.verifyUrl, sent: true });
  } else {
    const result = await generateVerificationLink(email);
    if (!result) {
      if (result?.verified) {
        return res.json({ ok: true, verified: true, message: "Email já verificado" });
      }
      return res.json({ ok: false, error: "Usuário não encontrado ou já verificado" });
    }
    res.json({ ok: true, verifyUrl: result.verifyUrl, sent: false });
  }
});

app.get("/auth/me", authMiddleware, (req, res) => {
  const userPayload = { id: req.user.userId, username: req.user.username, email: req.user.email, emailVerified: req.user.emailVerified, role: req.user.role };
  console.log("[auth/me] returning:", JSON.stringify(userPayload));
  res.json({ user: userPayload });
});

app.post("/auth/logout", authMiddleware, (_req, res) => {
  res.json({ ok: true });
});

// ---------- Admin (role-based) ----------
app.get("/admin/users", authMiddleware, adminOnly, async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, username, email, email_verified, role, created_at FROM users ORDER BY id",
  );
  res.json(rows.map(publicUser));
});

app.post("/admin/users", authMiddleware, adminOnly, async (req, res) => {
  const { username, email, password, role } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email e senha são obrigatórios" });
  if (password.length < 6) return res.status(400).json({ error: "senha deve ter ao menos 6 caracteres" });
  try {
    const result = await createUser(username || null, email, password);
    // Promote to admin if requested by another admin
    if (role === "admin") {
      await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [result.user.id]);
      const { rows } = await pool.query("SELECT id, username, email, email_verified, role, created_at FROM users WHERE id = $1", [result.user.id]);
      return res.status(201).json(publicUser(rows[0]));
    }
    res.status(201).json(publicUser(result.user));
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "email já cadastrado" });
    res.status(500).json({ error: err.message });
  }
});

app.delete("/admin/users/:id", authMiddleware, adminOnly, async (req, res) => {
  const { id } = req.params;
  // Prevent self-deletion
  if (parseInt(id) === req.user.userId) return res.status(400).json({ error: "não pode remover a si mesmo" });
  await pool.query("DELETE FROM users WHERE id = $1", [id]);
  res.status(204).end();
});

// ---------- Users (legacy listing - protected) ----------
app.get("/users", authMiddleware, async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT id, username, email, created_at FROM users ORDER BY id",
  );
  res.json(rows);
});

// ---------- Documents (protected - requires verified email) ----------
app.get("/documents", authMiddleware, async (req, res) => {
  if (!req.user.emailVerified) return res.status(403).json({ error: "verifique o seu e-mail para acessar os documentos" });
  const { rows } = await pool.query(`
    SELECT
      d.id, d.name, d.original_name, d.mime_type, d.size_bytes, d.created_at,
      COALESCE(array_agg(t.name) FILTER (WHERE t.name IS NOT NULL), ARRAY[]::text[]) AS tags
    FROM documents d
    LEFT JOIN document_tags dt ON dt.document_id = d.id
    LEFT JOIN tags t ON t.id = dt.tag_id
    GROUP BY d.id
    ORDER BY d.created_at DESC
  `);
  res.json(rows);
});

app.get("/documents/:name/raw", authMiddleware, async (req, res) => {
  if (!req.user.emailVerified) return res.status(403).json({ error: "verifique o seu e-mail para acessar os documentos" });
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

app.post("/documents", authMiddleware, upload.single("file"), async (req, res) => {
  if (!req.user.emailVerified) return res.status(403).json({ error: "verifique o seu e-mail para enviar documentos" });
  if (!req.file) return res.status(400).json({ error: "arquivo é obrigatório (campo 'file')" });

  const original = req.file.originalname;
  const ext = (original.split(".").pop() || "").toLowerCase();
  const isMarkdown = ext === "md" || ext === "markdown";
  const mime = isMarkdown ? "text/markdown" : (req.file.mimetype || "application/octet-stream");

  const base = original.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-_]+/g, "-");
  const name = `${base}.${ext || "bin"}`;
  const storageKey = `${name}`;

  let tags = [];
  if (req.body.tags) {
    try { tags = JSON.parse(req.body.tags); } catch { tags = []; }
  }

  try {
    await putObject(storageKey, req.file.buffer, mime);
    const { rows } = await pool.query(
      `INSERT INTO documents (name, original_name, mime_type, size_bytes, storage_key, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name) DO UPDATE
         SET original_name = EXCLUDED.original_name,
             mime_type = EXCLUDED.mime_type,
             size_bytes = EXCLUDED.size_bytes,
             storage_key = EXCLUDED.storage_key,
             created_at = NOW()
       RETURNING id, name, original_name, mime_type, size_bytes, created_at`,
      [name, original, mime, req.file.size, storageKey, req.user.userId],
    );

    const docId = rows[0].id;
    await pool.query("DELETE FROM document_tags WHERE document_id = $1", [docId]);

    if (tags.length > 0) {
      for (const tag of tags) {
        await pool.query(`INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [tag]);
      }
      const tagRows = await pool.query("SELECT id FROM tags WHERE name = ANY($1::text[])", [tags]);
      const tagIds = tagRows.rows.map((r) => r.id);
      if (tagIds.length > 0) {
        const values = tagIds.map((tid) => `(${docId}, ${tid})`).join(", ");
        await pool.query(`INSERT INTO document_tags (document_id, tag_id) VALUES ${values}`);
      }
    }
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/documents/:name", authMiddleware, async (req, res) => {
  if (!req.user.emailVerified) return res.status(403).json({ error: "verifique o seu e-mail para excluir documentos" });
  const { name } = req.params;
  const { rows } = await pool.query("SELECT storage_key, id FROM documents WHERE name = $1", [name]);
  if (rows.length === 0) return res.status(404).json({ error: "não encontrado" });
  try {
    await deleteObject(rows[0].storage_key);
    await pool.query("DELETE FROM documents WHERE name = $1", [name]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/documents/:name/tags", authMiddleware, async (req, res) => {
  if (!req.user.emailVerified) return res.status(403).json({ error: "verifique o seu e-mail para editar tags" });
  const { name } = req.params;
  const tags = Array.isArray(req.body?.tags) ? req.body.tags : [];
  const { rows } = await pool.query("SELECT id FROM documents WHERE name = $1", [name]);
  if (rows.length === 0) return res.status(404).json({ error: "não encontrado" });
  const docId = rows[0].id;
  await pool.query("DELETE FROM document_tags WHERE document_id = $1", [docId]);
  for (const tag of tags) {
    await pool.query(`INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [tag]);
  }
  if (tags.length > 0) {
    const tagRows = await pool.query("SELECT id FROM tags WHERE name = ANY($1::text[])", [tags]);
    const tagIds = tagRows.rows.map((r) => r.id);
    const values = tagIds.map((tid) => `(${docId}, ${tid})`).join(", ");
    await pool.query(`INSERT INTO document_tags (document_id, tag_id) VALUES ${values}`);
  }
  res.status(204).end();
});

// ---------- Env validation ----------
function validateEnv() {
  const errors = [];
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const JWT_SECRET = process.env.JWT_SECRET;
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!ADMIN_EMAIL || !ADMIN_EMAIL.includes("@")) {
    errors.push("ADMIN_EMAIL must be a valid e-mail (or unset to use default)");
  }
  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 6) {
    errors.push("ADMIN_PASSWORD must be at least 6 characters (or unset to use default)");
  }
  if (!JWT_SECRET || JWT_SECRET.length < 16) {
    errors.push("JWT_SECRET must be at least 16 characters (or unset to use a dev default)");
  }
  if (!DATABASE_URL) {
    errors.push("DATABASE_URL is not set (or unset to use default)");
  }
  if (errors.length) {
    console.warn("[env] configuration warnings:\n" + errors.map((e) => "  - " + e).join("\n"));
  } else {
    console.log("[env] configuration OK");
  }
}

// ---------- Bootstrap ----------
const PORT = Number(process.env.PORT || 3001);

async function start() {
  validateEnv();
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query("SELECT 1");
      await ensureBucket();
      await initSchema();
      await seedAdmin();
      break;
    } catch (err) {
      console.log(`[boot] aguardando dependências... (${i + 1}/30)`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  app.listen(PORT, () => console.log(`API ouvindo em :${PORT} (bucket=${BUCKET})`));
}

start();