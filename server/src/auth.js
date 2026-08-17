import crypto from "crypto";
import { pool } from "./db.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM = process.env.RESEND_FROM || "onboarding@resend.dev";
const APP_URL = process.env.APP_URL || "http://localhost:5173";

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function createUser(username, email, password) {
  const passwordHash = await hashPassword(password);
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, email_verified`,
      [username, email, passwordHash],
    );
    await client.query(
      `INSERT INTO email_verifications (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [rows[0].id, token, expiresAt],
    );
    await client.query("COMMIT");
    return { user: rows[0], token };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function loginUser(email, password) {
  const passwordHash = await hashPassword(password);
  const { rows } = await pool.query(
    "SELECT id, username, email, email_verified, role FROM users WHERE email = $1 AND password_hash = $2",
    [email, passwordHash],
  );
  if (rows.length === 0) return null;
  console.log(`[loginUser] user found:`, JSON.stringify(rows[0]));
  return rows[0];
}

export async function verifyEmailToken(token) {
  const { rows } = await pool.query(
    `SELECT ev.user_id
     FROM email_verifications ev
     WHERE ev.token = $1 AND ev.expires_at > NOW()`,
    [token],
  );
  if (rows.length === 0) return null;
  const userId = rows[0].user_id;
  await pool.query("UPDATE users SET email_verified = TRUE WHERE id = $1", [userId]);
  await pool.query("DELETE FROM email_verifications WHERE user_id = $1", [userId]);
  const { rows: userRows } = await pool.query(
    "SELECT id, username, email, email_verified FROM users WHERE id = $1",
    [userId],
  );
  return userRows[0];
}

export async function resendVerificationEmail(email) {
  const { rows } = await pool.query(
    "SELECT id FROM users WHERE email = $1 AND email_verified = FALSE",
    [email],
  );
  if (rows.length === 0) return null;
  const userId = rows[0].id;
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await pool.query("DELETE FROM email_verifications WHERE user_id = $1", [userId]);
  await pool.query(
    `INSERT INTO email_verifications (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [userId, token, expiresAt],
  );
  return { userId, token };
}

export async function sendVerificationEmail(email, token) {
  if (!RESEND_API_KEY) {
    console.log(`[resend] SKIP – no API key. Verify URL: ${APP_URL}/verify-email?token=${token}`);
    return;
  }

  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: email,
        subject: "Confirme o seu cadastro",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#333">
            <h2 style="color:#4a3f3c">Confirme o seu e-mail</h2>
            <p>Obrigado por se cadastrar! Clique no botão abaixo para confirmar o seu e-mail:</p>
            <a href="${verifyUrl}"
               style="display:inline-block;padding:12px 24px;background:#d977a5;color:#fff;
                      text-decoration:none;border-radius:6px;font-weight:600;margin:16px 0">
              Confirmar e-mail
            </a>
            <p style="color:#888;font-size:13px">
              Se não foi você quem se cadastrou, ignore este e-mail.
            </p>
          </div>
        `,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[resend] HTTP ${res.status}: ${errBody}`);
    } else {
      console.log(`[resend] verification email sent to ${email}`);
    }
  } catch (err) {
    console.error("[resend] failed to send:", err.message);
  }
}