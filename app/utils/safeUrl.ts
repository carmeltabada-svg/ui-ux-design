// Only these destinations may become a clickable link. A saved `javascript:`
// or `data:` URL in a template, form or exported email would otherwise run
// (or phish) for whoever opens it.
const SAFE_SCHEME = /^(https?:|mailto:|tel:)/i

/** Returns the trimmed URL when it is safe to link to, otherwise an empty string. Relative and fragment links are allowed. */
export function safeUrl(raw: string | null | undefined): string {
  const url = (raw ?? '').trim()
  if (!url) return ''
  if (SAFE_SCHEME.test(url)) return url
  // Anything else that names a scheme (`javascript:`, `data:`, `vbscript:`...) is refused.
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return ''
  return url
}
