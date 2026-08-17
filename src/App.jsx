import { useState, useEffect, useCallback } from "react";
import { BookOpen } from "lucide-react";
import "./App.css";
import Sidebar from "./Sidebar";
import DocView from "./DocView";
import { api } from "./api";

// Importa todos os .md de ./docs automaticamente (eager = já vem pronto, sem await).
// Usados como fallback quando a API não está disponível (ex.: npm run dev puro).
const docModules = import.meta.glob("./docs/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

// Extrai um título legível a partir do primeiro "# ..." do markdown.
// Se não achar (arquivo vazio/sem H1), cai pro nome do arquivo.
function extractTitle(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (!match) return fallback;
  return match[1]
    .replace(/<[^>]+>/g, "") // remove tags tipo <center>
    .replace(/\*\*/g, "") // remove **negrito**
    .trim();
}

// Páginas estáticas (bundled) — fallback offline/dev sem backend.
const staticPages = Object.entries(docModules)
  .map(([path, content]) => {
    const id = path.split("/").pop().replace(/\.md$/, "");
    const fallbackTitle = id.replace(/[-_]/g, " ");
    return {
      id,
      title: extractTitle(content, fallbackTitle),
      content,
      source: "static",
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));

function App() {
  const [pages, setPages] = useState(staticPages);
  const [activePage, setActivePage] = useState(staticPages[0]?.id ?? null);
  const [activeContent, setActiveContent] = useState(
    staticPages[0]?.content ?? "",
  );
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [error, setError] = useState(null);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") || "system";
    }
    return "system";
  });

  // Carrega a lista de documentos da API (mescla com estáticos).
  const refreshDocuments = useCallback(async () => {
    try {
      const docs = await api.listDocuments();
      const remote = docs.map((d) => ({
        id: d.name.replace(/\.md$/, ""),
        title: d.original_name.replace(/\.md$/i, "").replace(/[-_]/g, " "),
        name: d.name,
        mime_type: d.mime_type,
        size_bytes: d.size_bytes,
        created_at: d.created_at,
        source: "remote",
        content: null, // carregado sob demanda
      }));
      // Remotos têm prioridade; estáticos só entram se não houver remoto com mesmo id.
      const remoteIds = new Set(remote.map((r) => r.id));
      const merged = [
        ...remote,
        ...staticPages.filter((p) => !remoteIds.has(p.id)),
      ].sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
      setPages(merged);
      setError(null);
      return merged;
    } catch (err) {
      // API indisponível — mantém só os estáticos.
      setError(err.message);
      setPages(staticPages);
      return staticPages;
    }
  }, []);

  useEffect(() => {
    refreshDocuments();
  }, [refreshDocuments]);

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const isDark = theme === "dark" || (theme === "system" && systemDark);

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    localStorage.setItem("theme", theme);
  }, [theme]);

  // Carrega o conteúdo do documento ativo (remotos sob demanda).
  useEffect(() => {
    const activeDoc = pages.find((p) => p.id === activePage);
    if (!activeDoc) {
      setActiveContent("");
      return;
    }
    if (activeDoc.source === "static" || activeDoc.content != null) {
      setActiveContent(activeDoc.content ?? "");
      return;
    }
    // Remoto: busca o conteúdo bruto.
    let cancelled = false;
    setLoadingDoc(true);
    api
      .getDocumentRaw(activeDoc.name)
      .then((text) => {
        if (cancelled) return;
        activeDoc.content = text;
        setActiveContent(text);
      })
      .catch((err) => {
        if (cancelled) return;
        setActiveContent(`# Erro\n\nNão foi possível carregar o documento: ${err.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingDoc(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activePage, pages]);

  const handleUploaded = useCallback(
    async (doc) => {
      const merged = await refreshDocuments();
      // Seleciona o documento recém-enviado.
      const target = merged.find((p) => p.id === doc.name.replace(/\.md$/, ""));
      if (target) setActivePage(target.id);
    },
    [refreshDocuments],
  );

  const handleDeleted = useCallback(
    async (deletedName) => {
      const merged = await refreshDocuments();
      if (deletedName.replace(/\.md$/, "") === activePage) {
        setActivePage(merged[0]?.id ?? null);
      }
    },
    [refreshDocuments, activePage],
  );

  const activeDoc = pages.find((p) => p.id === activePage) || pages[0];

  if (!activeDoc) {
    return (
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <BookOpen className="logo-icon" aria-hidden="true" />
            <span className="brand-title">Docs</span>
          </div>
        </header>
        <main className="content">
          <p>Nenhum documento encontrado em <code>src/docs</code>.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <BookOpen className="logo-icon" aria-hidden="true" />
          <span className="brand-title">Docs</span>
        </div>
        <button
          type="button"
          className="theme-toggle"
          onClick={() =>
            setTheme((t) =>
              t === "light" ? "dark" : t === "dark" ? "system" : "light",
            )
          }
          aria-label="Alternar tema"
          title="Alternar tema"
        >
          {theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "🖥️"}
        </button>
      </header>
      <div className="layout">
        <Sidebar
          pages={pages}
          activePage={activePage}
          onSelect={setActivePage}
          onUploaded={handleUploaded}
          onDeleted={handleDeleted}
        />
        <main className="content">
          {loadingDoc ? (
            <p className="muted">Carregando documento…</p>
          ) : (
            <DocView content={activeContent} />
          )}
          {error && (
            <p className="muted">
              API indisponível ({error}). Mostrando documentos estáticos.
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
