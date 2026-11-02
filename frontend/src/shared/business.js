export function formatDate(value, options = {}) {
  if (!value) return "—";
  const normalized = typeof value === "string" && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.valueOf())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", ...options }).format(date);
}

export function toApiDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function statusLabel(status) {
  return String(status || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
