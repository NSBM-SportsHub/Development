import { useEffect, useState } from "react";
import { api, refreshSession } from "../../shared/api.js";
import { validateNewPassword } from "../../shared/validation.js";
import { useAuth } from "../../shared/AuthContext.jsx";
import { Avatar, Button, Field, Icon, Loading, Modal, Notice } from "../../shared/ui.jsx";

const emptyUser = { name: "", email: "", phone: "", student_id: "", password: "", role: "student", status: "active" };

function UserEditor({ user, currentUser, onClose, onSaved }) {
  const editing = Boolean(user?.id);
  const isSelf = editing && user.id === currentUser.id;
  const [values, setValues] = useState(user ? { ...emptyUser, ...user, phone: user.phone || "", student_id: user.student_id || "" } : emptyUser);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const change = (event) => { setValues({ ...values, [event.target.name]: event.target.value }); setFields({ ...fields, [event.target.name]: "" }); };
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    if (!editing && validateNewPassword(values.password)) { setFields({ password: validateNewPassword(values.password) }); return; }
    setBusy(true); setError(""); setFields({});
    try {
      const payload = { name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim() || null, student_id: values.student_id.trim() || null, role: values.role, status: values.status };
      if (!editing) payload.password = values.password;
      const saved = editing ? await api.patch(`/users/${user.id}`, payload) : await api.post("/users", payload);
      if (isSelf) { try { await refreshSession(); } catch { /* The next write will retry renewal. */ } }
      onSaved(saved, editing ? "User details updated." : "New user created.");
    } catch (failure) { setError(failure.message); setFields(failure.fields || {}); }
    finally { setBusy(false); }
  }
  const input = (name, label, props = {}) => <Field name={name} label={label} value={values[name]} onChange={change} error={fields[name]} disabled={busy} {...props} />;
  const select = (name, label, options) => <div className="field"><label htmlFor={`user-${name}`}>{label}</label><select id={`user-${name}`} name={name} value={values[name]} onChange={change} disabled={busy || isSelf} aria-invalid={!!fields[name]} aria-describedby={fields[name] ? `user-${name}-error` : undefined}>{options.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select>{fields[name] && <span className="field-error" id={`user-${name}-error`}>{fields[name]}</span>}</div>;
  return <Modal title={editing ? "Edit user" : "Create a user"} subtitle={editing ? "Update their account information and access." : "Add a member to the SportsHub community."} onClose={onClose} busy={busy}><form onSubmit={save}><Notice>{error}</Notice><div className="form-grid">{input("name", "Full name", { required: true, minLength: 2, maxLength: 100, autoComplete: "off" })}{input("email", "Email address", { type: "email", required: true, maxLength: 190, autoComplete: "off" })}{input("student_id", "Student ID (optional)", { maxLength: 50 })}{input("phone", "Phone (optional)", { type: "tel", maxLength: 30 })}{select("role", "Role", [["student", "Student"], ["admin", "Administrator"]])}{select("status", "Account status", [["active", "Active"], ["inactive", "Inactive"]])}</div>{isSelf && <p className="field-hint spaced-hint">You cannot change your own role or account status.</p>}{!editing && <div className="spaced-field">{input("password", "Initial password", { type: "password", required: true, minLength: 12, maxLength: 128, autoComplete: "new-password", hint: "Use at least 12 characters. Share the password with the user securely." })}</div>}<div className="modal-actions"><Button type="button" className="button-secondary" onClick={onClose} disabled={busy}>Cancel</Button><Button type="submit" busy={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Create user"}</Button></div></form></Modal>;
}

function ArchiveConfirmation({ user, onClose, onArchived }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function archive() {
    if (busy) return;
    setBusy(true); setError("");
    try { await api.delete(`/users/${user.id}`); onArchived(); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <Modal title="Archive this user?" onClose={onClose} busy={busy} compact><div className="archive-symbol"><Icon name="archive" size={26} /></div><p className="confirmation-copy"><strong>{user.name}</strong> will lose access to SportsHub and be removed from the user directory. Their existing records will be preserved.</p><Notice>{error}</Notice><div className="modal-actions"><Button type="button" className="button-secondary" onClick={onClose} disabled={busy}>Keep user</Button><Button type="button" className="button-danger" onClick={archive} busy={busy}>{busy ? "Archiving…" : "Archive user"}</Button></div></Modal>;
}

function formatDate(value) {
  const utcValue = typeof value === "string" && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(utcValue);
  return Number.isNaN(date.valueOf()) ? "—" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default function UsersPage() {
  const { user: currentUser, setUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, per_page: 10, total: 0, total_pages: 1 });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [editor, setEditor] = useState(null);
  const [archiveUser, setArchiveUser] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    const query = new URLSearchParams({ page: String(page), per_page: "10", search, role, status });
    api.get(`/users?${query}`, { signal: controller.signal }).then((data) => {
      if (controller.signal.aborted) return;
      if (page > Math.max(1, data.pagination.total_pages)) { setPage(Math.max(1, data.pagination.total_pages)); return; }
      setUsers(data.users); setPagination(data.pagination);
    }).catch((failure) => { if (failure.name !== "AbortError") setError(failure.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, search, role, status, reloadKey]);

  function saved(updated, message) {
    if (updated.id === currentUser.id) setUser(updated);
    setEditor(null); setNotice(message); setReloadKey((value) => value + 1);
  }
  function searchUsers(event) { event.preventDefault(); setPage(1); setSearch(searchInput.trim()); setReloadKey((value) => value + 1); }
  function resetFilters() { setSearchInput(""); setSearch(""); setRole(""); setStatus(""); setPage(1); }
  const filtered = Boolean(search || role || status);
  const start = pagination.total ? (pagination.page - 1) * pagination.per_page + 1 : 0;
  const end = Math.min(pagination.page * pagination.per_page, pagination.total);

  return <><div className="page-heading"><div><span className="eyebrow">ADMINISTRATION</span><h1>People & access</h1><p>Manage the people who make your sports community.</p></div><Button onClick={() => { setNotice(""); setEditor({}); }}><Icon name="plus" size={18} />Create user</Button></div><Notice type="success">{notice}</Notice><section className="directory-summary"><div className="summary-icon"><Icon name="users" size={24} /></div><div><strong>User directory</strong><p>Student and administrator accounts, in one place.</p></div><span className="badge badge-role"><Icon name="shield" size={14} />Admin access</span></section><section className="card directory-card"><div className="directory-toolbar"><form className="search-form" onSubmit={searchUsers}><div className="search-input"><Icon name="search" size={18} /><label htmlFor="user-search" className="sr-only">Search users</label><input id="user-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search name or email…" type="search" maxLength={100} /></div><Button type="submit" className="button-secondary">Search</Button></form><div className="directory-filters"><label className="sr-only" htmlFor="role-filter">Filter by role</label><select id="role-filter" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}><option value="">All roles</option><option value="student">Students</option><option value="admin">Administrators</option></select><label className="sr-only" htmlFor="status-filter">Filter by status</label><select id="status-filter" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>{filtered && <button type="button" className="text-button" onClick={resetFilters}>Reset</button>}</div></div>{loading ? <Loading message="Loading users…" /> : error ? <div className="directory-state"><Notice>{error}</Notice><Button className="button-secondary" onClick={() => setReloadKey((value) => value + 1)}>Try again</Button></div> : users.length === 0 ? <div className="empty-state"><span className="section-icon"><Icon name="users" size={26} /></span><h2>{filtered ? "No matching users" : "No users to display"}</h2><p>{filtered ? "Try a different search or clear your filters." : "Create an account to add someone to the community."}</p>{filtered ? <Button className="button-secondary" onClick={resetFilters}>Clear filters</Button> : <Button onClick={() => setEditor({})}>Create user</Button>}</div> : <><div className="table-scroll"><table className="users-table"><caption className="sr-only">SportsHub users and account access</caption><thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Joined</th><th scope="col" className="actions-heading">Actions</th></tr></thead><tbody>{users.map((person) => <tr key={person.id}><td><div className="table-person"><Avatar user={person} /><div><strong>{person.name}{person.id === currentUser.id && <span className="you-label">You</span>}</strong><span>{person.email}</span>{person.student_id && <small>{person.student_id}</small>}</div></div></td><td><span className={`role-text ${person.role === "admin" ? "admin-role" : ""}`}>{person.role === "admin" && <Icon name="shield" size={14} />}{person.role === "admin" ? "Administrator" : "Student"}</span></td><td><span className={`badge badge-${person.status}`}><span />{person.status === "active" ? "Active" : "Inactive"}</span></td><td className="date-cell">{formatDate(person.created_at)}</td><td><div className="row-actions"><button type="button" className="icon-button" aria-label={`Edit ${person.name}`} title="Edit user" onClick={() => setEditor(person)}><Icon name="edit" size={17} /></button><button type="button" className="icon-button archive-button" aria-label={`Archive ${person.name}`} title={person.id === currentUser.id ? "You cannot archive your own account" : "Archive user"} disabled={person.id === currentUser.id} onClick={() => setArchiveUser(person)}><Icon name="archive" size={17} /></button></div></td></tr>)}</tbody></table></div><div className="pagination"><span>Showing <strong>{start}–{end}</strong> of <strong>{pagination.total}</strong> users</span><div><Button className="button-secondary button-small" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span className="page-number">Page {page} of {Math.max(1, pagination.total_pages)}</span><Button className="button-secondary button-small" disabled={page >= pagination.total_pages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div></>}</section><p className="directory-footnote"><Icon name="shield" size={15} />Access changes take effect on the user’s next request. Archived accounts retain their historical records.</p>{editor && <UserEditor key={editor.id || "new"} user={editor.id ? editor : null} currentUser={currentUser} onClose={() => setEditor(null)} onSaved={saved} />}{archiveUser && <ArchiveConfirmation user={archiveUser} onClose={() => setArchiveUser(null)} onArchived={() => { setArchiveUser(null); setNotice("User archived. Their existing records have been preserved."); setReloadKey((value) => value + 1); }} />}</>;
}
