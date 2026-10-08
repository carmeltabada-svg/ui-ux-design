<script setup lang="ts">
import {
  RETRIEVAL_FORMS,
  RETRIEVAL_FORM_SECTIONS,
  RETRIEVAL_FORM_CONTENT,
  FORM_VERSIONS,
  SEEDED_FORM_IDS,
  PAGE_SIZES,
  DEFAULT_PAGE_MARGINS,
  MARGIN_PRESETS,
  matchMarginPreset,
  createDraftForm,
  duplicateForm,
  type FormSection,
  type FormBackground,
  type PageSize,
  type PageMargins,
  type MarginPresetName
} from '~/data/retrievalForms'
import type { DropdownMenuItem } from '@nuxt/ui'
import { CURRENT_USER_NAME, ensureTemplateRuntime, CUSTOM_TEMPLATE_IDS } from '~/data/templateRuntime'
import { TEMPLATE_GROUPS, TOKEN_GROUPS, extractTokenCodes } from '~/data/templates'
import { flushFormsToStorage, hydrateFormsFromStorage } from '~/utils/formStorage'
import { describeSnapshotChanges, countDistinctAt, type ChangeCategory } from '~/utils/versionDiff'
import { provideFormFieldRegistry } from '~/utils/formFieldRegistry'
import { provideFormFieldsInteractive } from '~/utils/formFieldsInteractive'
import { provideFormAttachedToEmail, provideFormMode } from '~/utils/formEmailAttachment'
import { ensureFormContent } from '~/utils/formContentMigration'
import { buildFormLetterhead } from '~/utils/formLetterhead'

// force a full remount when the id changes (e.g. the new-draft -> real-id
// redirect below) - Vue Router reuses this component instance across
// dynamic-segment changes by default, which left setup() reading a stale
// route.params.id right after that redirect.
definePageMeta({ key: route => route.fullPath })

const route = useRoute()
const toast = useToast()

// The formStorage.client.ts plugin also calls this, but only on Nuxt's
// `page:finish` hook - which fires *after* this component's own setup runs.
// That's fine for `RETRIEVAL_FORMS`/`RETRIEVAL_FORM_SECTIONS` (this page
// only reads them once, synchronously below, and nothing re-reads them
// later), but it's too late for `content` further down: MasterDataFormDocumentEditor
// treats its initial content as just that - initial - so if the editor
// instance had already mounted with pre-hydration content by the time
// hydration ran, it never picks up the real saved value at all (confirmed
// the hard way: an insert survived in localStorage but the editor kept
// showing the pre-hydration field count on every reload, even though the
// stored value momentarily *was* correct). Calling this here, synchronously,
// before anything else reads the shared stores - same as /form-preview.vue
// already does - closes that race instead of relying on the plugin's timing.
if (import.meta.client) hydrateFormsFromStorage()

const formId = computed(() => route.params.id as string)
const existing = computed(() => RETRIEVAL_FORMS.find(f => f.id === formId.value))

let redirecting = false

// RETRIEVAL_FORMS is a plain in-memory module array standing in for a real
// database - it's shared across every request on a long-running dev server,
// so mutating it during SSR (as this used to) leaks one request's new draft
// into every other concurrent/subsequent request, and diverges from the
// client's own fresh copy of the module (hydration mismatch). Only ever
// create/mutate it client-side; SSR just renders a throwaway placeholder for
// the instant before the client redirects to the draft's real id.
if (import.meta.client) {
  if (route.params.id === 'new') {
    const draft = createDraftForm()
    RETRIEVAL_FORMS.push(draft)
    RETRIEVAL_FORM_SECTIONS[draft.id] = []
    redirecting = true
    await navigateTo(`/templates/forms/${draft.id}/edit?created=1`, { replace: true })
  } else if (!existing.value) {
    redirecting = true
    await navigateTo('/templates?tab=forms')
  }
} else if (route.params.id === 'new' || !existing.value) {
  redirecting = true
}

const activeForm = redirecting ? createDraftForm() : existing.value!

const name = ref(activeForm.name)
const description = ref(activeForm.description)
const mode = ref<'onsite' | 'remote'>(activeForm.mode)
const status = ref<'active' | 'draft' | 'retired'>(activeForm.status)
// themeColor is kept only as the default fallback color for sections that
// haven't picked their own - each section already has its own color picker,
// so this is no longer a separate top-bar control (goal: the top-bar
// "Appearance" control is just the overall form background now).
const themeColor = ref(activeForm.themeColor)
const background = ref<FormBackground | undefined>(activeForm.background)
const pageSize = ref<PageSize>(activeForm.pageSize || 'letter')
const margins = ref<PageMargins>(activeForm.margins ? { ...activeForm.margins } : { ...DEFAULT_PAGE_MARGINS })

// --- Page-break preview -------------------------------------------------
// Real pagination (tiptap-pagination-plus, see FormDocumentEditor.vue) now
// runs live in this same edit canvas, wired directly to this form's own
// `pageSize` - what you see while editing is what /form-preview and print
// will actually produce, not an approximation of it.

const nameManuallySet = ref(!!activeForm.nameManuallySet)
// Off by default - most forms here are acknowledgements a team member just
// reads and signs, not something with a distinct "submission" step. Turned
// on per-form from the overflow menu when a form actually needs one.
const showSubmitButton = ref(!!activeForm.showSubmitButton)

const DESCRIPTION_MAX = 140

// Legacy - no longer rendered (the document canvas below replaces it), kept
// only as the source for the one-time migration into `content` just below,
// and because undo/redo and version history still snapshot it (seed data for
// the next real cleanup pass, not touched further this round).
const sections = ref<FormSection[]>(deepClone(RETRIEVAL_FORM_SECTIONS[formId.value] ?? []))

