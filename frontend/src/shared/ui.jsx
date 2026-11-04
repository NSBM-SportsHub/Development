import { useEffect, useId, useRef } from "react";

const paths = {
  user: <><path d="M20 21v-2a7 7 0 0 0-14 0v2" /><circle cx="13" cy="7" r="4" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75" /><circle cx="9" cy="7" r="4" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5M21 12H9" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  edit: <><path d="m16 3 5 5-12 12H4v-5L16 3Zm-2 2 5 5" /></>,
  archive: <><path d="M4 7h16v14H4V7ZM3 3h18v4H3V3Zm6 8h6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" /></>,
    trophy: <><path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v2a3 3 0 0 0 3 3m10-5h3v2a3 3 0 0 1-3 3" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
};

export function Icon({ name, size = 20, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.user}</svg>;
}

export function Brand({ light = false }) {
  return <div className={`brand ${light ? "brand-light" : ""}`}><span className="brand-mark" aria-hidden="true">N<span>↗</span></span><span><strong>NSBM <span>SportsHub</span></strong><small>GREEN UNIVERSITY</small></span></div>;
}

export function Avatar({ user, large = false }) {
  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
  return <span className={`avatar ${large ? "avatar-large" : ""}`} aria-hidden="true">{initials}</span>;
}

export function Field({ label, name, error, hint, children, ...props }) {
  const generatedId = useId();
  const id = props.id || `${name}-${generatedId}`;
  return <div className="field"><label htmlFor={id}>{label}</label>{children || <input {...props} id={id} name={name} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} />}{error ? <span className="field-error" id={`${id}-error`}>{error}</span> : hint ? <span className="field-hint" id={`${id}-hint`}>{hint}</span> : null}</div>;
}

export function Notice({ children, type = "error" }) {
  if (!children) return null;
  return <div className={`notice notice-${type}`} role={type === "error" ? "alert" : "status"}>{type === "success" && <Icon name="check" size={18} />}<span>{children}</span></div>;
}

export function Button({ children, busy = false, className = "button-primary", ...props }) {
  return <button className={`button ${className}`} {...props} disabled={busy || props.disabled}>{busy ? <span className="spinner" aria-hidden="true" /> : null}{children}</button>;
}

export function Loading({ message = "Loading your workspace…" }) {
  return <div className="loading-state" role="status"><span className="spinner" /><p>{message}</p></div>;
}

export function EmptyState({ icon = "search", title, children, action }) {
  return <div className="empty-state"><span className="section-icon"><Icon name={icon} size={26} /></span><h2>{title}</h2>{children && <p>{children}</p>}{action}</div>;
}

export function ErrorState({ message, onRetry }) {
  return <div className="directory-state"><Notice>{message}</Notice>{onRetry && <Button className="button-secondary" onClick={onRetry}>Try again</Button>}</div>;
}

export function Modal({ title, subtitle, children, onClose, busy = false, compact = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]';
    dialog.querySelector(selector)?.focus();
    function handleKey(event) {
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
      if (event.key !== "Tab") return;
      const elements = [...dialog.querySelectorAll(selector)];
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, []);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><section ref={dialogRef} className={`modal ${compact ? "modal-compact" : ""}`} role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="modal-heading"><div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="icon-button" aria-label="Close dialog" disabled={busy} onClick={onClose}><Icon name="close" /></button></div>{children}</section></div>;
}
