import { watch } from 'vue'
import { RETRIEVAL_FORMS, RETRIEVAL_FORM_SECTIONS, RETRIEVAL_FORM_CONTENT, DEFAULT_RETRIEVAL_FORM_CONTENT, migrateChargingFormContent, DEFAULT_RETRIEVAL_FORMS, type RetrievalForm, type FormSection } from '~/data/retrievalForms'

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

function readStorage(raw: string): StoredShape | null {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.forms) || typeof parsed?.sections !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

function applyStored(saved: StoredShape) {
  RETRIEVAL_FORMS.splice(0, RETRIEVAL_FORMS.length, ...saved.forms)
  // Self-heal: nothing in this app ever deletes a seeded form outright - if
  // one of the two real seeded ids isn't in the saved snapshot's own `forms`
  // array, that snapshot was captured mid-corruption (e.g. while a broken
  // editor session held stale/partial state) and every reload since has just
  // been replaying that same gap. Re-add the real record rather than let a
  // form silently stay missing forever.
  for (const [id, defaultForm] of Object.entries(DEFAULT_RETRIEVAL_FORMS)) {
    if (!RETRIEVAL_FORMS.some(f => f.id === id)) RETRIEVAL_FORMS.push({ ...defaultForm })
  }
  for (const key of Object.keys(RETRIEVAL_FORM_SECTIONS)) delete RETRIEVAL_FORM_SECTIONS[key]
  Object.assign(RETRIEVAL_FORM_SECTIONS, saved.sections)
  for (const key of Object.keys(RETRIEVAL_FORM_CONTENT)) delete RETRIEVAL_FORM_CONTENT[key]
  Object.assign(RETRIEVAL_FORM_CONTENT, saved.content || {})
  // Self-heal: a stored snapshot that holds an empty/blank string for one of
  // the real seeded forms means an editor session lost its content at some
  // point, not that the form is genuinely meant to be blank - restore the
  // real default rather than let that empty string keep shadowing it forever.
  for (const [id, defaultHtml] of Object.entries(DEFAULT_RETRIEVAL_FORM_CONTENT)) {
    if (!RETRIEVAL_FORM_CONTENT[id]?.trim()) RETRIEVAL_FORM_CONTENT[id] = defaultHtml
  }
  // Saved charging forms pick up the current wording and per-asset columns.
  for (const id of Object.keys(RETRIEVAL_FORM_CONTENT)) RETRIEVAL_FORM_CONTENT[id] = migrateChargingFormContent(id, RETRIEVAL_FORM_CONTENT[id]!)
}

// Tracks the last string this tab itself wrote or read, so neither
// hydrateFormsFromStorage() nor writeStorage() below repeat work when
// nothing has actually changed since last time (see ticketStorage.ts's
// identical guard for the reasoning - the same needless-full-reapply-on-
// every-navigation churn applies here too).
let lastKnown: string | null = null

/** Called after the page itself (not just the app shell) has finished
 * rendering - applying a saved snapshot any earlier can get discarded once
 * the page's own render catches up a moment later. Safe to call again on
 * every later navigation too. */
export function hydrateFormsFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw || raw === lastKnown) return
  const saved = readStorage(raw)
  if (saved) {
    lastKnown = raw
    applyStored(saved)
  }
}

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