// The Tiptap document itself - the actual canvas content now, replacing
// sections/fields as the thing a team member edits. Migrated once, lazily,
// the first time a form is opened after this - a form that already has real
// document content just uses it; one that doesn't yet gets converted from
// its old `sections` (see ~/utils/formContentMigration.ts) and that
// conversion is written back immediately so it only ever runs once per form.
ensureFormContent(formId.value)
// A live computed onto the reactive store, not a one-time snapshot ref -
// localStorage hydration (see app/plugins/formStorage.client.ts) runs on the
// Nuxt `page:finish` hook, which fires *after* this component's own setup,
// so a plain `ref(RETRIEVAL_FORM_CONTENT[formId.value])` taken here would
// permanently miss whatever hydration loads a moment later (confirmed the
// hard way: an inserted field survived in localStorage but vanished on
// reload, because the ref had already snapshotted the pre-hydration - i.e.
// freshly re-migrated, seed-only - content before hydration overwrote the
// real saved value underneath it). A computed re-reads the store's current
// value on every access, so it can never go stale regardless of when
// hydration happens to run relative to setup.
const content = computed({
  get: () => RETRIEVAL_FORM_CONTENT[formId.value] ?? '',
  set: (value: string) => { RETRIEVAL_FORM_CONTENT[formId.value] = value }
})

// Read-only browsing of the placeholder library, outside edit mode.
const placeholderBrowseOpen = ref(false)
const browseUsedCodes = computed(() => extractTokenCodes(content.value))

// Every FormFieldNodeView registers its own filled/required state here (see
// ~/utils/formFieldRegistry.ts) - the document-canvas replacement for the old
// per-field `fieldValues` map, now populated by Tiptap NodeViews instead of
// MasterDataFormDocumentField rows.
const fieldRegistry = provideFormFieldRegistry()
const hasUnfilledRequired = computed(() =>
  Object.values(fieldRegistry).some(entry => entry.required && !entry.filled)
)

// The same repeating per-page letterhead the standalone /form-preview link
// renders - see ~/utils/formLetterhead.ts. Kept as a computed here (not
// built inline in the template) since FormDocumentEditor only re-applies a
// header/footer change via an explicit watcher, not a full re-render.
const letterhead = computed(() => buildFormLetterhead({ name: name.value, themeColor: themeColor.value, category: activeForm.category }, mode.value))

// The document canvas's own toolbar (see FormDocumentToolbar.vue) is a
// separate, full-width bar this page attaches directly under its own
// header - not something FormDocumentEditor renders inside its own
// padded/bordered panel. It talks to the document through the editor
// instance FormDocumentEditor exposes via defineExpose, reached here
// through this template ref.
const documentEditorRef = ref()
const documentEditor = computed(() => (documentEditorRef.value as { editor?: import('@tiptap/vue-3').Editor } | undefined)?.editor)

const viewMode = ref<'read' | 'edit'>(
  route.query.created === '1' || route.query.mode === 'edit' ? 'edit' : 'read'
)
// Fields are only fillable while actively editing/designing the form (so a
// field can be test-filled while building it, matching the pre-Umo builder's
// own `:interactive="viewMode === 'edit'"` behavior) - the read view is a
// pure structural preview, not something a team member fills out here (that
// only ever happens through the standalone /form-preview link, which
// provides this as always-true regardless of this page's own viewMode).
provideFormFieldsInteractive(computed(() => viewMode.value === 'edit'))

// True once this form is attached as the retrieval-form attachment on at
// least one email template - walks every template key the same way the
// Templates list/picker does (the seeded TEMPLATE_GROUPS plus any
// runtime-created templates), same lookup the old (now-removed)
// `isAttachedToEmail` computed used before the Umo Editor migration.
const isAttachedToEmail = computed(() => {
  const allKeys = [...TEMPLATE_GROUPS.flatMap(g => g.keys), ...CUSTOM_TEMPLATE_IDS]
  return allKeys.some(key => ensureTemplateRuntime(key).attachmentFormId === formId.value)
})
provideFormAttachedToEmail(isAttachedToEmail)
provideFormMode(mode)
// History used to be its own tab alongside "Form" - moved into the overflow
// menu (a slide-over triggered from there) once the tab bar itself was
// removed to make room for the document canvas's own toolbar.
const historyOpen = ref(false)

useSeoMeta({
  title: () => `AMS · ${name.value || 'Untitled form'}`
})

const modeItems = [
  { label: 'Onsite', value: 'onsite' as const },
  { label: 'Remote', value: 'remote' as const }
]

const statusItems = [
  { label: 'Draft', value: 'draft' as const },
  { label: 'Active', value: 'active' as const },
  { label: 'Retired', value: 'retired' as const }
]

const pageSizeItems = (Object.keys(PAGE_SIZES) as PageSize[]).map(value => ({ label: PAGE_SIZES[value].label, value }))

// Auto-name from the first section's title until the name field is typed
// into directly - mirrors the email template's "name follows the subject
// line" behavior, just sourced from the first section here since forms don't
// have a single subject line. Only meaningful for a form still on the legacy
// sections model (`sections.length` real) - a real Tiptap-document form (see
// `content` above) has an empty `sections` array by design, since it never
// used that model at all, so this must never fire for one: a corrupted/
// incomplete saved snapshot that happens to be missing `nameManuallySet`
// would otherwise immediately blank out the real name to "Untitled form" on
// mount (and that gets autosaved right back, permanently) even though the
// document itself is fully intact - reproduced exactly this way.
watch(sections, (secs) => {
  if (nameManuallySet.value || content.value.trim()) return
  const first = secs[0]?.title?.trim()
  name.value = first || 'Untitled form'
}, { deep: true, immediate: true })

// --- Inline name/description editing (no boxes by default - a pencil toggles
// a short-lived edit state, matching the decluttered-header goal) ----------
const editingName = ref(false)
const editingDescription = ref(false)
const nameDraft = ref(name.value)
const descriptionDraft = ref(description.value)
// Collapsed by default - the description row (and its own edit affordance)
// only shows once the chevron beside the form name is clicked, further
// decluttering the header now that the document canvas's own toolbar needs
// the room. Editing is unaffected either way - collapsing only hides the row,
// it doesn't touch `description` itself, so autosave/undo keep working
// exactly as before regardless of whether this happens to be open.
const descriptionExpanded = ref(false)

