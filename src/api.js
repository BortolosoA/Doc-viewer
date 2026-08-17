// Helper para chamadas à API backend.
// A URL base pode ser definida via VITE_API_URL (injetada no build pelo Vite).
const API_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  "http://localhost:3001";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Lista metadados dos documentos
  async listDocuments() {
    return request("/documents");
  },

  // Baixa o conteúdo bruto de um documento (markdown)
  async getDocumentRaw(name) {
    const res = await fetch(`${API_URL}/documents/${encodeURIComponent(name)}/raw`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  },

  // Faz upload de um arquivo (FormData). Suporte especial para .md.
  async uploadDocument(file) {
    const fd = new FormData();
    fd.append("file", file);
    return request("/documents", { method: "POST", body: fd });
  },

  // Deleta um documento pelo nome
  async deleteDocument(name) {
    return request(`/documents/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  },
};

export { API_URL };
