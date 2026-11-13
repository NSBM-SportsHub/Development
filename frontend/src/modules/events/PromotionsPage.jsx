import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { Button, Field, Icon, Loading, Modal, Notice } from '../../shared/ui.jsx';
import { categories, dateLabel, eventState, localInput } from './event-utils.js';
import './events.css';

function fresh() {
  const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(9, 0, 0, 0);
  return { title: '', description: '', category: 'other', tournament_id: '', venue: '', starts_at: localInput(start), ends_at: localInput(new Date(start.getTime() + 7200000)), published: false, featured: true, display_order: 0 };
}

export default function PromotionsPage() {
  const [events, setEvents] = useState([]), [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [editor, setEditor] = useState(null), [values, setValues] = useState(fresh), [fields, setFields] = useState({}), [busy, setBusy] = useState(false);
  async function load() {
    const [result, competitions] = await Promise.all([api.get('/event-promotions'), api.get('/tournaments')]);
    setEvents(result.events); setTournaments(Array.isArray(competitions) ? competitions : competitions.tournaments || competitions.items || []);
  }
  useEffect(() => { let mounted = true; load().catch((failure) => { if (mounted) setError(failure.message); }).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, []);
  function edit(event) { setEditor(event || {}); setValues(event ? { ...event, tournament_id: event.tournament_id || '', starts_at: localInput(event.starts_at), ends_at: localInput(event.ends_at) } : fresh()); setFields({}); setError(''); setNotice(''); }
  function update(e) { const { name, value, type, checked } = e.target; setValues((old) => ({ ...old, [name]: type === 'checkbox' ? checked : value })); setFields((old) => ({ ...old, [name]: '' })); }
  async function save(e) {
    e.preventDefault(); if (busy) return; setBusy(true); setError(''); setFields({});
    try {
      const payload = Object.fromEntries(['title','description','category','venue','published','featured'].map((key) => [key, values[key]]));
      Object.assign(payload, { tournament_id: values.category === 'tournament' ? Number(values.tournament_id) : null, display_order: Number(values.display_order), starts_at: new Date(values.starts_at).toISOString().replace('.000', ''), ends_at: new Date(values.ends_at).toISOString().replace('.000', '') });
      const result = editor.id ? await api.patch(`/event-promotions/${editor.id}`, payload) : await api.post('/event-promotions', payload);
      await load(); setEditor(null); setNotice(`${result.title} saved. ${result.published ? 'Published events appear on the home page until they finish.' : 'This draft is visible only to Admins.'}`);
    } catch (failure) { setError(failure.message); setFields(failure.fields || {}); } finally { setBusy(false); }
  }
  async function banner(event, file) {
    if (busy || !file) return; setBusy(true); setError(''); setNotice('');
    try { const body = new FormData(); body.append('banner', file); await api.post(`/event-promotions/${event.id}/banner`, body); await load(); setNotice('Banner updated.'); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  async function remove(event, imageOnly = false) {
    if (busy || !window.confirm(imageOnly ? `Remove the banner for ${event.title}?` : `Remove ${event.title} from promotions? The saved record will be retained.`)) return;
    setBusy(true); setError(''); setNotice('');
    try { await api.delete(`/event-promotions/${event.id}${imageOnly ? '/banner' : ''}`); await load(); setNotice(imageOnly ? 'Banner removed.' : 'Promotion removed from the home page.'); }
    catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  if (loading) return <Loading message="Loading promotions…" />;
  const input = (name, label, props = {}) => <Field name={name} label={label} value={values[name]} onChange={update} error={fields[name]} disabled={busy} {...props} />;
  return <section className="promotion-manager"><div className="page-heading"><div><span className="eyebrow">CAMPUS SPOTLIGHT</span><h1>Home page promotions</h1><p>Publish tournaments and other activities. Choose up to five featured banners using the display order.</p></div><div className="promotion-heading-actions"><Link className="button button-secondary" to="/">View home page</Link><Button onClick={() => edit(null)} disabled={busy}><Icon name="plus" /> New promotion</Button></div></div><Notice>{!editor && error}</Notice><Notice type="success">{notice}</Notice><p className="promotion-help">Drafts, finished events and linked tournaments marked draft, cancelled or completed stay off the public page. Lower display order appears first. Upload JPEG, PNG or WebP banners up to 5 MB; a wide image works best.</p>{!events.length && <div className="card"><h2>Your next event starts here.</h2><p>Create a promotion, add the details and banner, then publish when ready.</p></div>}<div className="promotion-list">{events.map((event) => <article className="card promotion-row" key={event.id}><div className="promotion-preview">{event.banner_url ? <img src={event.banner_url} alt={`Banner for ${event.title}`} /> : <Icon name="calendar" size={38} />}</div><div className="promotion-description"><span className="eyebrow">{categories[event.category]} · {event.published ? 'Published' : 'Draft'} · {eventState(event)}</span><h2>{event.title}</h2><p>{dateLabel(event.starts_at)} · {event.venue}</p><small>{event.featured ? `Featured · order ${event.display_order}` : 'Event list only'}{event.tournament_status && ` · Tournament: ${event.tournament_status.replaceAll('_', ' ')}`}</small></div><div className="promotion-actions"><Button className="button-secondary" onClick={() => edit(event)} disabled={busy}>Edit {event.title}</Button><label className={`button button-secondary promotion-upload${busy ? ' is-disabled' : ''}`}>Upload banner<input aria-label={`Upload banner for ${event.title}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => { banner(event, e.target.files?.[0]); e.target.value = ''; }} /></label>{event.banner_url && <Button className="button-ghost" onClick={() => remove(event, true)} disabled={busy}>Remove banner</Button>}<Button className="button-ghost" onClick={() => remove(event)} disabled={busy}>Remove promotion</Button></div></article>)}</div>
    {editor && <Modal title={editor.id ? 'Edit promotion' : 'New promotion'} subtitle="Times are entered in your device’s local timezone and shown publicly in Sri Lanka time." onClose={() => setEditor(null)} busy={busy}><Notice>{error}</Notice><form className="promotion-form" onSubmit={save}>{input('title', 'Event title', { required: true, maxLength: 150 })}<div className="field"><label htmlFor="promotion-category">Activity type</label><select id="promotion-category" name="category" value={values.category} onChange={update} disabled={busy}>{Object.entries(categories).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>{values.category === 'tournament' && <div className="field"><label htmlFor="promotion-tournament">Tournament</label><select id="promotion-tournament" name="tournament_id" value={values.tournament_id} onChange={update} disabled={busy} required><option value="">Choose a tournament</option>{tournaments.map((item) => <option value={item.id} key={item.id}>{item.name} ({item.status.replaceAll('_', ' ')})</option>)}</select>{fields.tournament_id && <span className="field-error">{fields.tournament_id}</span>}</div>}{input('venue', 'Venue', { required: true, maxLength: 160 })}<div className="form-grid">{input('starts_at', 'Starts at', { type: 'datetime-local', required: true })}{input('ends_at', 'Ends at', { type: 'datetime-local', required: true })}</div><div className="field"><label htmlFor="promotion-description">Description & participation instructions</label><textarea id="promotion-description" name="description" value={values.description} onChange={update} rows={5} maxLength={6000} required disabled={busy} />{fields.description && <span className="field-error">{fields.description}</span>}</div>{input('display_order', 'Display order', { type: 'number', min: 0, max: 999, required: true })}<label className="promotion-check"><input type="checkbox" name="featured" checked={values.featured} onChange={update} disabled={busy} /> Feature in the home page carousel</label><label className="promotion-check"><input type="checkbox" name="published" checked={values.published} onChange={update} disabled={busy} /> Publish for everyone to see</label><p className="field-hint">Save first, then use Upload banner on the promotion card. Publishing shares these details publicly.</p><div className="promotion-heading-actions"><Button type="submit" busy={busy}>Save promotion</Button><Button type="button" className="button-secondary" disabled={busy} onClick={() => setEditor(null)}>Cancel</Button></div></form></Modal>}
  </section>;
}
