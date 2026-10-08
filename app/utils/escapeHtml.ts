// One place for escaping text before it is placed into HTML. `escapeText` is
// for element content; `escapeAttr` also escapes quotes for attribute values.
export function escapeText(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function escapeAttr(s: string | null | undefined): string {
  return escapeText(s).replace(/"/g, '&quot;')
}
