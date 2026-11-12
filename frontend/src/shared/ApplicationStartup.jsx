import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { useBranding } from "./BrandingContext.jsx";
import { Brand } from "./ui.jsx";
import "./branding.css";

export default function ApplicationStartup({ children }) {
  const { loading: sessionLoading } = useAuth();
  const { loading: brandingLoading } = useBranding();
  const [starting, setStarting] = useState(true);
  useEffect(() => {
    if (sessionLoading || brandingLoading || !starting) return;
    // Allow the loaded logo to paint before revealing the application.
    const timer = window.setTimeout(() => setStarting(false), 300);
    return () => window.clearTimeout(timer);
  }, [sessionLoading, brandingLoading, starting]);
  if (!starting) return children;
  return <div className="site-loading-screen" role="status" aria-label="Loading NSBM SportsHub"><div className="site-loading-content"><Brand /><p>Loading SportsHub...</p><div className="site-loading-dots" aria-hidden="true"><span /><span /><span /></div></div></div>;
}