function startEditName() {
  nameDraft.value = name.value
  editingName.value = true
}

function commitName() {
  nameManuallySet.value = true
  name.value = nameDraft.value.trim() || 'Untitled form'
  editingName.value = false
}

function startEditDescription() {
  descriptionDraft.value = description.value
  editingDescription.value = true
}

function commitDescription() {
  description.value = descriptionDraft.value.slice(0, DESCRIPTION_MAX)
  editingDescription.value = false
}

// --- Autosave ----------------------------------------------------------------
const { state: saveState, lastSavedAt, commit } = useAutosaveStatus()
let autosaveTimer: ReturnType<typeof setTimeout> | undefined

function persist() {
  const rec = existing.value
  if (!rec) return
  rec.name = name.value.trim() || 'Untitled form'
  rec.description = description.value.trim()
  rec.mode = mode.value
  rec.status = status.value
  rec.themeColor = themeColor.value
  rec.background = background.value
  rec.pageSize = pageSize.value
  rec.margins = { ...margins.value }
  rec.nameManuallySet = nameManuallySet.value
  rec.showSubmitButton = showSubmitButton.value
  rec.updatedAt = 'Just now'
  RETRIEVAL_FORM_SECTIONS[formId.value] = deepClone(sections.value)
  RETRIEVAL_FORM_CONTENT[formId.value] = content.value
}

function flushAutosave() {
  clearTimeout(autosaveTimer)
  commit(persist)
}

let skipFirstAutosave = true
watch([name, description, mode, status, themeColor, background, pageSize, margins, sections, showSubmitButton, content], () => {
  if (skipFirstAutosave) { skipFirstAutosave = false; return }
  saveState.value = 'saving'
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => commit(persist), 600)
}, { deep: true })

onBeforeRouteLeave(() => {
  flushAutosave()
  flushFormsToStorage()
  return true
})

function flushEverything() {
  flushAutosave()
  flushFormsToStorage()
  recordSavedVersion()
}

onMounted(() => window.addEventListener('beforeunload', flushEverything))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', flushEverything)
  flushEverything()
})

function setStatus(next: 'active' | 'draft' | 'retired') {
  status.value = next
  toast.add({
    title: next === 'retired' ? 'Form retired' : next === 'active' ? 'Form published' : 'Marked as draft',
    icon: next === 'retired' ? 'i-lucide-archive' : 'i-lucide-check',
    color: next === 'retired' ? 'warning' : 'success'
  })
}

// Reka returns focus to whatever trigger opened a menu once an item is
// picked, which can re-scroll that trigger into view - this header is
// pinned near the top of the page, so left unchecked that drags the whole
// page (sidebar, top navbar, everything) back to scrollTop 0 after every
// menu action.
function preventCloseAutoFocus(e: Event) {
  e.preventDefault()
}

// Mode/Status/Copy link/Duplicate all live in one overflow menu, in both
// read and edit mode - matching the email template editor's header exactly,
// instead of Mode/Status only being reachable from inline selects that
// existed solely in edit mode.
const modeLabel = computed(() => (mode.value === 'onsite' ? 'Onsite' : 'Remote'))
const statusLabel = computed(() => statusItems.find(i => i.value === status.value)?.label ?? 'Status')

const overflowMenuItems = computed<DropdownMenuItem[][]>(() => [[
  { label: 'Copy link', icon: 'i-lucide-link', onSelect: copyLink },
  { label: 'Duplicate form', icon: 'i-lucide-copy', onSelect: duplicateThisForm },
  { label: 'Version history', icon: 'i-lucide-history', onSelect: () => { historyOpen.value = true } },
  {
    label: modeLabel.value,
    icon: 'i-lucide-map-pin',
    ui: { content: 'ml-1' },
    content: { align: 'start', onCloseAutoFocus: preventCloseAutoFocus },
    children: modeItems.map(item => ({
      label: item.label,
      type: 'checkbox' as const,
      checked: mode.value === item.value,
      ui: mode.value === item.value ? { itemLabel: 'text-primary font-medium', itemTrailingIcon: 'text-primary' } : undefined,
      onSelect: () => { mode.value = item.value }
    }))
  },
  {
    label: statusLabel.value,
    icon: 'i-lucide-flag',
    ui: { content: 'ml-1' },
    content: { align: 'start', onCloseAutoFocus: preventCloseAutoFocus },
    children: statusItems.map(item => ({
      label: item.label,
      type: 'checkbox' as const,
      checked: status.value === item.value,
      ui: status.value === item.value ? { itemLabel: 'text-primary font-medium', itemTrailingIcon: 'text-primary' } : undefined,
      onSelect: () => setStatus(item.value)
    }))
  }
], [
  {
    label: 'Background',
    icon: 'i-lucide-image',
    // Doesn't open the popover directly - see the watch(overflowMenuOpen)
    // below for why. This just records the *intent* to open it once the
    // dropdown has genuinely finished closing.
    onSelect: () => { wantsBackgroundPicker = true }
  },
  {
    label: PAGE_SIZES[pageSize.value].label,
    icon: 'i-lucide-file',
    ui: { content: 'ml-1' },
    content: { align: 'start', onCloseAutoFocus: preventCloseAutoFocus },
    children: pageSizeItems.map(item => ({
      label: item.label,
      type: 'checkbox' as const,
      checked: pageSize.value === item.value,
      ui: pageSize.value === item.value ? { itemLabel: 'text-primary font-medium', itemTrailingIcon: 'text-primary' } : undefined,
      onSelect: () => { pageSize.value = item.value }
    }))
  },
  {
    label: 'Margins',
    icon: 'i-lucide-ruler',
    onSelect: () => { wantsMarginsPicker = true }
  },
  { label: 'Submit button', slot: 'submitToggle' as const }
]])

const backgroundPickerOpen = ref(false)

