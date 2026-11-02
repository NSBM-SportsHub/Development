import { useState } from "react";
import { useAuth } from "../../shared/AuthContext.jsx";
import { api, refreshSession } from "../../shared/api.js";
import { validateNewPassword } from "../../shared/validation.js";
import { Avatar, Button, Field, Icon, Notice } from "../../shared/ui.jsx";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [values, setValues] = useState({ name: user.name, email: user.email, phone: user.phone || "", student_id: user.student_id || "", current_password: "" });
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [profileState, setProfileState] = useState({ busy: false, error: "", success: "", fields: {} });
  const [passwordState, setPasswordState] = useState({ busy: false, error: "", success: "", fields: {} });
  const emailChanged = values.email.trim() !== user.email;
  async function saveProfile(event) {
    event.preventDefault();
    if (profileState.busy) return;
    setProfileState({ busy: true, error: "", success: "", fields: {} });
    try {
      const payload = { name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim() || null, student_id: values.student_id.trim() || null };
      if (emailChanged) payload.current_password = values.current_password;
      const updated = await api.patch("/users/me", payload);
      setUser(updated);
      setValues({ name: updated.name, email: updated.email, phone: updated.phone || "", student_id: updated.student_id || "", current_password: "" });
      // The write has committed. If renewal fails, the next write will fetch a token again.
      try { await refreshSession(); } catch { /* Keep the successful save visible. */ }
      setProfileState({ busy: false, success: "Your profile has been updated.", error: "", fields: {} });
    } catch (failure) { setProfileState({ busy: false, error: failure.message, fields: failure.fields || {} }); }
  }
  async function changePassword(event) {
    event.preventDefault();
    if (passwordState.busy) return;
    if (validateNewPassword(passwords.new_password)) { setPasswordState({ busy: false, error: "", fields: { new_password: validateNewPassword(passwords.new_password) } }); return; }
    if (passwords.new_password !== passwords.confirm_password) { setPasswordState({ busy: false, error: "", fields: { confirm_password: "Passwords must match." } }); return; }
    setPasswordState({ busy: true, error: "", success: "", fields: {} });
    try {
      await api.patch("/users/me/password", { current_password: passwords.current_password, new_password: passwords.new_password });
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      try { await refreshSession(); } catch { /* The next write will retry session renewal. */ }
      setPasswordState({ busy: false, success: "Your password has been changed.", error: "", fields: {} });
    } catch (failure) { setPasswordState({ busy: false, error: failure.message, fields: failure.fields || {} }); }
  }
  const updateProfile = (event) => { setValues({ ...values, [event.target.name]: event.target.value }); setProfileState({ ...profileState, success: "", fields: { ...profileState.fields, [event.target.name]: "" } }); };
  const updatePassword = (event) => { setPasswords({ ...passwords, [event.target.name]: event.target.value }); setPasswordState({ ...passwordState, success: "", fields: { ...passwordState.fields, [event.target.name]: "" } }); };
  const profileInput = (name, label, props = {}) => <Field name={name} label={label} value={values[name]} onChange={updateProfile} error={profileState.fields[name]} disabled={profileState.busy} {...props} />;
  const passwordInput = (name, label, props = {}) => <Field name={name} label={label} type="password" value={passwords[name]} onChange={updatePassword} error={passwordState.fields[name]} disabled={passwordState.busy} required maxLength={128} {...props} />;
  return <><div className="page-heading"><div><span className="eyebrow">YOUR ACCOUNT</span><h1>My profile</h1><p>A little about you. All in one place.</p></div></div><section className="profile-hero"><div className="profile-identity"><Avatar user={user} large /><div><h2>{user.name}</h2><p>{user.email}</p><span className="badge badge-role">{user.role === "admin" ? "Administrator" : "Student"}</span></div></div><div className="profile-hero-note"><Icon name="shield" size={24} /><span>Your SportsHub account<br /><strong>Ready for the next chapter.</strong></span></div></section><div className="profile-columns"><section className="card"><div className="card-heading"><span className="section-icon"><Icon name="user" /></span><div><h2>Personal details</h2><p>Keep your contact information up to date.</p></div></div><form onSubmit={saveProfile}><Notice>{profileState.error}</Notice><Notice type="success">{profileState.success}</Notice><div className="form-grid">{profileInput("name", "Full name", { autoComplete: "name", required: true, minLength: 2, maxLength: 100 })}{profileInput("email", "Email address", { type: "email", autoComplete: "email", required: true, maxLength: 190 })}{profileInput("student_id", "Student ID", { maxLength: 50, placeholder: "Add your student ID" })}{profileInput("phone", "Phone number", { type: "tel", autoComplete: "tel", maxLength: 30, placeholder: "Add a phone number" })}</div>{emailChanged && <div className="email-confirm">{profileInput("current_password", "Current password", { type: "password", autoComplete: "current-password", required: true, hint: "Confirm your current password to change your email address." })}</div>}<div className="form-footer"><span>Changes apply to your account.</span><Button type="submit" busy={profileState.busy}>{profileState.busy ? "Saving…" : "Save changes"}</Button></div></form></section><section className="card password-card"><div className="card-heading"><span className="section-icon"><Icon name="lock" /></span><div><h2>Password & security</h2><p>A strong password keeps your account safe.</p></div></div><form onSubmit={changePassword}><Notice>{passwordState.error}</Notice><Notice type="success">{passwordState.success}</Notice><div className="form-stack">{passwordInput("current_password", "Current password", { autoComplete: "current-password" })}{passwordInput("new_password", "New password", { autoComplete: "new-password", minLength: 12, hint: "Use at least 12 characters." })}{passwordInput("confirm_password", "Confirm new password", { autoComplete: "new-password" })}</div><div className="form-footer"><Button type="submit" busy={passwordState.busy} className="button-secondary">{passwordState.busy ? "Updating…" : "Update password"}</Button></div></form></section></div></>;
}
