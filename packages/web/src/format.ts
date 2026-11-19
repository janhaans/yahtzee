const amsterdam = new Intl.DateTimeFormat('nl-NL', {
  timeZone: 'Europe/Amsterdam',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Shows a UTC time from the server in Dutch time, as `dd-mm-yyyy HH:mm`. */
export function formatDateTime(iso: string): string {
  const parts = Object.fromEntries(
    amsterdam.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}`;
}
