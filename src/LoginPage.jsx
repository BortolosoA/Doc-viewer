import { useState } from "react";
import { BookOpen, Mail, Lock } from "lucide-react";
import { api } from "./api";

function LoginPage({ onLogin, onGoToRegister, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLocalError("");
    setLoading(true);
    try {
      const result = await api.login(email, password);
      onLogin(result.sessionId, result.user);
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <BookOpen size={32} className="auth-logo" />
          <h1 className="auth-title">Docs</h1>
          <p className="auth-subtitle">Entre para continuar</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="auth-error">{error}</p>}
          {localError && <p className="auth-error">{localError}</p>}

          <div className="auth-field">
            <Mail size={16} className="auth-field-icon" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
              autoFocus
            />
          </div>

          <div className="auth-field">
            <Lock size={16} className="auth-field-icon" />
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="auth-input"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="auth-footer">
          Não tem uma conta?{" "}
          <button type="button" className="auth-link" onClick={onGoToRegister}>
            Cadastre-se
          </button>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;