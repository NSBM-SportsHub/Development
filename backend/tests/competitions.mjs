import assert from 'node:assert/strict';

// Tournaments, entries, fixtures, results and standings, using members created by the membership suite.
export async function testCompetitions({ check, Client, admin, clubs, sports, newStudent, students }) {
  const { alice, carol } = students;
  const badminton = clubs['Badminton Club'].id;
  const extras = {};
  for (const label of ['erin', 'frank', 'gina', 'hank', 'ivy']) {
    extras[label] = await newStudent(label);
    const applied = await extras[label].request('/memberships', {
      method: 'POST', body: { club_id: label === 'ivy' ? clubs['Second Badminton Club'].id : badminton },
    });
    assert.equal((await admin.request(`/memberships/${applied.data.id}`, { method: 'PATCH', body: { status: 'approved' } })).status, 200);
  }
  const { erin, frank, gina, hank, ivy } = extras;
  const outsider = await newStudent('zed');
  const league = { sport_id: sports.Badminton, name: `Doubles League ${Date.now()}`, format: 'league', starts_on: '2030-11-01', ends_on: '2030-11-30', min_team_size: 1, max_team_size: 2 };
  let leagueId;
  let cupId;
  let shuttleStars;
  const entries = {};
  let leagueMatches;

  async function setStatus(id, status) {
    return admin.request(`/tournaments/${id}`, { method: 'PATCH', body: { status } });
  }
  async function enter(client, tournamentId, name, members) {
    return client.request(`/tournaments/${tournamentId}/entries`, { method: 'POST', body: { name, member_ids: members.map((member) => member.id) } });
  }
  async function review(id, status, client = admin) {
    return client.request(`/tournament-entries/${id}`, { method: 'PATCH', body: { status } });
  }
  async function result(matchId, body) {
    return admin.request(`/matches/${matchId}/result`, { method: 'PUT', body });
  }

  await check('Only Admins create tournaments, with validated fields and references', async () => {
    assert.equal((await new Client().request('/tournaments')).status, 401);
    assert.equal((await alice.request('/tournaments', { method: 'POST', body: league })).status, 403);
    assert.equal((await admin.request('/tournaments', { method: 'POST', body: { ...league, format: undefined } })).status, 422);
    assert.equal((await admin.request('/tournaments', { method: 'POST', body: { ...league, format: 'swiss' } })).status, 422);
    assert.equal((await admin.request('/tournaments', { method: 'POST', body: { ...league, sport_id: 999999 } })).status, 422);
    assert.equal((await admin.request('/tournaments', { method: 'POST', body: { ...league, ends_on: '2030-10-01' } })).status, 422);
    assert.equal((await admin.request('/tournaments', { method: 'POST', body: { ...league, starts_on: '2030-02-30' } })).status, 422);
    assert.equal((await admin.request('/tournaments', { method: 'POST', body: { ...league, min_team_size: 3 } })).status, 422);
    assert.equal((await admin.request('/tournaments', { method: 'POST', body: { ...league, points_draw: 5 } })).status, 422);
    const created = await admin.request('/tournaments', { method: 'POST', body: league });
    assert.equal(created.status, 201);
    assert.equal(created.data.status, 'draft');
    assert.equal(created.data.sport_name, 'Badminton');
    leagueId = created.data.id;
    assert.equal((await admin.request('/tournaments', { method: 'POST', body: league })).status, 409);
  });

  await check('Draft tournaments are hidden from non-Admins and status changes follow the lifecycle', async () => {
    assert.equal((await alice.request(`/tournaments/${leagueId}`)).status, 404);
    assert.equal((await alice.request('/tournaments')).data.some((tournament) => tournament.id === leagueId), false);
    assert.equal((await enter(alice, leagueId, 'Too Early', [alice])).status, 404);
    assert.equal((await alice.request(`/tournaments/${leagueId}`, { method: 'PATCH', body: { status: 'registration_open' } })).status, 403);
    assert.equal((await setStatus(leagueId, 'in_progress')).status, 409);
    assert.equal((await setStatus(leagueId, 'registration_open')).data.status, 'registration_open');
    assert.equal((await alice.request(`/tournaments/${leagueId}`)).status, 200);
    const locked = await admin.request(`/tournaments/${leagueId}`, { method: 'PATCH', body: { format: 'knockout' } });
    assert.equal(locked.status, 409);
    assert.equal(locked.error.code, 'tournament_locked');
    assert.equal((await setStatus(leagueId, 'completed')).status, 409);
    assert.equal((await admin.request(`/tournaments/${leagueId}`, { method: 'PATCH', body: { description: 'Club doubles league' } })).data.description, 'Club doubles league');
  });

  await check('Entries require eligible, available members within the team-size limits', async () => {
    const eligible = (await alice.request(`/tournaments/${leagueId}/eligible-members`)).data.map((member) => member.user_id);
    for (const member of [alice, erin, frank, gina, hank, ivy]) assert.ok(eligible.includes(member.id));
    assert.equal(eligible.includes(carol.id), false);
    assert.equal((await enter(alice, leagueId, 'Mixed', [alice, carol])).status, 422);
    assert.equal((await enter(alice, leagueId, 'Outsiders', [alice, outsider])).status, 422);
    assert.equal((await enter(alice, leagueId, 'No Captain', [erin, frank])).status, 422);
    assert.equal((await enter(alice, leagueId, 'Too Many', [alice, erin, frank])).status, 422);
    assert.equal((await alice.request(`/tournaments/${leagueId}/entries`, { method: 'POST', body: { name: 'Dupes', member_ids: [alice.id, alice.id] } })).status, 422);
    assert.equal((await alice.request(`/tournaments/${leagueId}/entries`, { method: 'POST', body: { name: 'Bad', member_ids: 'all' } })).status, 422);
    const created = await enter(alice, leagueId, 'Shuttle Stars', [alice, erin]);
    assert.equal(created.status, 201);
    assert.equal(created.data.status, 'pending');
    assert.deepEqual(created.data.members.map((member) => member.user_id).sort(), [alice.id, erin.id].sort());
    shuttleStars = created.data.id;
    const taken = await enter(frank, leagueId, 'Frank and Erin', [frank, erin]);
    assert.equal(taken.status, 409);
    assert.equal(taken.error.code, 'already_entered');
    assert.equal((await enter(frank, leagueId, 'Shuttle Stars', [frank])).status, 409);
    assert.equal((await frank.request(`/tournaments/${leagueId}/eligible-members`)).data.some((member) => member.user_id === erin.id), false);
  });

  await check('Entry reviews reject students, members of the entry, and coaches reviewing themselves', async () => {
    assert.equal((await frank.request(`/tournament-entries/${shuttleStars}`)).status, 404);
    assert.equal((await review(shuttleStars, 'approved', frank)).status, 404);
    assert.equal((await review(shuttleStars, 'approved', erin)).status, 403);
    const coach = await admin.request('/club-coaches', { method: 'POST', body: { club_id: badminton, user_id: erin.id } });
    const self = await review(shuttleStars, 'approved', erin);
    assert.equal(self.status, 403);
    assert.equal(self.error.code, 'self_review');
    await admin.request(`/club-coaches/${coach.data.id}`, { method: 'DELETE' });
    const approved = await review(shuttleStars, 'approved');
    assert.equal(approved.status, 200);
    assert.equal(approved.data.status, 'approved');
    assert.equal((await review(shuttleStars, 'rejected')).status, 409);
  });

  await check('Withdrawn entries release their members; the rest of the league field is approved', async () => {
    const temporary = await enter(frank, leagueId, 'Temporary', [frank]);
    assert.equal((await review(temporary.data.id, 'withdrawn')).status, 403);
    assert.equal((await review(temporary.data.id, 'withdrawn', frank)).data.status, 'withdrawn');
    for (const [name, members] of [['Frank Solo', [frank]], ['Net Ninjas', [gina, hank]]]) {
      const created = await enter(members[0], leagueId, name, members);
      assert.equal(created.status, 201);
      entries[name] = created.data.id;
      assert.equal((await review(created.data.id, 'approved')).status, 200);
    }
    const visible = await outsider.request(`/tournaments/${leagueId}/entries`);
    assert.deepEqual(visible.data.map((entry) => entry.name).sort(), ['Frank Solo', 'Net Ninjas', 'Shuttle Stars']);
    assert.equal((await admin.request(`/tournaments/${leagueId}/entries`)).data.length, 4);
    assert.equal((await alice.request(`/tournaments/${leagueId}`)).data.approved_entries, 3);
  });

  await check('League fixtures are generated once as a full round-robin after registration closes', async () => {
    assert.equal((await admin.request(`/tournaments/${leagueId}/fixtures`, { method: 'POST' })).status, 409);
    assert.equal((await setStatus(leagueId, 'registration_closed')).status, 200);
    assert.equal((await enter(ivy, leagueId, 'Late', [ivy])).status, 409);
    assert.equal((await alice.request(`/tournaments/${leagueId}/fixtures`, { method: 'POST' })).status, 403);
    const generated = await admin.request(`/tournaments/${leagueId}/fixtures`, { method: 'POST' });
    assert.equal(generated.status, 201);
    leagueMatches = generated.data;
    assert.equal(leagueMatches.length, 3);
    const pairs = leagueMatches.map((match) => [match.home_entry_id, match.away_entry_id].sort().join('-'));
    assert.equal(new Set(pairs).size, 3);
    assert.equal((await admin.request(`/tournaments/${leagueId}/fixtures`, { method: 'POST' })).status, 409);
    assert.equal((await outsider.request(`/tournaments/${leagueId}/matches`)).data.length, 3);
  });

  await check('Knockout entries respect the entry limit', async () => {
    const cup = await admin.request('/tournaments', {
      method: 'POST', body: { sport_id: sports.Badminton, name: `Singles Cup ${Date.now()}`, format: 'knockout', starts_on: '2030-12-01', ends_on: '2030-12-02', max_entries: 5 },
    });
    assert.equal(cup.status, 201);
    cupId = cup.data.id;
    await setStatus(cupId, 'registration_open');
    for (const member of [alice, erin, frank, gina, hank]) {
      const created = await enter(member, cupId, `Player ${member.id}`, [member]);
      assert.equal(created.status, 201);
      entries[`cup-${member.id}`] = created.data.id;
      assert.equal((await review(created.data.id, 'approved')).status, 200);
    }
    const full = await enter(ivy, cupId, 'Ivy', [ivy]);
    assert.equal(full.status, 409);
    assert.equal(full.error.code, 'tournament_full');
    assert.equal((await admin.request(`/tournaments/${cupId}`, { method: 'PATCH', body: { max_entries: 4 } })).status, 409);
  });

  await check('Manual fixtures reject entries from other tournaments, duplicates and invalid venues', async () => {
    const body = { home_entry_id: shuttleStars, away_entry_id: entries['Frank Solo'], round_no: 9 };
    const crossed = await admin.request(`/tournaments/${leagueId}/matches`, { method: 'POST', body: { ...body, away_entry_id: entries[`cup-${gina.id}`] } });
    assert.equal(crossed.status, 422);
    assert.ok(crossed.error.fields.away_entry_id);
    assert.equal((await admin.request(`/tournaments/${leagueId}/matches`, { method: 'POST', body: { ...body, away_entry_id: shuttleStars } })).status, 422);
    assert.equal((await admin.request(`/tournaments/${leagueId}/matches`, { method: 'POST', body: { ...body, facility_id: 999999 } })).status, 422);
    assert.equal((await admin.request(`/tournaments/${leagueId}/matches`, { method: 'POST', body: { ...body, scheduled_at: 'tomorrow' } })).status, 422);
    assert.equal((await alice.request(`/tournaments/${leagueId}/matches`, { method: 'POST', body })).status, 403);
    const facility = await admin.request('/facilities', { method: 'POST', body: { name: `Court ${Date.now()}` } });
    const created = await admin.request(`/tournaments/${leagueId}/matches`, {
      method: 'POST', body: { ...body, scheduled_at: '2030-11-20T16:00:00+05:30', facility_id: facility.data.id, venue: 'Court 1' },
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.scheduled_at, '2030-11-20T10:30:00Z');
    assert.equal(created.data.facility_name, facility.data.name);
    const clash = await admin.request(`/tournaments/${leagueId}/matches`, { method: 'POST', body: { ...body, away_entry_id: entries['Net Ninjas'] } });
    assert.equal(clash.status, 409);
    assert.equal(clash.error.code, 'entry_already_scheduled');
    assert.equal((await admin.request(`/matches/${created.data.id}`, { method: 'PATCH', body: { status: 'postponed', venue: null } })).data.status, 'postponed');
    assert.equal((await admin.request(`/matches/${created.data.id}`, { method: 'PATCH', body: { status: 'completed' } })).status, 422);
    assert.equal((await admin.request(`/matches/${created.data.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await admin.request(`/matches/${created.data.id}`)).data.status, 'cancelled');
  });

  await check('League results are recorded in progress, draws have no winner, and standings are calculated', async () => {
    const [first, second, third] = leagueMatches;
    assert.equal((await result(first.id, { home_score: 2, away_score: 1 })).status, 409);
    assert.equal((await setStatus(leagueId, 'in_progress')).data.status, 'in_progress');
    assert.equal((await alice.request(`/matches/${first.id}/result`, { method: 'PUT', body: { home_score: 1, away_score: 0 } })).status, 403);
    assert.equal((await result(first.id, { home_score: -1, away_score: 0 })).status, 422);
    assert.equal((await result(first.id, { home_score: 2, away_score: 1, winner_entry_id: first.away_entry_id })).status, 422);
    assert.equal((await result(second.id, { home_score: 1, away_score: 1, winner_entry_id: second.home_entry_id })).status, 422);
    const recorded = await result(first.id, { home_score: 2, away_score: 1 });
    assert.equal(recorded.status, 200);
    assert.equal(recorded.data.status, 'completed');
    assert.equal(recorded.data.winner_entry_id, first.home_entry_id);
    assert.equal((await result(second.id, { home_score: 1, away_score: 1 })).data.winner_entry_id, null);
    assert.equal((await result(third.id, { home_score: 0, away_score: 3 })).data.winner_entry_id, third.away_entry_id);
    const expected = new Map();
    const add = (id, points, scored, conceded) => {
      const row = expected.get(id) ?? { points: 0, played: 0, diff: 0 };
      expected.set(id, { points: row.points + points, played: row.played + 1, diff: row.diff + scored - conceded });
    };
    add(first.home_entry_id, 3, 2, 1); add(first.away_entry_id, 0, 1, 2);
    add(second.home_entry_id, 1, 1, 1); add(second.away_entry_id, 1, 1, 1);
    add(third.home_entry_id, 0, 0, 3); add(third.away_entry_id, 3, 3, 0);
    const table = (await outsider.request(`/tournaments/${leagueId}/standings`)).data;
    assert.equal(table.format, 'league');
    for (const row of table.standings) {
      assert.equal(row.points, expected.get(row.entry_id).points);
      assert.equal(row.played, expected.get(row.entry_id).played);
      assert.equal(row.score_difference, expected.get(row.entry_id).diff);
    }
    assert.deepEqual(table.standings.map((row) => row.position), [1, 2, 3]);
    assert.ok(table.standings[0].points >= table.standings[1].points && table.standings[1].points >= table.standings[2].points);
  });

  await check('Admins correct results until the tournament completes, then the record is locked', async () => {
    const [first] = leagueMatches;
    assert.equal((await result(first.id, { home_score: 0, away_score: 0, result_notes: 'Corrected scoresheet' })).data.winner_entry_id, null);
    const row = (await alice.request(`/tournaments/${leagueId}/standings`)).data.standings.find((entry) => entry.entry_id === first.home_entry_id);
    assert.equal(row.drawn >= 1, true);
    assert.equal((await admin.request(`/matches/${first.id}`, { method: 'DELETE' })).status, 409);
    assert.equal((await setStatus(leagueId, 'completed')).data.status, 'completed');
    assert.equal((await result(first.id, { home_score: 5, away_score: 0 })).status, 409);
    assert.equal((await admin.request(`/tournaments/${leagueId}`, { method: 'PATCH', body: { name: 'Renamed' } })).status, 409);
    assert.equal((await admin.request(`/tournaments/${leagueId}`, { method: 'DELETE' })).status, 409);
  });

  await check('Knockout rounds use byes, need winners, and are drawn only after the previous round', async () => {
    await setStatus(cupId, 'registration_closed');
    await setStatus(cupId, 'in_progress');
    const roundOne = await admin.request(`/tournaments/${cupId}/fixtures`, { method: 'POST' });
    assert.equal(roundOne.status, 201);
    assert.equal(roundOne.data.length, 1);
    assert.equal((await admin.request(`/tournaments/${cupId}/fixtures`, { method: 'POST' })).status, 409);
    const [opening] = roundOne.data;
    assert.equal((await result(opening.id, { home_score: 2, away_score: 2 })).status, 422);
    assert.equal((await result(opening.id, { home_score: 2, away_score: 2, winner_entry_id: opening.away_entry_id })).data.winner_entry_id, opening.away_entry_id);
    const roundTwo = await admin.request(`/tournaments/${cupId}/fixtures`, { method: 'POST' });
    assert.equal(roundTwo.data.length, 2);
    assert.ok(roundTwo.data.every((match) => match.round_no === 2));
    const playing = roundTwo.data.flatMap((match) => [match.home_entry_id, match.away_entry_id]);
    assert.equal(playing.includes(opening.home_entry_id), false);
    const locked = await result(opening.id, { home_score: 3, away_score: 0 });
    assert.equal(locked.status, 409);
    assert.equal(locked.error.code, 'result_locked');
    for (const match of roundTwo.data) {
      assert.equal((await result(match.id, { home_score: 2, away_score: 0 })).status, 200);
    }
    const final = await admin.request(`/tournaments/${cupId}/fixtures`, { method: 'POST' });
    assert.equal(final.data.length, 1);
    assert.equal(final.data[0].round_no, 3);
    assert.equal((await setStatus(cupId, 'completed')).status, 409);
    assert.equal((await result(final.data[0].id, { home_score: 1, away_score: 4 })).status, 200);
    assert.equal((await admin.request(`/tournaments/${cupId}/fixtures`, { method: 'POST' })).status, 409);
    const bracket = (await alice.request(`/tournaments/${cupId}/standings`)).data;
    assert.equal(bracket.format, 'knockout');
    assert.deepEqual(bracket.rounds.map((round) => round.matches.length), [1, 2, 1]);
    assert.equal(bracket.champion.entry_id, final.data[0].away_entry_id);
    assert.equal((await setStatus(cupId, 'completed')).data.status, 'completed');
  });

  await check('Unknown competition routes and methods return safe JSON errors', async () => {
    assert.equal((await admin.request(`/tournaments/${leagueId}/unknown`)).status, 404);
    assert.equal((await admin.request(`/matches/${leagueMatches[0].id}/result`)).status, 405);
    assert.equal((await admin.request('/tournaments/999999')).status, 404);
    assert.equal((await admin.request('/tournament-entries/999999')).status, 404);
  });
}
