export const categories = { tournament: 'Tournament', trial: 'Trials', camp: 'Training camp', sports_day: 'Sports day', other: 'Activity' };

export function currentEvents(events, now = Date.now()) {
  return events.filter((event) => Date.parse(event.ends_at) > now);
}

export function eventState(event, now = Date.now()) {
  if (Date.parse(event.ends_at) <= now) return 'Finished';
  return Date.parse(event.starts_at) <= now ? 'Happening now' : 'Coming up';
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