// Bound to the "More actions" UDropdownMenu's own open state (see the
// template below) - a real signal for "the dropdown is genuinely done
// closing", instead of guessing at a delay after onSelect fires. Picking
// "Background" only records intent (`wantsBackgroundPicker`); the popover
// itself opens here, once Reka reports the dropdown's open state actually
// flipped to false.
//
// The nextTick() this used to defer through (both here and, before that, in
// the item's own onSelect) was never long enough: selecting an item fires
// during the same physical click's mousedown/pointerdown phase, and
// nextTick is a *microtask* - it runs before the browser gets to dispatch
// that same click's still-pending mouseup/click events, not after. So the
// popover's own dismissable layer was mounting (and starting to listen for
// outside pointer/focus activity) *before* that trailing mouseup/click had
// even fired - and then immediately treating it as a click outside itself,
// closing again in the same frame it opened (the exact "background picker
// flashes open then vanishes" bug this fixes).
//
// A real macrotask delay (setTimeout) is needed, but it has to outlast more
// than just the click: the dropdown's own exit transition (its compiled
// class list carries `data-[state=closed]:animate-[scale-out_100ms_...]`)
// keeps it mounted - and its dismissable layer at least partially live -
// for a further ~100ms after `open` already reads false here. 0ms wasn't
// enough (still inside that window); 160ms clears it with margin, so the
// popover's own outside-click listener only starts watching once the
// dropdown is actually gone, not just logically "closed".
let wantsBackgroundPicker = false
const overflowMenuOpen = ref(false)
watch(overflowMenuOpen, (open) => {
  if (open) return
  if (wantsBackgroundPicker) {
    wantsBackgroundPicker = false
    setTimeout(() => { backgroundPickerOpen.value = true }, 160)
  }
  if (wantsMarginsPicker) {
    wantsMarginsPicker = false
    setTimeout(() => { marginsPickerOpen.value = true }, 160)
  }
})

// Same "Background" popover pattern above (see the big comment there for
// why: real close-detection off the dropdown's own open state, plus a real
// macrotask delay past its exit transition, not a naive nextTick).
let wantsMarginsPicker = false
const marginsPickerOpen = ref(false)
const MARGIN_MIN = 0
const MARGIN_MAX = 200

// Word/Google-Docs-style named presets (see MARGIN_PRESETS in
// retrievalForms.ts) - the select shows "Custom" once the numbers stop
// matching any preset exactly, and picking a named option snaps all four
// sides to its fixed values in one shot (identical across every page size,
// matching how the real apps behave).
const marginPresetItems: { value: MarginPresetName, label: string }[] = [
  ...Object.entries(MARGIN_PRESETS).map(([value, preset]) => ({ value: value as MarginPresetName, label: preset.label })),
  { value: 'custom', label: 'Custom' }
]
const marginPreset = computed<MarginPresetName>(() => matchMarginPreset(margins.value))
function applyMarginPreset(name: MarginPresetName) {
  if (name === 'custom') return
  margins.value = { ...MARGIN_PRESETS[name].margins }
}

// vue3-colorpicker is loaded lazily (see FormBackgroundPicker.vue - it can't
// be a plain top-level import without crashing SSR). That's fine on its own,
// but it reintroduced the exact "popover flashes open then closed" bug from
// Round 4: opening the popover is already deferred past the dropdown menu's
// own close (see watch(overflowMenuOpen) above), but the *first* time it
// opens, the picker's JS chunk still has to be fetched/parsed before
// anything with real size exists inside the popover - a real async gap the
// deferral alone doesn't cover. Prefetching the chunk as soon as this page
// mounts (well before the user ever opens the menu) means it's already
// resolved by the time the popover actually opens, so there's nothing left
// for that gap to expose.
onMounted(() => {
  if (import.meta.client) import('vue3-colorpicker')
})

function duplicateThisForm() {
  flushAutosave()
  const { form, sections: dupSections, content: dupContent } = duplicateForm(existing.value!, sections.value, content.value)
  RETRIEVAL_FORMS.push(form)
  RETRIEVAL_FORM_SECTIONS[form.id] = dupSections
  RETRIEVAL_FORM_CONTENT[form.id] = dupContent
  toast.add({ title: 'Form duplicated', description: `"${form.name}" was added as a draft.`, icon: 'i-lucide-copy', color: 'success' })
  navigateTo(`/templates/forms/${form.id}/edit?mode=edit`)
}

function viewInNewTab() {
  flushAutosave()
  flushFormsToStorage()
  // `noopener` forces this preview tab into its own, unrelated browsing-
  // context/process group - without it, Chrome can keep it in the same
  // renderer process as this editor tab (since it still holds a live
  // `window.opener` reference back here), and /form-preview's own
  // `window.print()` (a synchronous, renderer-blocking native dialog) then
  // froze this editor tab too, not just the preview tab - reported as "the
  // whole design is completely frozen" until the print dialog was closed.
  window.open(`/form-preview?formId=${encodeURIComponent(formId.value)}&mode=${mode.value}`, '_blank', 'noopener')
}

const { copy } = useCopyFlash()

async function copyLink() {
  flushAutosave()
  flushFormsToStorage()
  const url = `${window.location.origin}/form-preview?formId=${encodeURIComponent(formId.value)}&mode=${mode.value}`
  if (await copy('form-link', url)) {
    toast.add({ title: 'Link copied', description: url, icon: 'i-lucide-check', color: 'success' })
  } else {
    toast.add({ title: 'Could not copy link', icon: 'i-lucide-triangle-alert', color: 'error' })
  }
}

function goToEdit() {
  viewMode.value = 'edit'
}

// Validation messages stay hidden (`show-validation` false) until a real
// submit attempt - clicking Submit while something's unfilled reveals them
// instead of silently doing nothing, and doesn't require a full FormKit
// <form> node tree just to know "was submit attempted".
const attemptedSubmit = ref(false)

// There's no backend here to actually receive a submission - this just
// confirms the click, matching the rest of the prototype's local-only scope.
function submitForm() {
  attemptedSubmit.value = true
  if (hasUnfilledRequired.value) return
  toast.add({ title: 'Form submitted', icon: 'i-lucide-check', color: 'success' })
}

