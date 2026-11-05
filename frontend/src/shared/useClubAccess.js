import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "./api.js";
import { useAuth } from "./AuthContext.jsx";

export function useClubAccess() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [state, setState] = useState({ assignments: [], loading: true, error: "" });
  useEffect(() => {
    const controller = new AbortController();
    if (!user || user.role === "admin") {
      setState({ assignments: [], loading: false, error: "" });
      return () => controller.abort();
    }
    setState({ assignments: [], loading: true, error: "" });
    api.get(`/club-coaches?user_id=${user.id}`, { signal: controller.signal })
      .then((assignments) => { if (!controller.signal.aborted) setState({ assignments, loading: false, error: "" }); })
      .catch((failure) => { if (!controller.signal.aborted) setState({ assignments: [], loading: false, error: failure.message }); });
    return () => controller.abort();
  }, [user?.id, user?.role, pathname]);
  return { ...state, isAdmin: user?.role === "admin", canManage: (clubId) => user?.role === "admin" || state.assignments.some((item) => Number(item.club_id) === Number(clubId)) };
}
