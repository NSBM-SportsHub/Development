import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getSession, onUnauthorized } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");

  const reloadSession = useCallback(async () => {
    setLoading(true);
    setSessionError("");
    try {
      const session = await getSession();
      setUser(session.user);
    } catch (error) {
      setSessionError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reloadSession(); }, [reloadSession]);
  useEffect(() => onUnauthorized(() => { setUser(null); setSessionError(""); }), []);

  async function authenticate(path, values) {
    const session = await api.post(path, values);
    setUser(session.user);
    setSessionError("");
    return session.user;
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
    setSessionError("");
  }

  return <AuthContext.Provider value={{
    user, loading, sessionError, reloadSession, setUser, logout,
    login: (values) => authenticate("/auth/login", values),
    register: (values) => authenticate("/auth/register", values),
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
