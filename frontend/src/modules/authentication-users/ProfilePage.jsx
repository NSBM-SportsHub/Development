import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useAuth } from "../../shared/AuthContext.jsx";
import { api, refreshSession } from "../../shared/api.js";
import { validateNewPassword } from "../../shared/validation.js";
import { formatDate } from "../../shared/business.js";
import { Avatar, Button, Field, Icon, Notice } from "../../shared/ui.jsx";
import "./profile.css";
import ProfilePhotoEditor from "./ProfilePhotoEditor.jsx";
import UniversityLogoEditor from "./UniversityLogoEditor.jsx";

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const { onSignOut, signingOut } = useOutletContext();
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [values, setValues] = useState({ name: user.name, email: user.email, phone: user.phone || "", student_id: user.student_id || "", current_password: "" });
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [profileState, setProfileState] = useState({ busy: false, error: "", success: "", fields: {} });
  const [passwordState, setPasswordState] = useState({ busy: false, error: "", success: "", fields: {} });
  const emailChanged = values.email.trim() !== user.email;
  async function saveProfile(event) {
    event.preventDefault();
    if (profileState.busy || photoBusy) return;
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
      setEditingProfile(false);
    } catch (failure) { setProfileState({ busy: false, error: failure.message, fields: failure.fields || {} }); }
  }
  async function changePassword(event) {
    event.preventDefault();
    if (passwordState.busy || photoBusy) return;
    if (validateNewPassword(passwords.new_password)) { setPasswordState({ busy: false, error: "", fields: { new_password: validateNewPassword(passwords.new_password) } }); return; }
    if (passwords.new_password !== passwords.confirm_password) { setPasswordState({ busy: false, error: "", fields: { confirm_password: "Passwords must match." } }); return; }
    setPasswordState({ busy: true, error: "", success: "", fields: {} });
    try {
      await api.patch("/users/me/password", { current_password: passwords.current_password, new_password: passwords.new_password });
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      try { await refreshSession(); } catch { /* The next write will retry session renewal. */ }
      setPasswordState({ busy: false, success: "Your password has been changed.", error: "", fields: {} });
      setEditingPassword(false);
    } catch (failure) { setPasswordState({ busy: false, error: failure.message, fields: failure.fields || {} }); }
  }
  const updateProfile = (event) => { setValues({ ...values, [event.target.name]: event.target.value }); setProfileState({ ...profileState, success: "", fields: { ...profileState.fields, [event.target.name]: "" } }); };
  const updatePassword = (event) => { setPasswords({ ...passwords, [event.target.name]: event.target.value }); setPasswordState({ ...passwordState, success: "", fields: { ...passwordState.fields, [event.target.name]: "" } }); };
  const profileInput = (name, label, props = {}) => <Field name={name} label={label} value={values[name]} onChange={updateProfile} error={profileState.fields[name]} disabled={profileState.busy || photoBusy} {...props} />;
  const passwordInput = (name, label, props = {}) => <Field name={name} label={label} type="password" value={passwords[name]} onChange={updatePassword} error={passwordState.fields[name]} disabled={passwordState.busy || photoBusy} required maxLength={128} {...props} />;
  function toggleProfile(open) {
    if (profileState.busy || photoBusy) return;
    setValues({ name: user.name, email: user.email, phone: user.phone || "", student_id: user.student_id || "", current_password: "" });
    setProfileState({ busy: false, error: "", success: "", fields: {} });
    setEditingProfile(open);
  }
  function togglePassword(open) {
    if (passwordState.busy || photoBusy) return;
    setPasswords({ current_password: "", new_password: "", confirm_password: "" });
    setPasswordState({ busy: false, error: "", success: "", fields: {} });
    setEditingPassword(open);
  }
  const isAdmin = user.role === "admin";
  const shortcuts = isAdmin ? [
    { to: "/admin/clubs", icon: "clubs", title: "Your clubs", text: "See the people behind every team." },
    { to: "/admin/memberships", icon: "review", title: "Membership review", text: "Help the next player get started." },
    { to: "/admin/reports", icon: "report", title: "Participation reports", text: "See how your community is taking part." },
  ] : [
    { to: "/sports-clubs", icon: "sport", title: "Find your team", text: "A new sport. A new circle. Your club." },
    { to: "/training-attendance", icon: "calendar", title: "Show up. Level up.", text: "Find your next training session." },
    { to: "/memberships/mine", icon: "membership", title: "Your memberships", text: "Your applications and the teams you belong to." },
  ];
  function moveSpotlight(event) {
    if (event.pointerType === "touch" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
    event.currentTarget.style.setProperty("--art-tilt", `${((event.clientX - rect.left) / rect.width - .5) * 8}deg`);
  }
  return <section className="profile-experience" aria-label="Your profile workspace">
    <div className="page-heading profile-page-heading"><div><span className="eyebrow"><span className="profile-live-dot" /> YOUR STARTING LINE</span><h1>My profile<span className="profile-heading-dot" aria-hidden="true">.</span></h1><p>Your identity. Your game. All yours.</p></div><Button type="button" className="button-secondary profile-signout" busy={signingOut} onClick={onSignOut}><Icon name="logout" />{signingOut ? "Signing out..." : "Sign out"}</Button></div>
    <section className="profile-hero profile-stage" onPointerMove={moveSpotlight} onPointerLeave={(event) => { event.currentTarget.style.setProperty("--art-tilt", "0deg"); }}>
      <div className="profile-stage-topline"><span><Icon name="activity" size={15} /> NSBM SPORTSHUB</span><span>ONE COMMUNITY. EVERY AMBITION.</span></div>
      <div className="profile-identity"><div className="profile-avatar-frame"><Avatar user={user} large /><span className="profile-avatar-status" aria-hidden="true"><span className="profile-avatar-dot" /></span></div><div><span className="profile-identity-kicker">THE PERSON BEHIND THE GAME</span><h2>{user.name}</h2><p>{user.email}</p><span className="badge badge-role"><Icon name={isAdmin ? "shield" : "user"} size={13} />{isAdmin ? "Administrator" : "Student"}</span></div></div>
      <div className="profile-stage-art" aria-hidden="true"><div className="profile-orbit profile-orbit-one" /><div className="profile-orbit profile-orbit-two" /><svg className="profile-court" viewBox="0 0 360 280" fill="none"><rect x="34" y="30" width="292" height="220" rx="2" /><path d="M34 140h292M180 30v220M92 30v220m176-220v220M34 78h292M34 202h292" /><circle cx="180" cy="140" r="47" /><circle cx="180" cy="140" r="5" className="profile-court-centre" /><path className="profile-court-trail" d="M34 30h292v220H34V30Z" /></svg><span className="profile-art-word">MAKE<br />YOUR<br /><em>MARK.</em></span><span className="profile-art-caption">BUILT FOR WHAT'S NEXT ↗</span><span className="profile-court-ball" /></div>
      <div className="profile-stage-bottom"><div className="profile-hero-actions">{!editingProfile ? <Button type="button" className="button-primary profile-edit-button" onClick={() => toggleProfile(true)}><Icon name="edit" size={17} />Edit profile<Icon name="arrow" size={16} /></Button> : <span className="profile-editing-indicator"><Icon name="edit" size={15} /> Editing your profile below</span>}</div><dl className="profile-hero-meta"><div><dt>MEMBER SINCE</dt><dd>{formatDate(user.created_at)}</dd></div><div><dt>YOUR COMMUNITY</dt><dd>Green University</dd></div></dl></div>
    </section>
    <div className="profile-columns">
      <section className="card profile-panel profile-details-panel" aria-labelledby="personal-details-title">
        <div className="card-heading"><span className="section-icon"><Icon name="user" /></span><div><span className="profile-panel-kicker">01 / YOUR IDENTITY</span><h2 id="personal-details-title">Personal details</h2><p>The details that keep you connected.</p></div><span className="profile-panel-indicator">{editingProfile ? "Editing" : "Profile"}</span></div>
        <Notice>{profileState.error}</Notice><Notice type="success">{profileState.success}</Notice>
        {editingProfile ? <form onSubmit={saveProfile} aria-label="Edit profile">
          <ProfilePhotoEditor user={user} onSaved={setUser} onBusy={setPhotoBusy} disabled={profileState.busy || passwordState.busy} />
          <div className="form-grid">
            {profileInput("name", "Full name", { autoComplete: "name", autoFocus: true, required: true, minLength: 2, maxLength: 100 })}
            {profileInput("email", "Email address", { type: "email", autoComplete: "email", required: true, maxLength: 190 })}
            {profileInput("student_id", "Student ID", { maxLength: 50, placeholder: "Add your student ID" })}
            {profileInput("phone", "Phone number", { type: "tel", autoComplete: "tel", maxLength: 30, placeholder: "Add a phone number" })}
          </div>
          {emailChanged && <div className="email-confirm">{profileInput("current_password", "Current password", { type: "password", autoComplete: "current-password", required: true, hint: "Confirm your current password to change your email address." })}</div>}
          <div className="form-footer"><span>Changes apply to your account.</span><div className="profile-edit-actions"><Button type="button" className="button-secondary" disabled={profileState.busy || photoBusy} onClick={() => toggleProfile(false)}>Cancel</Button><Button type="submit" busy={profileState.busy} disabled={photoBusy}>{profileState.busy ? "Saving..." : "Save changes"}</Button></div></div>
        </form> : <>
          <dl className="profile-saved-details">{[["Full name", user.name, "user"], ["Email address", user.email, "mail"], ["Student ID", user.student_id, "membership"], ["Phone number", user.phone, "phone"]].map(([label, value, icon]) => <div key={label}><dt><Icon name={icon} size={15} />{label}</dt><dd className={!value ? "profile-missing-value" : ""}>{value || "Not provided"}</dd></div>)}</dl>
          <div className="profile-details-footer"><Icon name="shield" size={16} /><span>Your details belong to you. Update them whenever you need.</span></div>
        </>}
      </section>
      <section className="card password-card profile-panel profile-security-panel" aria-labelledby="password-security-title">
        <div className="card-heading"><span className="section-icon"><Icon name="lock" /></span><div><span className="profile-panel-kicker">02 / YOUR PEACE OF MIND</span><h2 id="password-security-title">Password &amp; security</h2><p>Keep your account in your hands.</p></div></div>
        <Notice>{passwordState.error}</Notice><Notice type="success">{passwordState.success}</Notice>
        {editingPassword ? <form onSubmit={changePassword} aria-label="Change password">
          <div className="form-stack">
            {passwordInput("current_password", "Current password", { autoComplete: "current-password", autoFocus: true })}
            {passwordInput("new_password", "New password", { autoComplete: "new-password", minLength: 12, hint: "Use at least 12 characters." })}
            {passwordInput("confirm_password", "Confirm new password", { autoComplete: "new-password" })}
          </div>
          <div className="form-footer profile-edit-actions"><Button type="button" className="button-secondary" disabled={passwordState.busy || photoBusy} onClick={() => togglePassword(false)}>Cancel</Button><Button type="submit" busy={passwordState.busy} disabled={photoBusy}>{passwordState.busy ? "Updating..." : "Update password"}</Button></div>
        </form> : <><div className="profile-lock-art" aria-hidden="true"><span className="profile-lock-orbit" /><Icon name="shield" size={42} /><span className="profile-lock-spark">+</span></div><p className="profile-security-summary">A fresh password. A little more peace of mind.</p><Button type="button" className="button-secondary" disabled={photoBusy} onClick={() => togglePassword(true)}><Icon name="lock" size={16} />Change password<Icon name="arrow" size={16} /></Button></>}
      </section>
    </div>
    {user.role === "admin" && <UniversityLogoEditor />}
    <section className="profile-next" aria-labelledby="profile-next-title"><div className="profile-next-heading"><div><span className="profile-panel-kicker">KEEP THE MOMENTUM</span><h2 id="profile-next-title">Your next move<span aria-hidden="true"> ↗</span></h2></div><span>Great things start with showing up.</span></div><div className="profile-shortcuts">{shortcuts.map((shortcut, index) => <Link key={shortcut.to} to={shortcut.to} className="profile-shortcut"><span className="profile-shortcut-top"><Icon name={shortcut.icon} size={24} /><span>0{index + 1}</span></span><strong>{shortcut.title}</strong><p>{shortcut.text}</p><span className="profile-shortcut-arrow"><Icon name="arrow" size={18} /></span></Link>)}</div></section>
  </section>;
}