// One-shot pulse on Done the first time this form picks up a change to save.
const donePulse = useReadyPulse(computed(() => `form-done:${formId.value}`), computed(() => viewMode.value === 'edit' && saveState.value === 'saving'))

function doneEditing() {
  flushAutosave()
  recordSavedVersion()
  viewMode.value = 'read'
}

// --- Undo / redo + version history (snapshot history) ------------------------
// Tracks the form's own metadata (name/description/mode/status/theme/
// background/pageSize) and `sections` (the migration source, frozen once a
// form has real document content - see above). It does NOT track `content`
// itself - the document body's own undo/redo is Tiptap's own History
// extension, bound inside the editor (see onKeydown below for how the two
// stay out of each other's way).
interface Snapshot {
  name: string
  description: string
  mode: 'onsite' | 'remote'
  status: 'active' | 'draft' | 'retired'
  themeColor: string
  background: FormBackground | undefined
  pageSize: PageSize
  sections: FormSection[]
  savedAt: string
}

function takeSnapshot(): Snapshot {
  return JSON.parse(JSON.stringify({
    name: name.value,
    description: description.value,
    mode: mode.value,
    status: status.value,
    themeColor: themeColor.value,
    background: background.value,
    pageSize: pageSize.value,
    sections: sections.value,
    savedAt: timestampNow()
  }))
}

function applySnapshot(snap: Snapshot) {
  const clone = deepClone(snap)
  name.value = clone.name
  description.value = clone.description
  mode.value = clone.mode
  status.value = clone.status
  themeColor.value = clone.themeColor
  background.value = clone.background
  pageSize.value = clone.pageSize || 'letter'
  sections.value = clone.sections
}

const history = ref<Snapshot[]>([takeSnapshot()])
const historyIndex = ref(0)
let restoringHistory = false
let historyDebounce: ReturnType<typeof setTimeout> | undefined

function recordHistory() {
  if (restoringHistory) return
  clearTimeout(historyDebounce)
  historyDebounce = setTimeout(() => {
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(takeSnapshot())
    if (history.value.length > 50) history.value.shift()
    historyIndex.value = history.value.length - 1
  }, 350)
}

// Version-history labels stay generic on purpose - "what changed", not a
// specific old/new diff - mirroring the email template's version history.
// A shipped form's oldest snapshot is attributed to "System" (nobody in the
// app authored it); anything after that - including a form created in-app -
// is attributed to the signed-in user.
//
// Backed by microdiff (a real structural diff) rather than a hand-rolled
// field-by-field comparison - that version could only say "form content
// updated" for any section/field edit and had no way to count how many
// things actually changed. microdiff reports every added/removed/changed
// path, so a category can match on exactly which nested path changed (a
// field's own label vs. the field being added at all vs. a section's
// title) and report a real count instead of just a name.
const sectionMetaKeys = new Set(['title', 'color', 'layout'])
const formChangeCategories: ChangeCategory[] = [
  {
    label: 'name and description',
    match: path => path[0] === 'name' || path[0] === 'description'
  },
  {
    label: 'a section',
    match: path => path[0] === 'sections' && (path.length === 2 || (path.length === 3 && sectionMetaKeys.has(String(path[2])))),
    detail: changes => {
      const n = countDistinctAt(changes, 1)
      return n > 1 ? `${n} sections` : undefined
    }
  },
  {
    label: 'a field',
    match: path => path[0] === 'sections' && path[2] === 'fields' && path.length === 4,
    detail: changes => {
      const n = countDistinctAt(changes, 3)
      return n > 1 ? `${n} fields` : undefined
    }
  },
  {
    label: 'field content',
    match: path => path[0] === 'sections' && path[2] === 'fields' && path.length > 4,
    detail: (changes) => {
      const n = new Set(changes.map(c => `${c.path[1]}.${c.path[3]}`)).size
      return n > 1 ? `content in ${n} fields` : undefined
    }
  },
  {
    label: 'appearance',
    match: path => path[0] === 'themeColor' || path[0] === 'background' || path[0] === 'pageSize'
  },
  // The document canvas's own body (the actual thing a team member edits now
  // - see the big comment on `content` near the top of this file) was never
  // part of `Snapshot`/`takeSnapshot()` at all, since the page-level undo/
  // redo stack deliberately excludes it (Tiptap owns its own History
  // extension for that - see onKeydown below). But `recordSavedVersion`/
  // `historyEntries` reused that same Snapshot shape for the real Version
  // History feature too, so editing the document body - the primary way
  // forms are edited since the Tiptap canvas replaced sections/fields - never
  // produced a new saved version at all: only name/description/mode/status/
  // theme/background/pageSize/legacy-sections changes did. `takeSavedSnapshot`
  // below layers `content` on top of a plain Snapshot for saved versions only,
  // leaving the undo/redo stack's own Snapshot/takeSnapshot untouched.
  {
    label: 'form content',
    match: path => path[0] === 'content'
  }
]

watch([name, description, mode, status, themeColor, background, pageSize, sections], recordHistory, { deep: true })

interface SavedSnapshot extends Snapshot {
  content: string
}

function takeSavedSnapshot(): SavedSnapshot {
  return { ...takeSnapshot(), content: content.value }
}

// The version-HISTORY TAB used to read straight off this same undo/redo
// stack, which stepped on every debounced autosave (effectively every
// keystroke) - so it listed dozens of "versions" for one editing session
// instead of one entry per actual save. It's a separate list now, only
// appended to at an explicit save point (Done, or leaving the page mid-edit)
// - see `recordSavedVersion`.
if (!FORM_VERSIONS[formId.value]) FORM_VERSIONS[formId.value] = [takeSavedSnapshot()]
const savedVersions = computed<SavedSnapshot[]>({
  get: () => (FORM_VERSIONS[formId.value] ?? []) as SavedSnapshot[],
  set: (v) => { FORM_VERSIONS[formId.value] = v }
})

