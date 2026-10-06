import { watch } from 'vue'
import { RETRIEVAL_FORMS, RETRIEVAL_FORM_SECTIONS, RETRIEVAL_FORM_CONTENT, type RetrievalForm, type FormSection } from '~/data/retrievalForms'

// Without this, RETRIEVAL_FORMS/RETRIEVAL_FORM_SECTIONS only ever exist in
// one tab's JS memory - there's no backend, so a builder edit (background,
// a field, a new button link, the submit-button toggle...) never left the
// tab that made it. Opening "Preview" in a new tab, or just refreshing, ran
// this module fresh from its static seed data and looked like the edit had
// been silently discarded, or like the preview was rendering some other
// unrelated "example" form.
//
// localStorage is the one thing that already survives a fresh page load in
// the same browser, so builder writes go there too (debounced), a fresh
// load reads it back before seed data would otherwise be all there is, and
// a `storage` event lets an already-open preview tab pick up a change made
// in another tab live, without a manual reload.
const STORAGE_KEY = 'ams:retrievalForms:v1'

interface StoredShape {
  forms: RetrievalForm[]
  sections: Record<string, FormSection[]>
  /** optional only for backward compat with a snapshot saved before the Umo
   * migration added this store - absent there, never absent going forward. */
  content?: Record<string, string>
}

function readStorage(): StoredShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.forms) || typeof parsed?.sections !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function applyStored(saved: StoredShape) {
  RETRIEVAL_FORMS.splice(0, RETRIEVAL_FORMS.length, ...saved.forms)
  for (const key of Object.keys(RETRIEVAL_FORM_SECTIONS)) delete RETRIEVAL_FORM_SECTIONS[key]
  Object.assign(RETRIEVAL_FORM_SECTIONS, saved.sections)
  for (const key of Object.keys(RETRIEVAL_FORM_CONTENT)) delete RETRIEVAL_FORM_CONTENT[key]
  Object.assign(RETRIEVAL_FORM_CONTENT, saved.content || {})
}

/** Called after the page itself (not just the app shell) has finished
 * rendering - applying a saved snapshot any earlier can get discarded once
 * the page's own render catches up a moment later. Safe to call again on
 * every later navigation too. */
export function hydrateFormsFromStorage() {
  const saved = readStorage()
  if (saved) applyStored(saved)
}

// Tracks the last string this tab itself wrote (or applied from another
// tab), so applying an incoming `storage` event doesn't turn straight around
// and write the identical content right back out - two open tabs would
// otherwise ping-pong the same unchanged snapshot back and forth.
let lastKnown: string | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined

function writeStorage() {
  clearTimeout(saveTimer)
  saveTimer = undefined
  const serialized = JSON.stringify({ forms: RETRIEVAL_FORMS, sections: RETRIEVAL_FORM_SECTIONS, content: RETRIEVAL_FORM_CONTENT })
  if (serialized === lastKnown) return
  lastKnown = serialized
  localStorage.setItem(STORAGE_KEY, serialized)
}

/**
 * Write the current state immediately, bypassing the debounce - call this
 * right before anything that's about to leave the tab behind (opening
 * /form-preview in a new tab, copying its link) so that action can never
 * race the debounce and carry a stale snapshot. The regular debounced path
 * still covers ordinary in-tab typing so it doesn't hammer localStorage on
 * every keystroke.
 */
export function flushFormsToStorage() {
  writeStorage()
}

export function watchFormsToStorage() {
  lastKnown = localStorage.getItem(STORAGE_KEY)

  watch([RETRIEVAL_FORMS, RETRIEVAL_FORM_SECTIONS, RETRIEVAL_FORM_CONTENT], () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(writeStorage, 80)
  }, { deep: true })

  // Another tab (e.g. a form left open in Preview) saved a change - pull it
  // in immediately instead of only picking it up on next reload.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue || e.newValue === lastKnown) return
    lastKnown = e.newValue
    try {
      applyStored(JSON.parse(e.newValue) as StoredShape)
    } catch {
      // ignore a malformed write from another tab
    }
  })
}
