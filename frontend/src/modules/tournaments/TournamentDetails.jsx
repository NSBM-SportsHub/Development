import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../shared/api.js";
import { useAuth } from "../../shared/AuthContext.jsx";
import DataTable from "../../shared/DataTable.jsx";
import { Feedback } from "../../shared/Feedback.jsx";
import { FormField } from "../../shared/FormField.jsx";
import { Button, Loading } from "../../shared/ui.jsx";
import "./tournaments.css";

const entryStatusLabels = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function dateLabel(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export default function TournamentDetails() {
  const { tournamentId } = useParams();
  const { user } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [entries, setEntries] = useState([]);
  const [eligibleMembers, setEligibleMembers] = useState([]);
  const [coachAssignments, setCoachAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [coachError, setCoachError] = useState("");
  const [notice, setNotice] = useState("");
  const [values, setValues] = useState({ name: "", member_ids: [] });
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const [reviewNotes, setReviewNotes] = useState({});
  const [reloadKey, setReloadKey] = useState(0);

  const loadData = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    setCoachError("");
    try {
      const tournamentData = await api.get(`/tournaments/${tournamentId}`, { signal });
      const open = tournamentData.status === "registration_open";
      const [entryData, eligible, assignments] = await Promise.all([
        api.get(`/tournaments/${tournamentId}/entries`, { signal }),
        open ? api.get(`/tournaments/${tournamentId}/eligible-members`, { signal }) : Promise.resolve([]),
        user.role === "admin" ? Promise.resolve([]) : api.get(`/club-coaches?user_id=${user.id}`, { signal }).catch((failure) => {
          if (failure.name !== "AbortError") setCoachError(`Coach review access could not be checked: ${failure.message}`);
          return [];
        }),
      ]);
      if (!signal?.aborted) {
        setTournament(tournamentData);
        setEntries(entryData);
        setEligibleMembers(eligible);
        setCoachAssignments(assignments);
        setValues({ name: "", member_ids: eligible.some((member) => member.user_id === user.id) ? [String(user.id)] : [] });
      }
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [tournamentId, user.id, user.role]);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => controller.abort();
  }, [loadData, reloadKey]);

  const isCoachForSport = coachAssignments.some((assignment) => assignment.sport_id === tournament?.sport_id);
  const canReview = user.role === "admin" || isCoachForSport;
  const now = Date.now();
  const deadlinePassed = tournament?.registration_closes_at && new Date(tournament.registration_closes_at).valueOf() <= now;
  const full = tournament?.max_entries != null && tournament.approved_entries >= tournament.max_entries;
  const registrationOpen = tournament?.status === "registration_open" && !deadlinePassed && !full;
  const myEntry = useMemo(() => entries.find((entry) => (
    ["pending", "approved"].includes(entry.status)
    && entry.members.some((member) => member.user_id === user.id)
  )), [entries, user.id]);
  const reviewableEntries = canReview
    ? entries.filter((entry) => entry.status === "pending" && !entry.members.some((member) => member.user_id === user.id))
    : [];
  const membersForTable = useMemo(() => entries.map((entry) => ({
    ...entry,
    members_label: entry.members.map((member) => member.name).join(", "),
    status_label: entryStatusLabels[entry.status] || entry.status,
  })), [entries]);

  function toggleMember(memberId) {
    setValues((current) => ({
      ...current,
      member_ids: current.member_ids.includes(String(memberId))
        ? current.member_ids.filter((id) => id !== String(memberId))
        : [...current.member_ids, String(memberId)],
    }));
    setFields((current) => ({ ...current, member_ids: "" }));
  }

  async function register(event) {
    event.preventDefault();
    if (busy) return;
    const selected = values.member_ids.map(Number);
    if (selected.length < tournament.min_team_size || selected.length > tournament.max_team_size) {
      setFields({ member_ids: `Choose between ${tournament.min_team_size} and ${tournament.max_team_size} eligible members.` });
      return;
    }
    if (!selected.includes(user.id)) {
      setFields({ member_ids: "You must be included as the entry captain." });
      return;
    }
    setBusy(true);
    setError("");
    setFields({});
    try {
      const saved = await api.post(`/tournaments/${tournament.id}/entries`, {
        name: values.name.trim(),
        member_ids: selected,
      });
      setEntries((current) => [...current, saved]);
      setNotice("Entry submitted for review.");
      setValues({ name: "", member_ids: [] });
    } catch (failure) {
      setError(failure.message);
      setFields(failure.fields || {});
    } finally {
      setBusy(false);
    }
  }

  async function changeEntry(entry, status) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await api.patch(`/tournament-entries/${entry.id}`, {
        status,
        ...(status === "withdrawn" ? {} : { review_note: reviewNotes[entry.id]?.trim() || null }),
      });
      setEntries((current) => current.map((item) => item.id === saved.id ? saved : item));
      setNotice(status === "withdrawn" ? "Entry withdrawn." : `Entry ${status}.`);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading message="Loading tournament…" />;
  if (error && !tournament) {
    return <section className="tournament-details-page"><Feedback>{error}</Feedback><Button className="button-secondary" onClick={() => setReloadKey((value) => value + 1)}>Try again</Button></section>;
  }
  if (!tournament) return null;

  return (
    <section className="tournament-details-page" aria-labelledby="tournament-details-title">
      <Link className="tournament-back-link" to="/tournaments">← All tournaments</Link>
      <div className="tournament-detail-heading">
        <div>
          <p className="eyebrow">{tournament.sport_name} · {tournament.format}</p>
          <h1 id="tournament-details-title">{tournament.name}</h1>
          <p>{dateLabel(tournament.starts_on)} – {dateLabel(tournament.ends_on)}</p>
        </div>
        <Link className="button button-secondary" to={`/tournaments/${tournament.id}/matches`}>Fixtures &amp; results</Link>
      </div>
      <Feedback type="success">{notice}</Feedback>
      <Feedback>{error}</Feedback>
      <Feedback>{coachError}</Feedback>
      {tournament.description && <p className="tournament-detail-description">{tournament.description}</p>}

      <section className="tournament-entry-section" aria-labelledby="entries-title">
        <div className="tournament-section-heading">
          <div><p className="eyebrow">PARTICIPANTS</p><h2 id="entries-title">Tournament entries</h2></div>
          <span>{tournament.approved_entries} approved{tournament.max_entries ? ` / ${tournament.max_entries}` : ""}</span>
        </div>
        {myEntry && (
          <Feedback type="success">Your entry, &quot;{myEntry.name}&quot;, is {entryStatusLabels[myEntry.status]?.toLowerCase() || myEntry.status}.</Feedback>
        )}
        {membersForTable.length === 0 ? (
          <div className="tournament-state"><h2>No entries yet</h2><p>Approved entries and your own submissions will be shown here.</p></div>
        ) : (
          <DataTable
            caption="Tournament entry list"
            rowKey={(entry) => entry.id}
            rows={membersForTable}
            emptyMessage="No entries are available."
            columns={[
              { key: "name", label: "Entry" },
              { key: "captain_name", label: "Captain" },
              { key: "members_label", label: "Members" },
              { key: "status_label", label: "Status" },
              { key: "review_note", label: "Review note", render: (entry) => entry.review_note || "—" },
              {
                key: "actions",
                label: "Actions",
                render: (entry) => {
                  if (entry.captain_user_id === user.id && ["pending", "approved"].includes(entry.status) && ["registration_open", "registration_closed"].includes(tournament.status)) {
                    return <Button className="button-secondary button-small" disabled={busy} onClick={() => changeEntry(entry, "withdrawn")}>Withdraw</Button>;
                  }
                  if (canReview && entry.status === "pending" && !own) {
                    return (
                      <div className="entry-review-actions">
                        <FormField
                          label={`Review note for ${entry.name}`}
                          name={`review-note-${entry.id}`}
                          value={reviewNotes[entry.id] || ""}
                          onChange={(event) => setReviewNotes((current) => ({ ...current, [entry.id]: event.target.value }))}
                          maxLength={1000}
                        />
                        <div>
                          <Button className="button-secondary button-small" disabled={busy} onClick={() => changeEntry(entry, "approved")}>Approve</Button>
                          <Button className="button-danger button-small" disabled={busy} onClick={() => changeEntry(entry, "rejected")}>Reject</Button>
                        </div>
                      </div>
                    );
                  }
                  return "—";
                },
              },
            ]}
          />
        )}
      </section>

      {registrationOpen && !myEntry && (
        <section className="tournament-entry-form-section" aria-labelledby="register-entry-title">
          <h2 id="register-entry-title">Register an entry</h2>
          <p>Captain and team members must have an approved membership in a non-archived {tournament.sport_name} club.</p>
          {eligibleMembers.length === 0 ? (
            <Feedback>No eligible members are available. Confirm that you and your teammates have approved memberships in a {tournament.sport_name} club.</Feedback>
          ) : (
            <form onSubmit={register}>
              <Feedback>{fields.name || fields.member_ids}</Feedback>
              <div className="entry-registration-fields">
                <FormField
                  label="Team or entrant name"
                  name="name"
                  value={values.name}
                  onChange={(event) => {
                    setValues((current) => ({ ...current, name: event.target.value }));
                    setFields((current) => ({ ...current, name: "" }));
                  }}
                  minLength={2}
                  maxLength={120}
                  required
                  error={fields.name}
                  disabled={busy}
                />
                <fieldset className="eligible-member-list" aria-describedby={fields.member_ids ? "eligible-members-error" : "eligible-members-help"}>
                  <legend>Team members ({tournament.min_team_size}–{tournament.max_team_size})</legend>
                  <p id="eligible-members-help">You must select yourself as captain and include each teammate.</p>
                  {eligibleMembers.map((member) => (
                    <label className="eligible-member" key={member.user_id}>
                      <input
                        type="checkbox"
                        checked={values.member_ids.includes(String(member.user_id))}
                        disabled={busy || member.user_id === user.id}
                        onChange={() => toggleMember(member.user_id)}
                      />
                      <span><strong>{member.name}{member.user_id === user.id ? " (you, captain)" : ""}</strong><small>{member.clubs}</small></span>
                    </label>
                  ))}
                  {fields.member_ids && <span className="field-error" id="eligible-members-error">{fields.member_ids}</span>}
                </fieldset>
              </div>
              <Button type="submit" busy={busy}>{busy ? "Submitting…" : "Submit entry"}</Button>
            </form>
          )}
        </section>
      )}
      {tournament.status === "registration_open" && !registrationOpen && (
        <Feedback>{deadlinePassed ? "The registration deadline has passed." : "This tournament has reached its entry limit."}</Feedback>
      )}
      {canReview && reviewableEntries.length === 0 && (
        <p className="tournament-review-hint">There are no pending entries available for your review.</p>
      )}
    </section>
  );
}
