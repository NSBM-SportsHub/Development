import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/AuthContext.jsx";
import { Brand, Button, Field, Icon, Loading, Notice } from "../../shared/ui.jsx";
import { validateNewPassword } from "../../shared/validation.js";

export default function AuthPage({ register = false }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm_password: "", phone: "", student_id: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const destination = location.state?.from?.startsWith("/") && !location.state.from.startsWith("//") ? location.state.from : "/profile";
  if (auth.loading) return <Loading message="Connecting to SportsHub…" />;
  if (auth.user) return <Navigate to={destination} replace />;
  const update = (event) => { setValues({ ...values, [event.target.name]: event.target.value }); setFields({ ...fields, [event.target.name]: "" }); };
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError(""); setFields({});
    if (register && validateNewPassword(values.password)) { setFields({ password: validateNewPassword(values.password) }); return; }
    if (register && values.password !== values.confirm_password) { setFields({ confirm_password: "Passwords must match." }); return; }
    setBusy(true);
    try {
      const payload = register ? { name: values.name.trim(), email: values.email.trim(), password: values.password, phone: values.phone.trim() || null, student_id: values.student_id.trim() || null } : { email: values.email.trim(), password: values.password };
      await (register ? auth.register(payload) : auth.login(payload));
      navigate(destination, { replace: true });
    } catch (failure) { setError(failure.message); setFields(failure.fields || {}); }
    finally { setBusy(false); }
  }
  const input = (name, label, props = {}) => <Field name={name} label={label} value={values[name]} onChange={update} error={fields[name]} disabled={busy} {...props} />;
  return <div className={`auth-page ${register ? "auth-register" : ""}`}><aside className="auth-story"><Link to="/" className="brand-link"><Brand light /></Link><div className="auth-story-content"><span className="eyebrow light">THE NSBM SPORTING COMMUNITY</span><h1>Find your people.<br />Bring your game.</h1><p>Your place in the team starts here. Stay connected to university sport with your SportsHub account.</p><div className="court-art" aria-hidden="true"><div className="court-circle" /><div className="court-line" /><span>NSBM<br /><strong>SPORTSHUB</strong></span></div><div className="story-caption"><span className="story-line" /><span>ONE CAMPUS. EVERY SPORT.</span></div></div><span className="auth-story-footer">NSBM Green University</span></aside><main className="auth-main"><div className="auth-mobile-brand"><Brand /></div><div className="auth-form-wrap"><span className="eyebrow">{register ? "JOIN THE COMMUNITY" : "WELCOME BACK"}</span><h2>{register ? "Create your account" : "Good to see you again."}</h2><p className="auth-intro">{register ? "Set up your student account to get started." : "Sign in to your NSBM SportsHub account."}</p>{auth.sessionError && !error && <Notice>{auth.sessionError}</Notice>}<Notice>{error}</Notice><form onSubmit={submit} className="auth-form">{register && input("name", "Full name", { autoComplete: "name", required: true, minLength: 2, maxLength: 100, placeholder: "Your full name" })}{input("email", "Email address", { type: "email", autoComplete: "email", required: true, maxLength: 190, placeholder: "you@example.com" })}{register && <div className="form-grid">{input("student_id", "Student ID (optional)", { autoComplete: "off", maxLength: 50, placeholder: "Student ID" })}{input("phone", "Phone (optional)", { type: "tel", autoComplete: "tel", maxLength: 30, placeholder: "Phone number" })}</div>}{input("password", "Password", { type: "password", autoComplete: register ? "new-password" : "current-password", required: true, minLength: register ? 12 : undefined, maxLength: 128, hint: register ? "Use at least 12 characters." : undefined, placeholder: register ? "Create a strong password" : "Enter your password" })}{register && input("confirm_password", "Confirm password", { type: "password", autoComplete: "new-password", required: true, maxLength: 128, placeholder: "Enter your password again" })}<Button type="submit" busy={busy} className="button-primary button-full">{busy ? (register ? "Creating account…" : "Signing in…") : register ? "Create account" : "Sign in"}{!busy && <Icon name="arrow" size={18} />}</Button></form><p className="auth-switch">{register ? "Already have an account?" : "New to SportsHub?"} <Link to={register ? "/login" : "/register"} key={register ? "login" : "register"} onClick={() => { setError(""); setFields({}); }}>{register ? "Sign in" : "Create an account"}</Link></p><div className="auth-security"><Icon name="lock" size={16} /><span>Your account connects you to the NSBM sports community.</span></div></div><p className="auth-main-footer">NSBM SportsHub · Play. Connect. Belong.</p></main></div>;
}
