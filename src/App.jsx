import { useState, useEffect, useCallback } from "react";
import { BookOpen, ArrowLeft, ShieldAlert } from "lucide-react";
import { api, setAuthToken } from "./api";
import "./App.css";
import HomePage from "./HomePage";
import DocView from "./DocView";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import AdminPage from "./AdminPage";

function App() {
  const [pages, setPages] = useState([]);

  // Auth state
  const [user, setUser] = useState(null);         // null | { id, username, email, emailVerified }
  const [token, setToken] = useState(() => localStorage.getItem("docs_session_token") || "");
  const [authView, setAuthView] = useState("login"); // "login" | "register"
  const [authError, setAuthError] = useState("");

  // Restore session on mount
  useEffect(() => {
    if (!token) return;
    api.getMe()
      .then(({ user: u }) => setUser(u))
      .catch(() => {
        setAuthToken("");
        setToken("");
        setUser(null);
      });
  }, []);

  // View routing (only enabled after email is verified)
  const [currentView, setCurrentView] = useState("home");
  const [viewingDocId, setViewingDocId] = useState(null);
  const [viewingDocContent, setViewingDocContent] = useState("");
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [error, setError] = useState("");

  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("theme") || "system";
    return "system";
  });

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [newTags, setNewTags] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [editTags, setEditTags] = useState("");

  const refreshDocuments = useCallback(async () => {
    try {
      const docs = await api.listDocuments();
      const sorted = docs
        .map((d) => ({
          id: d.name.replace(/\.md$/, ""),
          title: d.original_name.replace(/\.md$/i, "").replace(/[-_]/g, " "),
          name: d.name,
          mime_type: d.mime_type,
          size_bytes: d.size_bytes,
          created_at: d.created_at,
          source: "remote",
          tags: d.tags || [],
        }))
        .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
      setPages(sorted);
      setError("");
      return sorted;
    } catch (err) {
      setError(err.message);
      setPages([]);
      return [];
    }
  }, []);

  useEffect(() => {
    if (user?.emailVerified) refreshDocuments();
  }, [user, refreshDocuments]);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", isDark);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Load doc content when navigating to viewer
  useEffect(() => {
    if (currentView !== "viewer" || !viewingDocId) return;
    const doc = pages.find((p) => p.id === viewingDocId);
    if (!doc) return;
    let cancelled = false;
    setLoadingDoc(true);
    api.getDocumentRaw(doc.name)
      .then((text) => { if (!cancelled) setViewingDocContent(text); })
      .catch((err) => { if (!cancelled) setViewingDocContent(`# Erro\n\n${err.message}`); })
      .finally(() => { if (!cancelled) setLoadingDoc(false); });
    return () => { cancelled = true; };
  }, [currentView, viewingDocId, pages]);

  function handleSelectPage(pageId) {
    setViewingDocId(pageId);
    setCurrentView("viewer");
    setError("");
  }

  function handleBack() {
    setCurrentView("home");
    setViewingDocId(null);
    setViewingDocContent("");
  }

  const handleDeleted = useCallback(
    async (deletedId) => {
      await refreshDocuments();
      if (deletedId === viewingDocId) handleBack();
    },
    [refreshDocuments, viewingDocId],
  );

  const handleUpdated = useCallback(async () => {
    await refreshDocuments();
  }, [refreshDocuments]);

  const handleUploaded = useCallback(
    async (doc) => {
      const sorted = await refreshDocuments();
      const target = sorted.find((p) => p.id === doc.name.replace(/\.md$/, ""));
      if (target) setViewingDocId(target.id);
    },
    [refreshDocuments],
  );

  // Auth handlers
  function handleLogin(sessionId, userData) {
    setAuthToken(sessionId);
    setToken(sessionId);
    setUser(userData);
    setAuthError("");
  }

  function handleLogout() {
    api.logout();
    setUser(null);
    setToken("");
    setCurrentView("home");
    setViewingDocId(null);
    setViewingDocContent("");
  }

  // ─── AUTH SCREEN ────────────────────────────────────────────────
  // Verify-email callback is handled regardless of auth state
  const verifyToken = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;
  if (verifyToken) {
    return (
      <div className="auth-layout">
        <header className="topbar">
          <div className="brand">
            <BookOpen className="logo-icon" aria-hidden="true" />
            <span className="brand-title">Docs</span>
          </div>
        </header>
        <EmailVerifyCallback token={verifyToken} onVerified={(u) => { setUser(u); setAuthToken(u?.sessionId || null); }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="auth-layout">
        <header className="topbar">
          <div className="brand">
            <BookOpen className="logo-icon" aria-hidden="true" />
            <span className="brand-title">Docs</span>
          </div>
        </header>

        {authView === "register" ? (
          <RegisterPage onGoToLogin={() => { setAuthView("login"); setAuthError(""); }} />
        ) : (
          <LoginPage onLogin={handleLogin} onGoToRegister={() => { setAuthView("register"); setAuthError(""); }} error={authError} />
        )}
      </div>
    );
  }

  // Non-admin unverified users go to a "verify your email" gate
  if (user.role !== "admin" && !user.emailVerified) {
    return (
      <div className="auth-layout">
        <header className="topbar">
          <div className="brand">
            <BookOpen className="logo-icon" aria-hidden="true" />
            <span className="brand-title">Docs</span>
          </div>
          <button type="button" className="theme-toggle" onClick={handleLogout}>Sair</button>
        </header>
        <VerifyPendingScreen userEmail={user.email} onLogout={handleLogout} />
      </div>
    );
  }

  // ─── FULL APPLICATION ─────────────────────────────────────────
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          {currentView === "viewer" && (
            <button type="button" className="topbar-back-btn" onClick={handleBack}>
              <ArrowLeft size={22} />
            </button>
          )}
          <BookOpen className="logo-icon" aria-hidden="true" />
          <span className="brand-title">Docs</span>
        </div>
        <div className="topbar-actions">
          {user?.role === "admin" && currentView !== "admin" && (
            <button
              type="button"
              className="admin-pill"
              onClick={() => setCurrentView("admin")}
              title="Gerenciar usuários"
            >
              <ShieldAlert size={15} /> Admin
            </button>
          )}
          {currentView === "admin" && (
            <button type="button" className="admin-pill admin-pill--active" onClick={handleBack}>
              <ShieldAlert size={15} /> Voltar
            </button>
          )}
          <span className="topbar-user">{user?.username || user?.email}</span>
          <button type="button" className="theme-toggle" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {currentView === "home" ? (
        <HomePage
          pages={pages}
          onSelectPage={handleSelectPage}
          onDeleted={handleDeleted}
          onOpenUploadModal={() => setUploadModalOpen(true)}
          onUpdated={handleUpdated}
        />
      ) : currentView === "admin" ? (
        <AdminPage onBack={handleBack} currentUser={user} />
      ) : (
        loadingDoc ? (
          <main className="viewer loading-only"><p className="muted">Carregando documento…</p></main>
        ) : (
          <DocView content={viewingDocContent} onBack={handleBack} />
        )
      )}

      {error && (
        <p className="sidebar-status err">Erro ao carregar documentos: {error}</p>
      )}

      {uploadModalOpen && (
        <div className="modal" onClick={() => setUploadModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Enviar documento</h3>
            <input
              type="text"
              placeholder="Tags (vírgula separada)"
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
              className="modal-input"
            />
            <input
              type="file"
              accept=".md,.markdown,text/markdown"
              onChange={(e) => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]); }}
              className="modal-input"
            />
            <div className="modal-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={async () => {
                  if (!selectedFile) return;
                  setUploadModalOpen(false);
                  try {
                    const tagsArray = newTags.split(",").map((t) => t.trim()).filter(Boolean);
                    const doc = await api.uploadDocument(selectedFile, tagsArray);
                    handleUploaded(doc);
                  } catch (err) { setError(err.message); }
                }}
              >Enviar</button>
              <button type="button" className="btn-secondary" onClick={() => setUploadModalOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && (
        <div className="modal" onClick={() => setEditModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Editar tags</h3>
            <input
              type="text"
              placeholder="Tags (vírgula separada)"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              className="modal-input"
            />
            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={async () => {
                if (!editingDoc) return;
                try {
                  await api.updateDocumentTags(editingDoc.name, editTags.split(",").map((t) => t.trim()).filter(Boolean));
                  setEditModalOpen(false);
                  setEditingDoc(null);
                  await refreshDocuments();
                } catch (err) { setError(err.message); }
              }}>Salvar</button>
              <button type="button" className="btn-secondary" onClick={() => setEditModalOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline auth sub-screens ──────────────────────────────────────

function EmailVerifyCallback({ token, onVerified }) {
  const [status, setStatus] = useState("checking");
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    api.verifyEmail(token)
      .then(({ user: u }) => { 
        setStatus("success"); 
        onVerified(u);
        setShowAlert(true);
      })
      .catch(() => setStatus("error"));
  }, [token, onVerified]);

  useEffect(() => {
    if (showAlert) {
      alert("E-mail confirmado com sucesso! A redirecionar para a página principal.");
      setTimeout(() => {
        window.location.href = window.location.origin;
      }, 500);
    }
  }, [showAlert]);

  if (status === "success") {
    return <p className="auth-verify-text">E-mail confirmado! A redirecionar…</p>;
  }
  return <p className="auth-verify-text auth-error">Token inválido ou expirado.</p>;
}

function VerifyPendingScreen({ userEmail, onLogout }) {
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => { if (cooldown > 0) { const t = setInterval(() => setCooldown((c) => c - 1), 1000); return () => clearInterval(t); } }, [cooldown]);

  async function handleResend(e) {
    e.preventDefault();
    setMsg("");
    try {
      await api.resendVerification(userEmail);
      setCooldown(60);
      setSent(true);
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <ShieldAlert size={40} className="auth-verify-icon" />
        <h1 className="auth-title">Verifique o seu e-mail</h1>
        <p className="auth-subtitle">
          Enviamos um link de confirmação para <strong>{userEmail}</strong>.
        </p>
        <p className="auth-subtitle">Clique no link para acessar o sistema.</p>
        {sent && <p className="auth-resend-confirm">E-mail reenviado com sucesso!</p>}
        {msg && <p className="auth-error">{msg}</p>}
        <div className="auth-resend-row">
          <button type="button" className="auth-link" onClick={handleResend} disabled={cooldown > 0}>
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : "Reenviar e-mail"}
          </button>
        </div>
        <button type="button" className="auth-link auth-footer-link" onClick={onLogout}>Sair</button>
      </div>
    </div>
  );
}

export default App;