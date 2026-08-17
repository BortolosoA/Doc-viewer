import { useState, useEffect, useRef } from "react";
import { BookOpen, User, Mail, Lock } from "lucide-react";
import { api } from "./api";

function RegisterPage({ onGoToLogin }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("form"); // "form" | "check-email"
  const emailInputRef = useRef(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (step === "form" && emailInputRef.current) emailInputRef.current.focus();
  }, [step]);

  useEffect(() => {
    if (cooldown === 0) return;
    const t = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("As senhas não coincidem");
    if (password.length < 6) return setError("A senha deve ter ao menos 6 caracteres");
    setLoading(true);
    try {
      await api.register(username, email, password);
      setStep("check-email");
      setCooldown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.resendVerification(email);
      setCooldown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (step === "check-email") {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Mail size={40} className="auth-verify-icon" />
          <h1 className="auth-title">Verifique o seu e-mail</h1>
          <p className="auth-subtitle">
            Enviamos um link de confirmação para <strong>{email}</strong>.
            Clique no link para ativar a sua conta.
          </p>
          <p className="auth-resend-hint">
            Não recebeu?{" "}
            <button
              type="button"
              className="auth-link"
              onClick={handleResend}
              disabled={loading || cooldown > 0}
            >
              {cooldown > 0 ? `Reenviar em ${cooldown}s` : loading ? "Enviando…" : "Reenviar e-mail"}
            </button>
          </p>
          <button type="button" className="auth-link auth-footer-link" onClick={onGoToLogin}>
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <BookOpen size={32} className="auth-logo" />
          <h1 className="auth-title">Docs</h1>
          <p className="auth-subtitle">Crie a sua conta</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <p className="auth-error">{error}</p>}

          <div className="auth-field">
            <User size={16} className="auth-field-icon" />
            <input
              ref={emailInputRef}
              type="text"
              placeholder="Nome de usuário (opcional)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="auth-input"
            />
          </div>

          <div className="auth-field">
            <Mail size={16} className="auth-field-icon" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="auth-input"
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

          <div className="auth-field">
            <Lock size={16} className="auth-field-icon" />
            <input
              type="password"
              placeholder="Confirmar senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="auth-input"
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? "Criando conta…" : "Cadastrar"}
          </button>
        </form>

        <p className="auth-footer">
          Já tem uma conta?{" "}
          <button type="button" className="auth-link" onClick={onGoToLogin}>
            Entre aqui
          </button>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;