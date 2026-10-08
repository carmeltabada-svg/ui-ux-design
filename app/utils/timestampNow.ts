/** "Oct 7, 2026, 3:04 PM": the saved-at label used on version history entries. Fixed to en-US so it reads the same in every browser. */
export function timestampNow(): string {
  return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
