/** Dates in the dashboard filters are days in Dutch time; the database stores UTC. */
const TIME_ZONE = 'Europe/Amsterdam';

const amsterdam = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function partsOf(instant: number): Record<string, number> {
  return Object.fromEntries(
    amsterdam.formatToParts(new Date(instant)).map((part) => [part.type, Number(part.value)]),
  );
}

/** How far Amsterdam clocks are ahead of UTC at this instant, in milliseconds. */
function offsetMs(instant: number): number {
  const p = partsOf(instant);
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) - instant;
}

/** The UTC instant at which a `yyyy-mm-dd` day starts in Amsterdam, as an ISO string. */
export function dayStartUtc(day: string, addDays = 0): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  const midnightUtc = Date.UTC(year, month - 1, date + addDays);
  return new Date(midnightUtc - offsetMs(midnightUtc)).toISOString();
}

/** `yyyy-mm` of an ISO time, in Amsterdam. */
export function amsterdamMonth(iso: string): string {
  const p = partsOf(Date.parse(iso));
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}
