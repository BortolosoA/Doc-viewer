import { useState, useRef, useEffect } from "react";
import { Upload, MoreHorizontal, X } from "lucide-react";
import { api } from "./api";

function getTagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 35%)`;
}

function Sidebar({
  pages,
  activePage,
  onSelect,
  onDeleted,
  onOpenUploadModal,
  onEditTags,
}) {
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  const allTags = Array.from(new Set(pages.flatMap((p) => p.tags || [])));

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
    const matchesTag = selectedTag ? (page.tags || []).includes(selectedTag) : true;
    const matchesSearch =
      !search || page.title.toLowerCase().includes(search.toLowerCase());
    return matchesTag && matchesSearch;
  });

  async function handleDelete(page, e) {
    e.stopPropagation();
    if (page.source !== "remote") return;
    if (!confirm(`Excluir "${page.title}"? Esta ação não pode ser desfeita.`)) return;
    setBusyId(page.id);
    try {
      await api.deleteDocument(page.name);
      onDeleted?.(page.name);
    } catch (err) {
      // ignore
    } finally {
      setBusyId(null);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-actions">
        <button
          type="button"
          className="upload-btn"
          onClick={onOpenUploadModal}
          title="Enviar documento (.md)"
        >
          <Upload size={16} aria-hidden="true" />
          Enviar .md
        </button>
      </div>

      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Buscar por nome ou tag..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="tags-row">
        <span
          className={"chip" + (selectedTag === null ? " selected" : "")}
          style={{ background: "var(--code-bg)", color: "var(--text-muted)" }}
          onClick={() => setSelectedTag(null)}
        >
          todos
        </span>
        {allTags.map((tag) => (
          <span
            key={tag}
            className={"chip" + (selectedTag === tag ? " selected" : "")}
            style={{ backgroundColor: getTagColor(tag) }}
            onClick={() => setSelectedTag(tag)}
          >
            {tag}
          </span>
        ))}
      </div>

      <nav aria-label="Páginas da documentação">
        <ul className="sidebar-list">
          {filteredPages.map((page) => {
            const isMenuOpen = openMenuId === page.id;

            return (
              <li key={page.id} className="sidebar-item">
                <button
                  type="button"
                  className={`sidebar-link ${activePage === page.id ? "active" : ""}`}
                  onClick={() => {
                    setOpenMenuId(null);
                    onSelect(page.id);
                  }}
                  aria-current={activePage === page.id ? "page" : undefined}
                >
                  <span className="sidebar-link-title">{page.title}</span>
                  <span className="tag-dots">
                    {(page.tags || []).map((tag) => (
                      <span
                        key={tag}
                        className="tag-dot"
                        style={{ backgroundColor: getTagColor(tag) }}
                        title={tag}
                      />
                    ))}
                  </span>
                  
                  {page.source === "remote" && (
                    <span
                      className="menu-wrapper"
                      ref={isMenuOpen ? menuRef : null}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="menu-trigger"
                        aria-label={`Ações para ${page.title}`}
                        title="Ações"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(isMenuOpen ? null : page.id);
                        }}
                      >
                        <MoreHorizontal size={16} aria-hidden="true" />
                      </button>
                      {isMenuOpen && (
                        <div className="menu-dropdown" role="menu">
                          <button
                            type="button"
                            className="menu-item"
                            role="menuitem"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                              onEditTags?.(page);
                            }}
                          >
                            Editar tags
                          </button>
                          <div className="menu-divider" />
                          <button
                            type="button"
                            className="menu-item menu-item--remove"
                            role="menuitem"
                            onClick={(e) => {
                              setOpenMenuId(null);
                              handleDelete(page, e);
                            }}
                          >
                            Remover
                          </button>
                        </div>
                      )}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;