function recordSavedVersion() {
  const top = savedVersions.value[savedVersions.value.length - 1]
  if (!top) return
  const next = takeSavedSnapshot()
  if (!describeSnapshotChanges(top, next, formChangeCategories)) return
  savedVersions.value = [...savedVersions.value, next]
  if (savedVersions.value.length > 50) savedVersions.value.shift()
}

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

function undo() {
  if (!canUndo.value) return
  clearTimeout(historyDebounce)
  restoringHistory = true
  historyIndex.value--
  applySnapshot(history.value[historyIndex.value]!)
  nextTick(() => { restoringHistory = false })
}

function redo() {
  if (!canRedo.value) return
  clearTimeout(historyDebounce)
  restoringHistory = true
  historyIndex.value++
  applySnapshot(history.value[historyIndex.value]!)
  nextTick(() => { restoringHistory = false })
}

// version history tab - one entry per actual save (see `savedVersions`
// above), newest first (matches the email template's HistoryTab: idx 0 is
// always "Current")
const historyEntries = computed(() => {
  const list = savedVersions.value
  return list.map((snap, k) => {
    const prev = list[k - 1]
    if (!prev) {
      // "Initial version" rather than "Version 1" - the `v1` badge next to
      // it already carries the number, so repeating it in the label read as
      // a straight duplicate ("Version 1" ... "v1"). Google Docs/Notion both
      // avoid this the same way: the first entry gets a distinct name
      // ("Named versions" / the page's creation entry) instead of restating
      // the count that's already shown elsewhere in the row.
      return {
        id: 'v1',
        label: 'Initial version',
        actor: SEEDED_FORM_IDS.includes(formId.value) ? 'System' : CURRENT_USER_NAME,
        date: snap.savedAt,
        snapshot: snap
      }
    }
    return {
      id: `v${k + 1}`,
      label: describeSnapshotChanges(prev, snap, formChangeCategories) ?? 'Edited',
      actor: CURRENT_USER_NAME,
      date: snap.savedAt,
      snapshot: snap
    }
  }).reverse()
})

const versionPreviewOpen = ref(false)
const versionPreviewEntry = ref<(typeof historyEntries.value)[number]>()

function viewVersion(entry: (typeof historyEntries.value)[number]) {
  versionPreviewEntry.value = entry
  versionPreviewOpen.value = true
}

function restoreVersion(entry: (typeof historyEntries.value)[number]) {
  applySnapshot(entry.snapshot)
  content.value = entry.snapshot.content
  versionPreviewOpen.value = false
  toast.add({ title: `Restored "${entry.label}"`, description: 'Autosave will pick this up shortly.', icon: 'i-lucide-rotate-ccw', color: 'warning' })
}

