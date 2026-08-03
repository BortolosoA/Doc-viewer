import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import "./App.css";
import Sidebar from "./Sidebar";
import DocView from "./DocView";

import introMd from "./docs/intro.md?raw";
import installMd from "./docs/install.md?raw";
import configMd from "./docs/config.md?raw";

const pages = [
  { id: "intro", title: "Introdução", content: introMd },
  { id: "install", title: "Instalação", content: installMd },
  { id: "config", title: "Configuração", content: configMd },
];

function App() {
  const [activePage, setActivePage] = useState(pages[0].id);
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
