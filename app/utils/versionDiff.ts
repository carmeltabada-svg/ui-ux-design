import diff from 'microdiff'

type Change = ReturnType<typeof diff>[number]

export interface ChangeCategory {
  /** which changes belong to this category, given microdiff's own path array */
  match: (path: (string | number)[]) => boolean
  label: string
  /** optional full phrase built from just this category's own changes, e.g.
   * "2 fields" - replaces `label` outright when present (not appended to
   * it), so a category's detail should read fine entirely on its own. */
  detail?: (changes: Change[]) => string | undefined
}

/**
 * Turns two snapshots into a "what changed" version-history label using a
 * real structural diff (microdiff) instead of a hand-rolled field-by-field
 * comparison - the previous version-history logic only checked a handful of
 * top-level keys with `JSON.stringify(...) !== JSON.stringify(...)`, so it
 * couldn't say anything more specific than "form content updated" for any
 * edit touching sections/fields, and had no way to count how many things
 * actually changed. microdiff walks the full object tree and reports every
 * added/removed/changed path, so categories here can match on exactly which
 * nested path changed (a field's own label vs. the field being added at
 * all vs. a section's title) and report real counts.
 */
export function describeSnapshotChanges(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
  categories: ChangeCategory[]
): string | null {
  const changes = diff(prev, next)
  if (!changes.length) return null

  const parts: string[] = []
  for (const category of categories) {
    const own = changes.filter(c => category.match(c.path))
    if (!own.length) continue
    // `detail`, when present, is a complete phrase already ("3 sections",
    // "2 fields") - it replaces the bare category label rather than
    // decorating it, so this doesn't read as "sections (3 sections)".
    parts.push(category.detail?.(own) ?? category.label)
  }
  if (!parts.length) return null

  const phrase = parts.length === 1
    ? parts[0]!
    : `${parts.slice(0, -1).join(', ')}${parts.length > 2 ? ',' : ''} and ${parts[parts.length - 1]}`
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} updated`
}

/** Counts distinct values at a given path index across a set of changes -
 * e.g. how many distinct field indices were touched, so "fields" can report
 * "2 fields" instead of just "fields". */
export function countDistinctAt(changes: Change[], pathIndex: number): number {
  return new Set(changes.map(c => c.path[pathIndex])).size
}
