import { useState, useRef, useEffect } from "react";
import { MoreVertical, X, Pencil, Upload, Search } from "lucide-react";
import { api } from "./api";

function getTagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 35%)`;
}

function HomePage({ pages, onSelectPage, onDeleted, onOpenUploadModal, onUpdated }) {
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPages = pages.filter((page) => {
    const q = search.toLowerCase();
    return (
      !q ||
      page.title.toLowerCase().includes(q) ||
      (page.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  });

  async function handleDelete(page, e) {
    e.stopPropagation();
    if (page.source !== "remote") return;
    if (!confirm(`Excluir "${page.title}"?`)) return;
    try {
      await api.deleteDocument(page.name);
      onDeleted?.(page.id);
    } catch {
      // ignore
    }
  }

  function handleStartEdit(page, e) {
    e.stopPropagation();
    setOpenMenuId(null);
    setEditingId(page.id);
    setEditTitle(page.title);
    setEditTags((page.tags || []).join(", "));
  }

  async function handleSaveEdit(page, e) {
    e.stopPropagation();
    try {
      await api.updateDocumentTags(page.name, editTags.split(",").map((t) => t.trim()).filter(Boolean));
      await onUpdated?.();
    } catch {
      // ignore
    }
    setEditingId(null);
  }

  function handleCardClick(page) {
    if (editingId === page.id) return;
    onSelectPage(page.id);
  }

  return (
    <div className="homepage">
      <div className="homepage-sidebar">
        <div className="homepage-sidebar-section">
          <h3 className="homepage-sidebar-title">Documentos</h3>
          <button
            type="button"
            className="homepage-upload-btn"
            onClick={onOpenUploadModal}
          >
            <Upload size={16} />
            Enviar .md
          </button>
        </div>
      </div>

      <div className="homepage-main">
        <div className="homepage-search">
          <Search size={16} className="homepage-search-icon" />
          <input
            type="text"
            placeholder="Buscar por nome ou tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="homepage-search-input"
          />
        </div>

        <div className="card-grid">
          {filteredPages.map((page) => {
            const isMenuOpen = openMenuId === page.id;
            const isEditing = editingId === page.id;

            return (
              <div
                key={page.id}
                className={`doc-card ${isEditing ? "doc-card--editing" : ""}`}
                onClick={() => handleCardClick(page)}
              >
                <div className="doc-card-header">
                  <h3 className="doc-card-title">{page.title}</h3>
                  {page.source === "remote" && (
                    <span
                      className="card-menu-wrapper"
                      ref={isMenuOpen ? menuRef : null}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="card-menu-trigger"
                        aria-label="Ações"
                        title="Ações"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(isMenuOpen ? null : page.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {isMenuOpen && (
                        <div className="card-dropdown" role="menu">
                          <button
                            type="button"
                            className="card-menu-item"
                            role="menuitem"
                            onClick={(e) => handleStartEdit(page, e)}
                          >
                            <Pencil size={14} />
                            Editar tags
                          </button>
                          <div className="menu-divider" />
                          <button
                            type="button"
                            className="card-menu-item card-menu-item--remove"
                            role="menuitem"
                            onClick={(e) => handleDelete(page, e)}
                          >
                            <X size={14} />
                            Remover
                          </button>
                        </div>
                      )}
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <div className="doc-card-edit" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Título"
                      className="doc-card-edit-input"
                    />
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="Tags (vírgula separada)"
                      className="doc-card-edit-input"
                    />
                    <div className="doc-card-edit-actions">
                      <button type="button" className="btn-save" onClick={(e) => handleSaveEdit(page, e)}>
                        Salvar
                      </button>
                      <button type="button" className="btn-cancel" onClick={() => setEditingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="doc-card-tags">
                    {(page.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="doc-card-tag"
                        style={{ backgroundColor: getTagColor(tag) }}
                      >
                        {tag}
                      </span>
                    ))}
                    {(!page.tags || page.tags.length === 0) && (
                      <span className="doc-card-no-tags">Sem tags</span>
                    )}
                  </div>
                )}

                
              </div>
            );
          })}
          {filteredPages.length === 0 && (
            <p className="doc-card-empty">Nenhum documento encontrado.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default HomePage;