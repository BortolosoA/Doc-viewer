import { useRef, useState } from "react";
import { Upload, Trash2 } from "lucide-react";
import { api } from "./api";

function Sidebar({ pages, activePage, onSelect, onUploaded, onDeleted }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [status, setStatus] = useState(null); // { type, msg }

  // Upload de documento. Aceita qualquer arquivo, mas tem suporte especial
  // para .md (Markdown) — o backend normaliza o mime para text/markdown.
  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-enviar o mesmo arquivo
    if (!file) return;

    setUploading(true);
    setStatus(null);
    try {
      const doc = await api.uploadDocument(file);
      setStatus({ type: "ok", msg: `Enviado: ${doc.original_name}` });
      onUploaded?.(doc);
    } catch (err) {
      setStatus({ type: "err", msg: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(page, e) {
    e.stopPropagation();
    if (page.source !== "remote") {
      setStatus({ type: "err", msg: "Documentos estáticos não podem ser removidos daqui." });
      return;
    }
    if (!confirm(`Excluir "${page.title}"? Esta ação não pode ser desfeita.`)) return;
    setBusyId(page.id);
    setStatus(null);
    try {
      await api.deleteDocument(page.name);
      setStatus({ type: "ok", msg: `Excluído: ${page.title}` });
      onDeleted?.(page.name);
    } catch (err) {
      setStatus({ type: "err", msg: err.message });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown,text/markdown"
          onChange={handleUpload}
          style={{ display: "none" }}
        />
        <button
          type="button"
          className="upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Enviar documento (.md)"
        >
          <Upload size={16} aria-hidden="true" />
          {uploading ? "Enviando…" : "Enviar .md"}
        </button>
      </div>

      {status && (
        <p className={`sidebar-status ${status.type}`}>
          {status.msg}
        </p>
      )}

      <nav aria-label="Páginas da documentação">
        <ul className="sidebar-list">
          {pages.map((page) => (
            <li key={page.id} className="sidebar-item">
              <button
                type="button"
                className={`sidebar-link ${activePage === page.id ? "active" : ""}`}
                onClick={() => onSelect(page.id)}
                aria-current={activePage === page.id ? "page" : undefined}
              >
                <span className="sidebar-link-title">{page.title}</span>
                {page.source === "remote" && (
                  <span
                    className="sidebar-badge"
                    title="Documento remoto (MinIO)"
                  >
                    remoto
                  </span>
                )}
              </button>
              {page.source === "remote" && (
                <button
                  type="button"
                  className="delete-btn"
                  onClick={(e) => handleDelete(page, e)}
                  disabled={busyId === page.id}
                  aria-label={`Excluir ${page.title}`}
                  title="Excluir documento"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;
