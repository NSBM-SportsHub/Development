import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../shared/api.js";
import { Button, Loading, Notice } from "../../shared/ui.jsx";

const config = {
  facilities: { title: "Facilities", singular: "facility", detail: (item) => [item.location, item.capacity ? `Capacity ${item.capacity}` : ""].filter(Boolean).join(" · ") },
  equipment: { title: "Equipment", singular: "equipment item", detail: (item) => `${item.total_quantity} available` },
};

export default function ResourceList({ type, isAdmin }) {
  const location = useLocation();
  const { title, singular, detail } = config[type];
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [reload, setReload] = useState(0);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get(`/${type}`, { signal });
      if (!signal.aborted) setRecords(data);
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message);
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reload]);

  async function archive(record) {
    if (busyId !== null) return;
    if (!window.confirm(`Archive ${record.name}? Existing booking history will be preserved.`)) return;
    setBusyId(record.id);
    setError("");
    setNotice("");
    try {
      await api.delete(`/${type}/${record.id}`);
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setNotice(`${record.name} has been archived.`);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusyId(null);
    }
  }

  return <section className="business-page" aria-labelledby={`${type}-title`}>
    <header className="business-heading"><div><p className="business-eyebrow">SPORTS RESOURCES</p><h1 id={`${type}-title`}>{title}</h1><p>Browse active {type} and their details.</p></div>{isAdmin && <Link className="button button-primary business-create" to={`/${type}/new`}>Add {singular}</Link>}</header>
    <Notice>{error}</Notice><Notice type="success">{location.state?.notice || notice}</Notice>
    {loading ? <Loading message={`Loading ${type}…`} /> : records.length === 0 ? <div className="business-card business-empty"><h2>No {type} found</h2><p>{error ? "Try loading the list again." : "There are no active records to show."}</p>{error && <Button type="button" onClick={() => setReload((value) => value + 1)}>Try again</Button>}</div> : <div className="business-resource-grid">
      {records.map((record) => <article className="business-card business-resource" key={record.id}>
        <div className="business-record-head"><div><p className="business-eyebrow">{type === "facilities" ? "FACILITY" : "EQUIPMENT"}</p><h2>{record.name}</h2></div>{isAdmin && Number(record.is_active) === 0 && <span className="business-status status-ended">Archived</span>}</div>
        <p className="business-resource-detail">{detail(record) || "Details not provided"}</p>
        {record.description && <p className="business-note">{record.description}</p>}
        {isAdmin && Number(record.is_active) !== 0 && <div className="business-actions"><Link className="button button-secondary" to={`/${type}/${record.id}/edit`}>Edit</Link><Button type="button" className="button-danger" busy={busyId === record.id} disabled={busyId !== null} onClick={() => archive(record)}>{busyId === record.id ? "Archiving…" : "Archive"}</Button></div>}
      </article>)}
    </div>}
  </section>;
}