function onKeydown(e: KeyboardEvent) {
  if (viewMode.value !== 'edit') return
  const target = e.target as HTMLElement | null
  // Focus inside the document's own contenteditable root means Tiptap's own
  // History extension owns Ctrl+Z/Ctrl+Shift+Z for that keystroke - it's
  // already bound directly on that element and undoes/redoes the actual
  // document content, which this page-level snapshot stack never tracked in
  // the first place (see the comment above `interface Snapshot`). Letting
  // both fire for the same keystroke was the real bug: pressing Ctrl+Z while
  // typing correctly undid the last text edit via Tiptap, but *also*
  // silently reverted this page's own name/mode/status/etc. to an older
  // snapshot in the same keystroke - two unrelated undo stacks racing each
  // other. Bailing out here entirely once focus is inside the editor is
  // what stops that.
  const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  if (isTyping) return
  const mod = e.ctrlKey || e.metaKey

  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault()
    undo()
  } else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault()
    redo()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="bg-gray-50 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
    <div data-tabs-header class="bg-white px-6 pt-4 pb-3 shrink-0 border-b border-default">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 group">
            <UTooltip text="Back to Templates">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                square
                icon="i-lucide-arrow-left"
                class="text-muted shrink-0"
                aria-label="Back to Templates"
                to="/templates?tab=forms"
              />
            </UTooltip>
            <template v-if="editingName">
              <UInput
                v-model="nameDraft"
                variant="none"
                autofocus
                class="w-full max-w-xl p-0 text-lg font-semibold text-highlighted [&_input]:p-0 [&_input]:h-auto [&_input]:text-lg [&_input]:font-semibold"
                placeholder="Untitled form"
                @keyup.enter="commitName"
                @keyup.esc="editingName = false"
              />
              <UTooltip text="Save">
                <UButton color="primary" variant="ghost" size="xs" square icon="i-lucide-check" aria-label="Save name" @click="commitName" />
              </UTooltip>
              <UTooltip text="Cancel">
                <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-x" class="text-muted" aria-label="Cancel editing name" @click="editingName = false" />
              </UTooltip>
            </template>
            <template v-else>
              <div class="relative inline-flex items-center gap-1.5 min-w-0">
                <h1 class="text-lg font-semibold text-highlighted truncate">{{ name || 'Untitled form' }}</h1>
                <UTooltip v-if="viewMode === 'edit'" text="Edit name">
                  <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-pencil" class="text-muted opacity-0 group-hover:opacity-100" aria-label="Edit name" @click="startEditName" />
                </UTooltip>
                <UTooltip :text="descriptionExpanded ? 'Hide description' : 'Show description'">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    square
                    :icon="descriptionExpanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                    class="text-muted"
                    :aria-label="descriptionExpanded ? 'Hide description' : 'Show description'"
                    @click="descriptionExpanded = !descriptionExpanded"
                  />
                </UTooltip>
                <!-- A floating popover (not an inline row) so opening this
                     never pushes the header's own height - the header stays
                     a fixed size regardless of whether this is open, which
                     matters now that the document canvas's own toolbar sits
                     directly below it. The popover's own trigger would
                     normally anchor to just the chevron button (Reka floats
                     it relative to whatever's in the default slot) - it's
                     given this whole-row invisible span instead so `align:
                     'start'` lines the popover's left edge up with the
                     title's own left edge instead of the much-further-right
                     chevron's, i.e. inline with the title, not off to the
                     side of it. Same anchor-widening trick already used for
                     the Background popover above. -->
                <UPopover v-model:open="descriptionExpanded" :content="{ side: 'bottom', align: 'start', sideOffset: 6 }">
                  <span class="absolute inset-0 pointer-events-none" />
                  <template #content>
                  <!-- Matches the anchor's own width (the invisible span
                       above, sized to the whole title row) via Reka's
                       --reka-popper-anchor-width - the popover extends only
                       as wide as the title area itself renders/truncates
                       to, with a sensible floor for a short title, instead
                       of an arbitrary fixed width unrelated to the title. -->
                  <div class="p-3" style="width: max(16rem, var(--reka-popper-anchor-width))">
                    <template v-if="editingDescription">
                      <div class="flex items-start gap-1.5">
                        <UInput
                          v-model="descriptionDraft"
                          variant="none"
                          autofocus
                          :maxlength="DESCRIPTION_MAX"
                          class="w-full p-0 text-sm text-muted [&_input]:p-0 [&_input]:h-auto [&_input]:text-sm [&_input]:whitespace-normal"
                          placeholder="When and why this form is used"
                          @keyup.enter="commitDescription"
                          @keyup.esc="editingDescription = false"
                        />
                        <UTooltip text="Save">
                          <UButton color="primary" variant="ghost" size="xs" square icon="i-lucide-check" aria-label="Save description" @click="commitDescription" />
                        </UTooltip>
                        <UTooltip text="Cancel">
                          <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-x" class="text-muted" aria-label="Cancel editing description" @click="editingDescription = false" />
                        </UTooltip>
                      </div>
                      <span class="text-[10px] text-dimmed">{{ descriptionDraft.length }}/{{ DESCRIPTION_MAX }}</span>
                    </template>
                    <template v-else>
                      <div class="flex items-start gap-1.5">
                        <p class="text-sm text-muted flex-1 whitespace-normal break-words">{{ description || 'No description' }}</p>
                        <!-- `ignore-non-keyboard-focus` - opening this popover
                             (clicking the chevron above) auto-focuses the
                             first focusable element inside it, which is this
                             button. That's a real focus event, so without
                             this flag the tooltip read it the same as a
                             keyboard Tab-focus and popped open immediately
                             alongside the popover itself, on every click -
                             not on hover, which is the only time a tooltip
                             should actually appear. -->
                        <UTooltip v-if="viewMode === 'edit'" text="Edit description" :ignore-non-keyboard-focus="true">
                          <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-pencil" class="text-muted shrink-0" aria-label="Edit description" @click="startEditDescription" />
                        </UTooltip>
                      </div>
                    </template>
                  </div>
                </template>
                </UPopover>
              </div>
            </template>
          </div>
        </div>

        <!-- Badges/autosave sit beside the primary action instead of beside
             the title - matches the email editor exactly, and keeps the
             title's inline editor from reflowing this group when it opens. -->
        <div class="flex items-center gap-3 shrink-0">
          <div class="flex items-center gap-2">
            <SharedStatusBadge :status="status" />
            <EmailModeBadge :mode="mode" />
            <SharedAutosaveIndicator :state="saveState" :last-saved-at="lastSavedAt" />
          </div>

          <div class="flex items-center gap-2">
            <UTooltip v-if="viewMode === 'read'" text="Browse the placeholder library">
              <UButton color="neutral" variant="outline" size="md" icon="i-lucide-braces" @click="placeholderBrowseOpen = true">
                Placeholders
              </UButton>
            </UTooltip>
            <UTooltip text="Preview form in new tab">
              <UButton
                color="neutral"
                variant="outline"
                size="md"
                icon="i-lucide-external-link"
                @click="viewInNewTab"
              >
                Preview
              </UButton>
            </UTooltip>
            <UButton
              color="primary"
              variant="solid"
              size="md"
              :icon="viewMode === 'edit' ? 'i-lucide-check' : 'i-lucide-pencil'"
              :class="{ 'btn-ready-pulse': donePulse.active.value }"
              @click="viewMode === 'edit' ? doneEditing() : goToEdit()"
            >
              {{ viewMode === 'edit' ? 'Done' : 'Edit' }}
            </UButton>
            <div class="relative inline-block">
              <UDropdownMenu v-model:open="overflowMenuOpen" :items="overflowMenuItems" :ui="{ content: 'w-max min-w-48', itemLabel: 'whitespace-nowrap' }" :content="{ onCloseAutoFocus: preventCloseAutoFocus }">
                <UTooltip text="More actions">
                  <UButton color="neutral" variant="ghost" size="md" square icon="i-lucide-more-horizontal" class="text-muted" aria-label="More actions" />
                </UTooltip>

                <template #submitToggle>
                  <div class="flex items-center justify-between gap-1.5 w-full" @click.stop>
                    <span class="flex items-center gap-1.5">
                      <!-- The wrapping real item element carries Reka's
                           `group` class and the hover/`data-highlighted`
                           state, but a custom slot's own markup doesn't
                           inherit any styling from the item's default
                           itemLeadingIcon - text-dimmed alone left the icon
                           static while the label text (which does pick up
                           the item's own text-highlighted class) correctly
                           darkened on hover. `group-data-highlighted:` here
                           mirrors that same class the real leading icon
                           gets, off the same ancestor state. -->
                      <UIcon name="i-lucide-send" class="size-4 text-dimmed group-data-highlighted:text-default transition-colors" />
                      Submit button
                    </span>
                    <USwitch v-model="showSubmitButton" size="xs" @click.stop />
                  </div>
                </template>
              </UDropdownMenu>

              <!-- The Background row's onSelect opens this - a UPopover
                   nested inside the dropdown's own content closes the whole
                   menu the instant its trigger is clicked, so this is a
                   second, independent popover anchored to the same corner
                   (an invisible, `pointer-events-none` reference over the
                   "•••" button) instead of living inside the menu itself. -->
              <UPopover v-model:open="backgroundPickerOpen" :content="{ side: 'bottom', align: 'end', sideOffset: 8, avoidCollisions: false }">
                <span class="absolute inset-0 pointer-events-none" />
                <template #content>
                  <div class="p-3 w-72">
                    <!-- vue3-colorpicker references HTMLElement at module
                         scope (for a prop's type validation), which doesn't
                         exist in Nuxt's Node-based SSR runtime - ClientOnly
                         keeps it out of the server render entirely, same as
                         any other browser-only widget. -->
                    <ClientOnly>
                      <MasterDataFormBackgroundPicker v-model="background" />
                    </ClientOnly>
                  </div>
                </template>
              </UPopover>

              <!-- Same anchor trick as the Background popover above - a
                   second, independent popover over the "•••" button. -->
              <UPopover v-model:open="marginsPickerOpen" :content="{ side: 'bottom', align: 'end', sideOffset: 8, avoidCollisions: false }">
                <span class="absolute inset-0 pointer-events-none" />
                <template #content>
                  <div class="p-3 w-56 space-y-2">
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-dimmed">Page margins</h3>
                    <UFormField label="Preset" :ui="{ label: 'text-xs' }">
                      <USelectMenu
                        :model-value="marginPreset"
                        :items="marginPresetItems"
                        value-key="value"
                        class="w-full text-sm"
                        @update:model-value="applyMarginPreset"
                      />
                    </UFormField>
                    <p class="text-[11px] text-dimmed leading-snug">Same margins apply at every page size, matching Word/Google Docs - only "Custom" varies per side.</p>
                    <div class="grid grid-cols-2 gap-2">
                      <UFormField label="Top" :ui="{ label: 'text-xs' }">
                        <UInputNumber v-model="margins.top" :min="MARGIN_MIN" :max="MARGIN_MAX" size="sm" class="w-full" />
                      </UFormField>
                      <UFormField label="Right" :ui="{ label: 'text-xs' }">
                        <UInputNumber v-model="margins.right" :min="MARGIN_MIN" :max="MARGIN_MAX" size="sm" class="w-full" />
                      </UFormField>
                      <UFormField label="Bottom" :ui="{ label: 'text-xs' }">
                        <UInputNumber v-model="margins.bottom" :min="MARGIN_MIN" :max="MARGIN_MAX" size="sm" class="w-full" />
                      </UFormField>
                      <UFormField label="Left" :ui="{ label: 'text-xs' }">
                        <UInputNumber v-model="margins.left" :min="MARGIN_MIN" :max="MARGIN_MAX" size="sm" class="w-full" />
                      </UFormField>
                    </div>
                    <UButton size="xs" color="neutral" variant="ghost" block icon="i-lucide-rotate-ccw" @click="margins = { ...DEFAULT_PAGE_MARGINS }">
                      Reset to default
                    </UButton>
                  </div>
                </template>
              </UPopover>
            </div>
          </div>
        </div>
      </div>

      <!-- No physical Undo/Redo buttons in the header - Ctrl+Z / Ctrl+Shift+Z
           already work (see onKeydown below) and a dedicated header button
           for something already reachable by its own standard shortcut is
           exactly the kind of chrome this decluttering pass is removing. -->
    </div>

    <!-- The document canvas's own toolbar - a separate bar attached directly
         to the page header above, running the full page width (no `px-6`),
         not nested inside the canvas panel's own padding/border the way it
         used to be. -->
    <MasterDataFormDocumentToolbar
      v-if="viewMode === 'edit'"
      :editor="documentEditor"
      :content="content"
      :placeholders-enabled="isAttachedToEmail"
      :form-mode="mode"
    />

    <EmailPlaceholderDrawer v-model="placeholderBrowseOpen" read-only :groups="TOKEN_GROUPS" :used-codes="browseUsedCodes" context-label="Document" :context-mode="mode" />

    <USlideover v-model:open="historyOpen" :ui="{ content: 'max-w-md', body: 'fade-scroll-y' }">
      <template #header>
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-semibold text-highlighted truncate">Version history</h2>
          <p class="text-sm text-muted mt-0.5">Every saved change to this template's content.</p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-lucide-x"
          aria-label="Close"
          @click="historyOpen = false"
        />
      </template>
      <template #body>
        <MasterDataFormHistoryTab
          :entries="historyEntries"
          :retired="status === 'retired'"
          @view="viewVersion"
          @restore="restoreVersion"
        />
      </template>
    </USlideover>

    <div class="flex flex-1 min-h-0 bg-gray-50 stage-enter">
      <div class="flex flex-col flex-1 min-w-0 px-6 py-3 gap-3">
        <div class="flex-1 min-h-0 rounded-lg border border-default overflow-hidden">
          <MasterDataFormDocumentEditor
            ref="documentEditorRef"
            v-model="content"
            :editable="viewMode === 'edit'"
            :page-size="pageSize"
            :margins="margins"
            :background="background"
            :header-left="letterhead.headerLeft"
            :header-right="letterhead.headerRight"
            :footer-left="letterhead.footerLeft"
            style="height: 100%"
          >
            <template v-if="showSubmitButton" #actions>
              <UButton
                type="button"
                color="primary"
                variant="solid"
                size="lg"
                :disabled="viewMode === 'edit' ? hasUnfilledRequired : false"
                :style="{ background: themeColor, borderColor: themeColor }"
                @click="viewMode === 'read' ? submitForm() : undefined"
              >
                Submit
              </UButton>
            </template>
          </MasterDataFormDocumentEditor>
        </div>
      </div>
    </div>

    <MasterDataFormVersionPreviewModal
      v-if="versionPreviewEntry"
      v-model="versionPreviewOpen"
      :title="versionPreviewEntry.label"
      :name="versionPreviewEntry.snapshot.name"
      :theme-color="versionPreviewEntry.snapshot.themeColor"
      :sections="versionPreviewEntry.snapshot.sections"
      show-restore
      @restore="restoreVersion(versionPreviewEntry)"
    />
  </div>
</template>
