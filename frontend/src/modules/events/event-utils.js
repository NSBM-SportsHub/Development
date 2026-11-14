export const categories = { tournament: 'Tournament', trial: 'Trials', camp: 'Training camp', sports_day: 'Sports day', other: 'Activity' };

export function currentEvents(events, now = Date.now()) {
  return events.filter((event) => Date.parse(event.ends_at) > now);
}

export function eventState(event, now = Date.now()) {
  if (Date.parse(event.ends_at) <= now) return 'Finished';
  return Date.parse(event.starts_at) <= now ? 'Happening now' : 'Coming up';
}

export function promotionVisibility(event, now = Date.now()) {
  if (!event.published) return { visible: false, label: 'Draft', reason: 'Publish this promotion when it is ready to appear on the home page.' };
  if (Date.parse(event.ends_at) <= now) return { visible: false, label: 'Finished · hidden from home page', reason: `Ended ${dateLabel(event.ends_at)} at ${timeLabel(event.ends_at)} (Sri Lanka time). Update the event dates to promote it again.` };
  if (['draft', 'cancelled', 'completed'].includes(event.tournament_status)) return { visible: false, label: 'Tournament unavailable · hidden from home page', reason: `The linked tournament is ${event.tournament_status}. Only upcoming or active tournaments appear publicly.` };
  return { visible: true, label: 'On home page', reason: event.featured ? 'Highlighted in the home page activity list.' : 'Appears in the activity list below the home page hero.' };
}

export function dateLabel(value) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date(value));
}

export function timeLabel(value) {
  return new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Colombo' }).format(new Date(value));
}

export function localInput(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
