import DataTable from "../../shared/DataTable.jsx";
import { Feedback } from "../../shared/Feedback.jsx";

function knockoutMatch(match) {
  const score = match.status === "completed" ? `${match.home_score} – ${match.away_score}` : "vs";
  return (
    <article className="standings-bracket-match" key={match.id}>
      <div><span>{match.home_name}</span><strong>{match.status === "completed" ? match.home_score : "—"}</strong></div>
      <div><span>{match.away_name}</span><strong>{match.status === "completed" ? match.away_score : "—"}</strong></div>
      {match.winner_name && <p>Winner: {match.winner_name}</p>}
      <span className="sr-only">Match score: {score}</span>
    </article>
  );
}

export default function Standings({ data, error, entries = [] }) {
  if (error) return <Feedback>{error}</Feedback>;
  if (!data) return null;

  if (data.format === "league") {
    const rows = data.standings.map((row) => ({
      ...row,
      difference_label: row.score_difference > 0 ? `+${row.score_difference}` : row.score_difference,
    }));
    return (
      <section className="standings-section" aria-labelledby="standings-title">
        <div className="tournament-section-heading">
          <div><p className="eyebrow">LEAGUE</p><h2 id="standings-title">Standings</h2></div>
          <span>Points → score difference → score for → name</span>
        </div>
        <DataTable
          caption="League standings, ranked by points, score difference, score for, then entry name"
          rows={rows}
          rowKey={(row) => row.entry_id}
          emptyMessage="Standings will appear once entries are approved."
          columns={[
            { key: "position", label: "Pos." },
            { key: "name", label: "Entry" },
            { key: "played", label: "P" },
            { key: "won", label: "W" },
            { key: "drawn", label: "D" },
            { key: "lost", label: "L" },
            { key: "score_for", label: "For" },
            { key: "score_against", label: "Against" },
            { key: "difference_label", label: "Diff." },
            { key: "points", label: "Pts" },
          ]}
        />
      </section>
    );
  }

  return (
    <section className="standings-section" aria-labelledby="standings-title">
      <div className="tournament-section-heading">
        <div><p className="eyebrow">KNOCKOUT</p><h2 id="standings-title">Bracket</h2></div>
        {data.champion && <strong className="knockout-champion">Champion: {data.champion.name}</strong>}
      </div>
      {data.rounds.length ? (
        <div className="knockout-rounds">
          {data.rounds.map((round) => (
            <section className="knockout-round" key={round.round_no} aria-label={`Round ${round.round_no}`}>
              <h3>Round {round.round_no}</h3>
              <div>{round.matches.map(knockoutMatch)}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="tournament-state"><h2>No bracket yet</h2><p>The knockout bracket will appear once fixtures have been drawn.</p></div>
      )}
      {!data.champion && data.remaining_entry_ids.length > 0 && (
        <p className="knockout-remaining">
          Still in the competition: {data.remaining_entry_ids.map((id) => entries.find((entry) => entry.id === id)?.name || `Entry ${id}`).join(", ")}.
        </p>
      )}
    </section>
  );
}
