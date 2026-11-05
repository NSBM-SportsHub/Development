import { useEffect, useRef, useState } from "react";
import { api } from "../../shared/api.js";
import { Button, Loading, Notice } from "../../shared/ui.jsx";

export default function CoachAssignments() {
  const [clubs, setClubs] = useState([]);
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [clubId, setClubId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [searchReload, setSearchReload] = useState(0);
  const mutation = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    Promise.all([api.get("/clubs", { signal: controller.signal }), api.get("/club-coaches", { signal: controller.signal })])
      .then(([clubRows, assignments]) => { if (!controller.signal.aborted) { setClubs(clubRows); setRows(assignments); } })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    const controller = new AbortController(); setSearching(true); setUserId("");
    api.get(`/users?status=active&per_page=100&search=${encodeURIComponent(search.trim())}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setUsers(result.users); })
      .catch((failure) => { if (!controller.signal.aborted) { setUsers([]); setError(failure.message); } })
      .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    return () => controller.abort();
  }, [searchReload]);
  async function mutate(operation, message) {
    if (mutation.current) return;
    mutation.current = true; setBusy(true); setError(""); setNotice("");
    try { await operation(); setNotice(message); setReload((value) => value + 1); }
    catch (failure) { setError([failure.message, ...Object.values(failure.fields || {})].join(" ")); }
    finally { mutation.current = false; setBusy(false); }
  }
  return <section className="business-page"><header className="business-heading"><div><p className="business-eyebrow">ADMINISTRATION</p><h1>Coach assignments</h1><p>Assign existing active accounts to manage a club. Assignments grant club permissions without changing the account role.</p></div></header>
    <Notice>{error}</Notice><Notice type="success">{notice}</Notice>
    <form className="business-card business-form" onSubmit={(event) => { event.preventDefault(); setSearchReload(searchReload + 1); }}><div className="business-field"><label htmlFor="coach-search">Find an account by name or email</label><input id="coach-search" value={search} onChange={(event) => setSearch(event.target.value)} disabled={busy} /></div><Button type="submit" disabled={searching || busy}>Search accounts</Button><p className="business-hint">Up to 100 matches are shown. Refine your search to find a specific account.</p></form>
    {loading ? <Loading message="Loading coach assignments..." /> : <>
      <form className="business-card business-form" onSubmit={(event) => { event.preventDefault(); if (event.currentTarget.reportValidity()) mutate(() => api.post("/club-coaches", { club_id: Number(clubId), user_id: Number(userId) }), "Coach assigned."); }}>
        <div className="business-field"><label htmlFor="coach-club">Club</label><select id="coach-club" value={clubId} onChange={(event) => setClubId(event.target.value)} required disabled={busy}><option value="">Choose a club</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select></div>
        <div className="business-field"><label htmlFor="coach-user">Account</label><select id="coach-user" value={userId} onChange={(event) => setUserId(event.target.value)} required disabled={searching || busy}><option value="">{searching ? "Loading accounts..." : "Choose an active account"}</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></div>
        <Button type="submit" disabled={busy || searching || !clubId || !userId}>Assign coach</Button>
      </form>
      <div className="business-record-list">{rows.length ? rows.map((row) => <article key={row.id} className="business-card business-record"><h2>{row.user_name}</h2><p>{row.club_name}</p><Button type="button" className="button-danger" disabled={busy} onClick={() => { if (window.confirm(`End ${row.user_name}'s coach assignment for ${row.club_name}?`)) mutate(() => api.delete(`/club-coaches/${row.id}`), "Coach assignment ended."); }}>End assignment</Button></article>) : <div className="business-card business-empty">No active coach assignments.</div>}</div>
    </>}
    <Button type="button" className="button-secondary" disabled={loading || busy} onClick={() => setReload(reload + 1)}>Refresh assignments</Button>
  </section>;
}
