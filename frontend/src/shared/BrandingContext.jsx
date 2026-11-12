import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "./api.js";

const CACHE_KEY = "sportshub.university-branding.v1";
const emptyBranding = { university_logo_url: null, updated_at: null };
const BrandingContext = createContext({ branding: emptyBranding, loading: false, error: "" });

function publicBranding(value) {
  let url = null;
  try {
    const parsed = new URL(value?.university_logo_url);
    if (parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com" && !parsed.port && !parsed.username && !parsed.password && /^\/[a-zA-Z0-9_-]+\/image\/upload\/v[0-9]+\/[a-zA-Z0-9_/-]+\.webp$/.test(parsed.pathname) && !parsed.search && !parsed.hash) url = parsed.href;
  } catch { /* An empty or invalid cached URL uses the default mark. */ }
  return { university_logo_url: url, updated_at: typeof value?.updated_at === "string" ? value.updated_at : null };
}

function readCache() {
  try { return publicBranding(JSON.parse(window.localStorage.getItem(CACHE_KEY))); }
  catch { return emptyBranding; }
}

function writeCache(value) {
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(value)); }
  catch { /* Branding also works when browser storage is unavailable. */ }
}

function preloadLogo(url) {
  if (!url) return Promise.resolve();
  return new Promise((resolve) => {
    const image = new Image();
    const timer = window.setTimeout(finish, 2000);
    function finish() { window.clearTimeout(timer); image.onload = null; image.onerror = null; resolve(); }
    image.onload = finish; image.onerror = finish; image.referrerPolicy = "no-referrer"; image.src = url;
  });
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(readCache);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(null);
  const refreshBranding = useCallback(async (initial = false) => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const result = publicBranding(await api.get("/branding", { signal: controller.signal }));
      if (controller.signal.aborted || request.current !== controller) return;
      setBranding(result); writeCache(result); setError("");
      if (initial) await preloadLogo(result.university_logo_url);
    } catch (failure) {
      if (request.current === controller) setError(failure.name === "AbortError" ? "University branding could not be loaded. Try again." : failure.message);
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) { request.current = null; setLoading(false); }
    }
  }, []);
  const updateBranding = useCallback((value) => {
    request.current?.abort(); request.current = null;
    const result = publicBranding(value);
    setBranding(result); writeCache(result); setLoading(false); setError("");
  }, []);
  useEffect(() => {
    refreshBranding(true);
    const refresh = () => { if (!request.current) refreshBranding(); };
    const storage = (event) => { if (event.key === CACHE_KEY) refresh(); };
    window.addEventListener("focus", refresh); window.addEventListener("storage", storage);
    return () => {
      request.current?.abort(); request.current = null;
      window.removeEventListener("focus", refresh); window.removeEventListener("storage", storage);
    };
  }, [refreshBranding]);
  return <BrandingContext.Provider value={{ branding, loading, error, updateBranding, refreshBranding }}>{children}</BrandingContext.Provider>;
}

export function useBranding() { return useContext(BrandingContext); }
