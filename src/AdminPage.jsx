import { useState, useEffect } from "react";
import { Shield, UserPlus, Trash2, Mail, User, Key, Copy, Check, ExternalLink } from "lucide-react";
import { api } from "./api";

function AdminPage({ onBack, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [confirmMethod, setConfirmMethod] = useState("email");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [linkModal, setLinkModal] = useState(null);
  const [linkData, setLinkData] = useState(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [changePasswordModal, setChangePasswordModal] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  function loadUsers() {
    setLoading(true);
    api.listUsers()
      .then((u) => { setUsers(u); setError(""); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    if (!email || !password) return setFormError("Email e senha são obrigatórios");
    if (password.length < 6) return setFormError("Senha deve ter ao menos 6 caracteres");
    setSaving(true);
    try {
      await api.createUser({ username: username || null, email, password, role });
      setShowForm(false);
      setUsername(""); setEmail(""); setPassword(""); setRole("user"); setConfirmMethod("email");
      loadUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(userToDelete) {
    if (userToDelete.id === currentUser.id) return;
    if (!confirm(`Remover usuário "${userToDelete.username || userToDelete.email}"?`)) return;
    try {
      await api.deleteUser(userToDelete.id);
      loadUsers();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSendVerification(user) {
    setLinkModal(true);
    setLinkLoading(true);
    setLinkData(null);
    setCopied(false);
    try {
      const result = await api.adminResendVerification(user.email, confirmMethod === "email");
      if (result.verified) {
        setLinkData({ verified: true, message: "Email já verificado" });
      } else if (result.ok) {
        setLinkData(result);
      } else {
        setError(result.error || "Erro ao gerar link");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLinkLoading(false);
    }
  }

  function copyLink() {
    if (linkData?.verifyUrl) {
      navigator.clipboard.writeText(linkData.verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleChangePassword(userId) {
    setPasswordError("");
    if (!newPassword || newPassword.length < 6) {
      return setPasswordError("A senha deve ter ao menos 6 caracteres");
    }
    setChangingPassword(true);
    try {
      await api.changePassword(currentUser.id, newPassword);
      setChangePasswordModal(null);
      setNewPassword("");
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button type="button" className="admin-back" onClick={onBack}>
          <Shield size={20} />
          <span>Admin</span>
        </button>
        <button
          type="button"
          className="admin-create-btn"
          onClick={() => { setShowForm((v) => !v); setFormError(""); }}
        >
          <UserPlus size={16} />
          Novo usuário
        </button>
      </header>

      {showForm && (
        <form className="admin-create-form" onSubmit={handleCreate}>
          <h3 className="admin-form-title">Criar novo usuário</h3>
          {formError && <p className="admin-error">{formError}</p>}
          <div className="admin-form-row">
            <div className="admin-field">
              <User size={14} className="admin-field-icon" />
              <input
                type="text"
                placeholder="Nome de usuário (opcional)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="admin-input"
              />
            </div>
            <div className="admin-field">
              <Mail size={14} className="admin-field-icon" />
              <input
                type="email"
                placeholder="Email *"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="admin-input"
              />
            </div>
            <div className="admin-field">
              <Key size={14} className="admin-field-icon" />
              <input
                type="text"
                placeholder="Senha *"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="admin-input"
              />
            </div>
            <div className="admin-field admin-field--select">
              <label className="admin-select-label">Função:</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="admin-select">
                <option value="user">Usuário</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="admin-field admin-field--select">
              <label className="admin-select-label">Confirmação:</label>
              <select value={confirmMethod} onChange={(e) => setConfirmMethod(e.target.value)} className="admin-select">
                <option value="email">Enviar e-mail automático</option>
                <option value="manual">Gerar link manual</option>
              </select>
            </div>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? "Criando…" : "Criar"}
            </button>
          </div>
        </form>
      )}

      {error && <p className="admin-error admin-error--global">{error}</p>}

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuário</th>
              <th>Email</th>
              <th>Função</th>
              <th>Email confirmado</th>
              <th>Criado em</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="admin-loading">Carregando…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="admin-empty">Nenhum usuário encontrado.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id}>
                <td className="admin-cell-id">{u.id}</td>
                <td>{u.username || "—"}</td>
                <td>{u.email}</td>
                <td>
                  <span className={`admin-role-badge admin-role-badge--${u.role}`}>
                    {u.role === "admin" ? "Admin" : "Usuário"}
                  </span>
                </td>
                <td>
                  <span className={u.email_verified ? "admin-verified-y" : "admin-verified-n"}>
                    {u.email_verified ? "Sim" : "Não"}
                  </span>
                </td>
                <td className="admin-cell-date">{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                <td>
                  <div className="admin-actions">
                    {!u.email_verified && (
                      <button
                        type="button"
                        className="admin-icon-btn admin-verify-btn"
                        title={confirmMethod === "email" ? "Reenviar e-mail" : "Gerar link manual"}
                        onClick={() => handleSendVerification(u)}
                        disabled={linkLoading}
                      >
                        <Mail size={14} />
                      </button>
                    )}
                    {u.id === currentUser?.id && (
                      <button
                        type="button"
                        className="admin-icon-btn admin-password-btn"
                        title="Alterar senha"
                        onClick={() => setChangePasswordModal(u)}
                      >
                        <Key size={14} />
                      </button>
                    )}
                    {u.id !== currentUser?.id && (
                      <button
                        type="button"
                        className="admin-delete-btn"
                        title="Remover usuário"
                        onClick={() => handleDelete(u)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {linkModal && (
        <div className="modal" onClick={() => { setLinkModal(null); setLinkData(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Link de verificação</h3>
            {linkData?.verified ? (
              <p className="modal-info">{linkData.message}</p>
            ) : linkData?.verifyUrl ? (
              <>
                <p className="modal-info">Copie o link abaixo para enviar ao usuário:</p>
                <div className="link-box">
                  <code>{linkData.verifyUrl}</code>
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-primary" onClick={copyLink}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "Copiado!" : "Copiar link"}
                  </button>
                  <a href={linkData.verifyUrl} target="_blank" rel="noreferrer" className="btn-secondary">
                    <ExternalLink size={16} /> Abrir link
                  </a>
                </div>
              </>
            ) : linkLoading ? (
              <p className="modal-info">Gerando link...</p>
            ) : null}
            <button type="button" className="btn-secondary modal-close" onClick={() => { setLinkModal(null); setLinkData(null); }}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {changePasswordModal && (
        <div className="modal" onClick={() => { setChangePasswordModal(null); setNewPassword(""); setPasswordError(""); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Alterar senha</h3>
            {passwordError && <p className="admin-error">{passwordError}</p>}
            <div className="admin-field">
              <Key size={14} className="admin-field-icon" />
              <input
                type="password"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="admin-input"
                minLength={6}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-save" disabled={changingPassword} onClick={() => handleChangePassword(changePasswordModal.id)}>
                {changingPassword ? "Salvando…" : "Salvar"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => { setChangePasswordModal(null); setNewPassword(""); }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;