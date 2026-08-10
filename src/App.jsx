import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import "./App.css";
import Sidebar from "./Sidebar";
import DocView from "./DocView";

// Importa todos os .md de ./docs automaticamente (eager = já vem pronto, sem await).
// Adicionar ou remover um arquivo .md nessa pasta não exige tocar em mais nada aqui.
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

const pages = Object.entries(docModules)
  .map(([path, content]) => {
    const id = path.split("/").pop().replace(/\.md$/, "");
    const fallbackTitle = id.replace(/[-_]/g, " ");
    return {
      id,
      title: extractTitle(content, fallbackTitle),
      content,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));

function App() {
  const [activePage, setActivePage] = useState(pages[0]?.id ?? null);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") || "system";
    }
    return "system";
  });

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
        />
        <main className="content">
          <DocView content={activeDoc.content} />
        </main>
      </div>
    </div>
  );
}

export default App;
