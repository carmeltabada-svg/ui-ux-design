// Instants (when something happened) are stored as UTC ISO 8601 and formatted
// here, at display time, in the viewer's own time zone. A calendar date
// (Last Working Day, Target Date) is a different thing: 'YYYY-MM-DD' with no
// time zone, read with parseLocalDate and never passed through these.

/** The current moment as a UTC ISO instant. Use this, not a formatted string, for anything that is stored. */
export function nowISO(): string {
  return new Date().toISOString()
}

/**
 * The milliseconds for a stored time. Accepts a UTC ISO instant, and also the
 * older text form ("Sep 24, 2026, 2:41 PM", written in the writer's zone) that
 * tickets saved before this change still carry. NaN when it cannot be read.
 */
export function instantMs(when: string | null | undefined): number {
  if (!when) return Number.NaN
  return new Date(when.replace(' at ', ', ')).getTime()
}

/** "Sep 24, 2026, 2:41 PM" in the viewer's time zone. Returns the input unchanged when it is not a time. */
export function formatDateTime(when: string | null | undefined): string {
  const ms = instantMs(when)
  if (Number.isNaN(ms)) return when ?? ''
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** The viewer's time zone name, for example "Asia/Manila". */
export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
