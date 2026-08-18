// Helper to call backend API.
// Production  : relies on /api prefix — nginx proxies to the backend.
// Development : APP_URL can override (used by Vite dev server proxy).
const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.APP_URL) || "/api";

let _authToken = localStorage.getItem("docs_session_token") || "";

export function getAuthToken() {
  return _authToken;
}

export function setAuthToken(token) {
  _authToken = token;
  if (token) localStorage.setItem("docs_session_token", token);
  else localStorage.removeItem("docs_session_token");
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    ...(options.headers || {}),
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
  };
  if (_authToken) headers["Authorization"] = `Bearer ${_authToken}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  let body;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok) {
    const msg = typeof body === "object" && body?.error
      ? body.error
      : typeof body === "string" && body.trim()
        ? body.trim()
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  if (res.status === 204) return null;
  return typeof body === "object" ? body : null;
}

export const api = {
  async listDocuments() {
    return request("/documents");
  },

  async getDocumentRaw(name) {
    const headers = {};
    if (_authToken) headers["Authorization"] = `Bearer ${_authToken}`;
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(name)}/raw`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  },

  async uploadDocument(file, tags = []) {
    const fd = new FormData();
    fd.append("file", file);
    if (tags.length) fd.append("tags", JSON.stringify(tags));
    return request("/documents", { method: "POST", body: fd });
  },

  async deleteDocument(name) {
    return request(`/documents/${encodeURIComponent(name)}`, { method: "DELETE" });
  },

  async updateDocumentTags(name, tags = []) {
    return request(`/documents/${encodeURIComponent(name)}/tags`, {
      method: "PUT",
      body: JSON.stringify({ tags }),
    });
  },

  async register(username, email, password) {
    return request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });
  },

  async login(email, password) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async verifyEmail(token) {
    return request("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },

  async resendVerification(email) {
    return request("/auth/resend", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async adminResendVerification(email, sendEmail) {
    return request("/admin/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email, sendEmail }),
    });
  },

  async changePassword(currentPassword, newPassword) {
    return request("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async getMe() {
    return request("/auth/me");
  },

  async logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setAuthToken("");
  },

  // --- Admin ---
  async listUsers() {
    return request("/admin/users");
  },

  async createUser(data) {
    return request("/admin/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async deleteUser(id) {
    return request(`/admin/users/${id}`, { method: "DELETE" });
  },
};