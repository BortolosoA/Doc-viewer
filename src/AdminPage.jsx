import { useState, useEffect } from "react";
import { Shield, UserPlus, Trash2, Mail, User, Key } from "lucide-react";
import { api } from "./api";

function AdminPage({ onBack, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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
      setUsername(""); setEmail(""); setPassword(""); setRole("user");
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminPage;