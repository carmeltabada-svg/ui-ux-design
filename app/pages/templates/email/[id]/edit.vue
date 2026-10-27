<script setup lang="ts">
import { TEMPLATES, TOKEN_GROUPS, VERSION_HISTORY_T16, SAMPLE_VALUES, resolveTokensForPrint, extractTokenCodes } from '~/data/templates'
import { ensureTemplateRuntime, TEMPLATE_HISTORY, CURRENT_USER_NAME, type TemplateSnapshot } from '~/data/templateRuntime'
import { RETRIEVAL_FORMS } from '~/data/retrievalForms'
import type { DropdownMenuItem } from '@nuxt/ui'
import { describeSnapshotChanges, type ChangeCategory } from '~/utils/versionDiff'
import { buildEmailExportHtml, buildEmailExportPlainText } from '~/utils/emailExportHtml'

const route = useRoute()
const toast = useToast()

const templateKey = computed(() => route.params.id as string)
const current = computed(() => ensureTemplateRuntime(templateKey.value))

const DESCRIPTION_MAX = 140

const name = computed({ get: () => current.value.name, set: (v) => { current.value.name = v } })
const description = computed({ get: () => current.value.description, set: (v) => { current.value.description = v } })
const mode = computed({ get: () => current.value.mode, set: (v) => { current.value.mode = v } })
const status = computed({ get: () => current.value.status, set: (v) => { current.value.status = v } })
const activeTab = ref('editor')

const subject = computed({ get: () => current.value.subject, set: (v) => { current.value.subject = v } })
const body = computed({ get: () => current.value.body, set: (v) => { current.value.body = v } })
const cc = computed({ get: () => current.value.cc, set: (v) => { current.value.cc = v } })
const bcc = computed({ get: () => current.value.bcc, set: (v) => { current.value.bcc = v } })
const background = computed({ get: () => current.value.background, set: (v) => { current.value.background = v } })
const footerNote = computed({ get: () => current.value.footerNote ?? '', set: (v) => { current.value.footerNote = v || undefined } })

// Soft, brand-neutral canvas tints - a background sits *behind* the white
// content column (see emailExportHtml.ts's outer-table wrap), so these stay
// light enough that white content still reads as "on a page", not another
// competing block of color.
const BACKGROUND_COLORS = ['#f1f5f9', '#eef2ff', '#eef4fd', '#fdf6e3', '#f0fdf4', '#fef2f2']

// Auto-name from the subject line, in real time, until the name has been
// typed directly - mirrors "Untitled document" style naming.
watch(subject, (s) => {
  if (current.value.nameManuallySet) return
  current.value.name = s.trim() || 'Untitled'
}, { immediate: true })

useSeoMeta({ title: () => `AMS · ${name.value || 'Untitled'}` })

const modeItems = [
  { label: 'Onsite', value: 'onsite' as const },
  { label: 'Remote', value: 'remote' as const }
]

const statusItems = [
  { label: 'Draft', value: 'draft' as const },
  { label: 'Active', value: 'active' as const },
  { label: 'Retired', value: 'retired' as const }
]

// --- Inline name/description editing (pencil-toggle, single-line, styled to
// match the static text exactly so switching in/out doesn't visibly jump) ---
const editingName = ref(false)
const editingDescription = ref(false)
const nameDraft = ref(name.value)
const descriptionDraft = ref(description.value)

function startEditName() {
  nameDraft.value = name.value
  editingName.value = true
}

function commitName() {
  current.value.nameManuallySet = true
  name.value = nameDraft.value.trim() || 'Untitled'
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

function setStatus(next: 'active' | 'draft' | 'retired') {
  status.value = next
  toast.add({
    title: next === 'retired' ? 'Template retired' : next === 'active' ? 'Template published' : 'Marked as draft',
    icon: next === 'retired' ? 'i-lucide-archive' : 'i-lucide-check',
    color: next === 'retired' ? 'warning' : 'success'
  })
}

// The three secondary actions (download/copy/mode/status) all live in one
// overflow menu now, so the header only ever surfaces the one primary action
// (Edit/Save). Mode and Status show as hover submenus (via `children`) inside
// the menu instead of separate selects competing for header space.
const modeLabel = computed(() => (mode.value === 'onsite' ? 'Onsite' : 'Remote'))
const statusLabel = computed(() => statusItems.find(i => i.value === status.value)?.label ?? 'Status')

// Reka returns focus to whatever trigger opened a menu once an item is
// picked, so it can re-scroll that trigger into view - harmless for a
// button in the middle of a page, but this header sits pinned near the very
// top, so that focus-restore was dragging the whole page (sidebar, top
// navbar, everything) back to scrollTop 0 after every menu action. The menu
// already did its job once an item is selected - there's nothing left worth
// focus-restoring to.
function preventCloseAutoFocus(e: Event) {
  e.preventDefault()
}

const overflowMenuItems = computed<DropdownMenuItem[][]>(() => [[
  { label: 'Download EML', icon: 'i-lucide-download', onSelect: downloadEml },
  { label: 'Copy to clipboard', icon: 'i-lucide-copy', onSelect: copyToClipboard },
  {
    label: modeLabel.value,
    icon: 'i-lucide-map-pin',
    // the submenu's own flyout needs breathing room from the parent panel -
    // the library's default 3px sideOffset for submenus reads as touching it
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
]])

const placeholderOpen = ref(false)
// Read-only browsing of the library from the header, outside edit mode.
const placeholderBrowseOpen = ref(false)
const tokenGroups = TOKEN_GROUPS
const usedCodes = computed(() => extractTokenCodes(subject.value + body.value))

// Which field the open drawer inserts into: set by the Insert placeholder button that opened it.
const insertTarget = ref<'subject' | 'body'>('body')
const subjectField = ref<{ insertAtCursor: (text: string, keepFocus?: boolean) => boolean } | null>(null)
const bodyField = ref<{ insertAtCursor: (text: string) => 'ok' | 'none' | 'node' } | null>(null)

function openPlaceholderDrawer(target: 'subject' | 'body') {
  insertTarget.value = target
  placeholderOpen.value = true
}

// Retired is just a status label here, the same as a form's retired status -
// it never blocks editing, inserting placeholders, or exporting.
// A placeholder goes where the author's cursor is, never at the end. The drawer stays open so
// several can be inserted in a row; with no cursor placed, nothing is inserted and a toast says why.
function insertPlaceholder(code: string, keepFocus = false): boolean {
  if (!isEditing.value) {
    toast.add({ title: 'Enter edit mode to insert a placeholder', icon: 'i-lucide-triangle-alert', color: 'warning' })
    return false
  }
  const text = `{{${code}}}`
  const where = insertTarget.value === 'subject' ? 'the subject line' : 'the body'
  const result = insertTarget.value === 'subject'
    ? (subjectField.value?.insertAtCursor(text, keepFocus) ? 'ok' : 'none')
    : (bodyField.value?.insertAtCursor(text) ?? 'none')
  if (result === 'ok') return true
  toast.add({
    title: 'No active cursor',
    description: result === 'node'
      ? 'An image or button is selected. Click inside a line of text in the body, then pick the placeholder again.'
      : `Click where you want the placeholder in ${where}, then pick it again. Nothing was inserted.`,
    icon: 'i-lucide-text-cursor',
    color: 'warning'
  })
  return false
}

// Real version history - recorded on Save (not on every keystroke, and not
// gated behind a separate "publish" step). Rationale: subject/body edits are
// already gated behind an explicit Edit -> Save flow (unlike a form, which
// autosaves continuously), so "Save" is already the natural, deliberate
// checkpoint a user chooses - recording a version there gives one entry per
// meaningful edit instead of either noise (a version per keystroke) or an
// extra workflow step this prototype doesn't otherwise have (a real publish
// gate, on top of the existing Active/Draft/Retired status, would be a
// second, redundant "is this official" concept). t16 keeps its real sourced
// history as the oldest entries; new saves append on top of that.
//
// A template's very first version is attributed to whoever actually
// authored it: a seeded (shipped-with-production) template's v1 is "System"
// - nobody in the app wrote it - while a template someone creates from here
// on gets their own name on v1, same as every version after it.
type Snapshot = TemplateSnapshot

const MAX_HISTORY_ENTRIES = 50
const initialHistory = (): Snapshot[] => (
  templateKey.value === 't16'
    ? VERSION_HISTORY_T16.map(entry => ({
        ...entry,
        subject: TEMPLATES.t16!.subject,
        body: TEMPLATES.t16!.body.replace(/\n/g, '<br>'),
        cc: deepClone(cc.value),
        bcc: deepClone(bcc.value),
        attachment: current.value.attachment,
        attachmentFormId: current.value.attachmentFormId
      }))
    : [{
        id: 'v1',
        // Not "Version 1" - the history card already shows a "v1" badge next
        // to this label (see EmailHistoryTab.vue), so that would just repeat
        // the same number twice. Matches the retrieval-forms editor's own
        // first-entry wording (see forms/[id]/edit.vue's historyEntries).
        label: 'Initial version',
        actor: TEMPLATES[templateKey.value] ? 'System' : CURRENT_USER_NAME,
        date: current.value.lastSavedAt || nowISO(),
        subject: subject.value,
        body: body.value,
        cc: deepClone(cc.value),
        bcc: deepClone(bcc.value),
        attachment: current.value.attachment,
        attachmentFormId: current.value.attachmentFormId
      }]
)
if (!TEMPLATE_HISTORY[templateKey.value]) TEMPLATE_HISTORY[templateKey.value] = initialHistory()
const history = computed<Snapshot[]>({
  get: () => TEMPLATE_HISTORY[templateKey.value] ?? [],
  set: (v) => { TEMPLATE_HISTORY[templateKey.value] = v }
})

// Keep the history entries themselves in the read model - the version
// number badge (v1, v2, ...) and the "Current" tag are both already handled
// by EmailHistoryTab, so nothing here needs relabeling.
const historyEntries = computed(() => history.value)

// Change descriptions stay generic on purpose - "what section changed", not
// a specific old-value/new-value diff - since that's all a reader actually
// needs from a version list. A form attachment lives inside the email body
// conceptually, so adding/removing/replacing it is described as a body
// change, not its own category. When a save touches more than one section,
// the entries combine into one recommended title instead of one row per
// section.
//
// Backed by microdiff (a real structural diff, see app/utils/versionDiff.ts)
// instead of a handful of top-level `!==`/`JSON.stringify` checks - that
// couldn't count anything (how many CC/BCC recipients actually changed), so
// "recipients updated" was all it could ever say regardless of whether one
// address or ten changed.
const emailChangeCategories: ChangeCategory[] = [
  { label: 'subject line', match: path => path[0] === 'subject' },
  { label: 'email body', match: path => path[0] === 'body' || path[0] === 'attachment' || path[0] === 'attachmentFormId' },
  {
    label: 'a recipient',
    match: path => path[0] === 'cc' || path[0] === 'bcc',
    detail: (changes) => {
      const n = new Set(changes.map(c => `${c.path[0]}.${c.path[1]}`)).size
      return n > 1 ? `${n} recipients` : undefined
    }
  }
]

function recordVersion() {
  const top = history.value[0]
  if (!top) return
  const next = {
    subject: subject.value,
    body: body.value,
    cc: deepClone(cc.value),
    bcc: deepClone(bcc.value),
    attachment: current.value.attachment,
    attachmentFormId: current.value.attachmentFormId
  }
  const label = describeSnapshotChanges(top, next, emailChangeCategories)
  if (!label) return
  // Newest first, capped so the stored history cannot grow without bound; ids stay unique after the cap by counting up from the highest one.
  const nextNumber = Math.max(0, ...history.value.map(h => Number.parseInt(h.id.slice(1)) || 0)) + 1
  history.value = [
    { id: `v${nextNumber}`, label, actor: CURRENT_USER_NAME, date: nowISO(), ...next },
    ...history.value
  ].slice(0, MAX_HISTORY_ENTRIES)
}

const fullPreviewOpen = ref(false)
const fullPreviewEntry = ref<Snapshot>()

function viewHistoryEntry(entry: Snapshot) {
  fullPreviewEntry.value = entry
  fullPreviewOpen.value = true
}

function restoreHistoryEntry(entry: Snapshot) {
  subject.value = entry.subject
  body.value = entry.body
  cc.value = deepClone(entry.cc)
  bcc.value = deepClone(entry.bcc)
  toast.add({ title: `Restored "${entry.label}"`, description: 'Save to keep it.', icon: 'i-lucide-rotate-ccw', color: 'warning' })
}

function previewAttachment() {
  const formId = current.value.attachmentFormId ?? 'return-ack-onsite'
  const url = `/form-preview?formId=${encodeURIComponent(formId)}&ref=${encodeURIComponent(SAMPLE_VALUES.APR_REF ?? '')}&mode=${mode.value}`
  // `noopener` (not just target=_blank) forces this into its own, unrelated
  // browsing-context/process group - without it, Chrome can keep this tab in
  // the same renderer process as the opener (since it still holds a live
  // `window.opener` reference back here), and /form-preview's own
  // `window.print()` (a synchronous, renderer-blocking native dialog) then
  // froze *this* tab too, not just itself - reported as "the whole design is
  // completely frozen" until the print dialog in the other tab was closed.
  window.open(url, '_blank', 'noopener')
}

function editAttachment() {
  const formId = current.value.attachmentFormId ?? 'return-ack-onsite'
  navigateTo(`/templates/forms/${formId}/edit`)
}

// Active forms are the only ones offered for quick attach/replace - a
// draft or retired form isn't something that should go out on a live email.
const activeFormOptions = computed(() =>
  RETRIEVAL_FORMS.filter(f => f.status === 'active').map(f => ({ id: f.id, name: f.name }))
)

function attachForm(formId: string) {
  if (!isEditing.value) {
    toast.add({ title: 'Enter edit mode to attach a form', icon: 'i-lucide-triangle-alert', color: 'warning' })
    return
  }
  const form = RETRIEVAL_FORMS.find(f => f.id === formId)
  if (!form) return
  current.value.attachment = form.name
  current.value.attachmentFormId = form.id
  toast.add({ title: `Attached "${form.name}"`, icon: 'i-lucide-check', color: 'success' })
}

function removeAttachment() {
  if (!isEditing.value) {
    toast.add({ title: 'Enter edit mode to remove the attachment', icon: 'i-lucide-triangle-alert', color: 'warning' })
    return
  }
  current.value.attachment = 'none'
  current.value.attachmentFormId = undefined
  toast.add({ title: 'Form attachment removed', icon: 'i-lucide-x', color: 'warning' })
}

function addCc(email: string) {
  if (cc.value.some(r => r.email === email)) return
  cc.value = [...cc.value, { email }]
  toast.add({ title: `${email} added to CC`, icon: 'i-lucide-check', color: 'success' })
}

function addBcc(email: string) {
  if (bcc.value.some(r => r.email === email)) return
  bcc.value = [...bcc.value, { email }]
  toast.add({ title: `${email} added to BCC`, icon: 'i-lucide-check', color: 'success' })
}

function removeCc(email: string) {
  cc.value = cc.value.filter(r => r.email !== email)
}

function removeBcc(email: string) {
  bcc.value = bcc.value.filter(r => r.email !== email)
}

// Edit unlocks the subject/body fields; Cancel reverts to the snapshot taken
// on entering edit mode; Save flushes the autosave and stays in read mode.
const isEditing = ref(route.query.created === '1' || route.query.mode === 'edit')
let subjectBeforeEdit = subject.value
let bodyBeforeEdit = body.value
let backgroundBeforeEdit = background.value
let footerNoteBeforeEdit = footerNote.value

// One-shot pulse on Save the first time this template has a change to save.
const hasEdits = computed(() => isEditing.value && (subject.value !== subjectBeforeEdit || body.value !== bodyBeforeEdit || background.value !== backgroundBeforeEdit || footerNote.value !== footerNoteBeforeEdit))
const savePulse = useReadyPulse(computed(() => `email-save:${templateKey.value}`), hasEdits)

function enterEditMode() {
  subjectBeforeEdit = subject.value
  bodyBeforeEdit = body.value
  backgroundBeforeEdit = background.value
  footerNoteBeforeEdit = footerNote.value
  isEditing.value = true
}

function cancelEdit() {
  subject.value = subjectBeforeEdit
  body.value = bodyBeforeEdit
  background.value = backgroundBeforeEdit
  footerNote.value = footerNoteBeforeEdit
  isEditing.value = false
  editingName.value = false
  editingDescription.value = false
}

function saveEdit() {
  isEditing.value = false
  editingName.value = false
  editingDescription.value = false
  flushAutosave()
  recordVersion()
  toast.add({ title: 'Template saved', icon: 'i-lucide-check', color: 'success' })
}

// --- Autosave ----------------------------------------------------------------
const { state: saveState, lastSavedAt, commit } = useAutosaveStatus()
let autosaveTimer: ReturnType<typeof setTimeout> | undefined

function flushAutosave() {
  clearTimeout(autosaveTimer)
  commit(() => { current.value.lastSavedAt = nowISO() })
}

let skipFirstAutosave = true
watch([subject, body, cc, bcc, status, name, description, mode, background, footerNote], () => {
  if (skipFirstAutosave) { skipFirstAutosave = false; return }
  saveState.value = 'saving'
  clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => commit(() => { current.value.lastSavedAt = nowISO() }), 600)
}, { deep: true })

onBeforeRouteLeave(() => {
  flushAutosave()
  return true
})

onMounted(() => window.addEventListener('beforeunload', flushAutosave))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', flushAutosave)
  flushAutosave()
})

function downloadEml() {
  // Inline-styled (see ~/utils/emailExportHtml.ts) - a plain `Content-Type:
  // text/html` body with no styling of its own renders bare/unformatted in
  // whatever mail client opens the .eml, the same way a plain-text clipboard
  // copy did (see copyToClipboard below) - the underlying issue in both
  // cases is the app's own `.prose-tiptap`/`[data-callout]`/etc. CSS living
  // in a stylesheet that never travels with the content once it leaves this
  // app, so every element needs its own inline `style="..."` stamped on
  // before it's handed to something else.
  const resolvedSubject = resolveTokensForPrint(subject.value, SAMPLE_VALUES)
  const html = buildEmailExportHtml(body.value, SAMPLE_VALUES, background.value, footerNote.value)
  downloadEmlFile(resolvedSubject, html, name.value.replace(/\s+/g, '_'))
  toast.add({ title: 'Downloaded .eml file', icon: 'i-lucide-download', color: 'success' })
}

async function copyToClipboard() {
  // Writes both a `text/html` and a `text/plain` clipboard entry (via
  // ClipboardItem, not the plain-text-only `writeText`) - a real mail client
  // like Outlook reads the `text/html` flavor on paste and keeps the
  // headings/table/callout/banner structure and inline styling intact
  // (see ~/utils/emailExportHtml.ts for why every element needs its own
  // inline style, not just a class name). `writeText` only ever writes
  // `text/plain`, which is exactly why a pasted template previously landed
  // as one unformatted run of text with the raw `{{TOKEN}}` placeholders
  // still showing, instead of looking like the styled email it's meant to
  // preview.
  try {
    const html = buildEmailExportHtml(body.value, SAMPLE_VALUES, background.value, footerNote.value)
    const text = buildEmailExportPlainText(body.value, SAMPLE_VALUES)
    if (window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })
      ])
    } else {
      // Older/non-Chromium browsers without ClipboardItem support - falls
      // back to the plain-text-only behavior rather than failing outright.
      await navigator.clipboard.writeText(text)
    }
    toast.add({ title: 'Copied to clipboard', description: 'Paste into Outlook/Gmail to keep the formatting.', icon: 'i-lucide-copy', color: 'success' })
  } catch {
    toast.add({ title: 'Could not copy to clipboard', icon: 'i-lucide-triangle-alert', color: 'error' })
  }
}
</script>

<template>
  <div class="bg-gray-50 min-h-screen">
    <div data-tabs-header class="sticky top-16 z-10 bg-card px-6 pt-4 pb-3 border-b border-default">
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
                to="/templates?tab=email"
              />
            </UTooltip>
            <template v-if="editingName">
              <UInput
                v-model="nameDraft"
                variant="none"
                autofocus
                class="w-full max-w-xl p-0 text-lg font-semibold text-highlighted [&_input]:p-0 [&_input]:h-auto [&_input]:text-lg [&_input]:font-semibold"
                placeholder="Untitled"
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
              <h1 class="text-lg font-semibold text-highlighted truncate">{{ name || 'Untitled' }}</h1>
              <UTooltip v-if="isEditing" text="Edit name">
                <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-pencil" class="text-muted opacity-0 group-hover:opacity-100" aria-label="Edit name" @click="startEditName" />
              </UTooltip>
            </template>
          </div>

          <div class="flex items-center gap-1.5 group mt-0.5 pl-[34px]">
            <template v-if="editingDescription">
              <UInput
                v-model="descriptionDraft"
                variant="none"
                autofocus
                :maxlength="DESCRIPTION_MAX"
                class="w-full max-w-xl p-0 text-sm text-muted [&_input]:p-0 [&_input]:h-auto [&_input]:text-sm"
                placeholder="When this template is sent"
                @keyup.enter="commitDescription"
                @keyup.esc="editingDescription = false"
              />
              <span class="text-[10px] text-dimmed shrink-0">{{ descriptionDraft.length }}/{{ DESCRIPTION_MAX }}</span>
              <UTooltip text="Save">
                <UButton color="primary" variant="ghost" size="xs" square icon="i-lucide-check" aria-label="Save description" @click="commitDescription" />
              </UTooltip>
              <UTooltip text="Cancel">
                <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-x" class="text-muted" aria-label="Cancel editing description" @click="editingDescription = false" />
              </UTooltip>
            </template>
            <template v-else>
              <p class="text-sm text-muted truncate max-w-md">{{ description || 'No description' }}</p>
              <UTooltip v-if="isEditing" text="Edit description">
                <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-pencil" class="text-muted opacity-0 group-hover:opacity-100 shrink-0" aria-label="Edit description" @click="startEditDescription" />
              </UTooltip>
            </template>
          </div>
        </div>

        <!-- Status + save stamp sit beside the primary action instead of
             beside the title, so editing the title never reflows them - and
             grouping "current state" with "state-changing controls" here
             matches where users expect to look for both. Edit/Save leads,
             the overflow menu trails, per the same left-to-right priority
             order as the actions themselves. -->
        <div class="flex items-center gap-3 shrink-0">
          <div class="flex items-center gap-2">
            <SharedStatusBadge :status="status" />
            <EmailModeBadge :mode="mode" />
            <SharedAutosaveIndicator :state="saveState" :last-saved-at="lastSavedAt" />
          </div>

          <div class="flex items-center gap-2">
            <UTooltip v-if="!isEditing" text="Browse the placeholder library">
              <UButton color="neutral" variant="outline" size="md" icon="i-lucide-braces" @click="placeholderBrowseOpen = true">
                Placeholders
              </UButton>
            </UTooltip>
            <UButton v-if="isEditing" color="neutral" variant="outline" size="md" icon="i-lucide-x" @click="cancelEdit">
              Cancel
            </UButton>
            <UButton
              color="primary"
              variant="solid"
              size="md"
              :icon="isEditing ? 'i-lucide-check' : 'i-lucide-pen'"
              :class="{ 'btn-ready-pulse': savePulse.active.value }"
              @click="isEditing ? saveEdit() : enterEditMode()"
            >
              {{ isEditing ? 'Save' : 'Edit' }}
            </UButton>
            <UDropdownMenu :items="overflowMenuItems" :ui="{ content: 'w-48' }" :content="{ onCloseAutoFocus: preventCloseAutoFocus }">
              <UTooltip text="More actions">
                <UButton color="neutral" variant="ghost" size="md" square icon="i-lucide-more-horizontal" class="text-muted" aria-label="More actions" />
              </UTooltip>
            </UDropdownMenu>
          </div>
        </div>
      </div>

      <!-- Tabs stay visually secondary to the actions above; Placeholder
           Library now has the row to itself since Mode/Status moved above -->
      <div class="flex items-center gap-2 mt-3 flex-wrap">
        <SharedAlignedTabs
          v-model="activeTab"
          :items="[{ label: 'Email', value: 'editor', icon: 'i-lucide-mail' }, { label: 'History', value: 'history', icon: 'i-lucide-history' }]"
        />
      </div>
    </div>

    <div class="px-6 py-6 space-y-4">
      <EmailPlaceholderDrawer
        v-model="placeholderBrowseOpen"
        read-only
        :groups="tokenGroups"
        :used-codes="usedCodes"
        :context-label="name"
        :context-mode="mode"
      />
      <EmailPlaceholderDrawer
        v-model="placeholderOpen"
        :groups="tokenGroups"
        :used-codes="usedCodes"
        :context-label="name"
        :context-mode="mode"
        :target-label="insertTarget === 'subject' ? 'Subject line' : 'Body'"
        :inserter="insertPlaceholder"
      />

      <!-- Editor view keeps the fields column and the live preview as two
           separate cards (their own radius and border, with a real gap
           between them) rather than one merged box with an internal
           divider line - History has no live preview and its content is a
           list of cards in its own right (same anatomy as the templates
           list), so it sits directly on the page background instead of
           inside another bordered box wrapping a plain list of bordered
           boxes. -->
      <div v-if="activeTab === 'editor'" class="flex lg:flex-row flex-col gap-[10px] stage-enter">
        <div class="flex flex-col flex-1 min-w-0 rounded-lg border border-default bg-card overflow-hidden">
          <div class="px-6 pt-4 pb-6 space-y-4 flex-1 overflow-y-auto fade-scroll-y">
            <EmailRetiredBanner v-if="status === 'retired'" />

            <EmailSubjectField
              ref="subjectField"
              v-model="subject"
              :editing="isEditing"
              @open-placeholder="openPlaceholderDrawer('subject')"
            />
            <EmailBodyField
              ref="bodyField"
              v-model="body"
              :editing="isEditing"
              @open-placeholder="openPlaceholderDrawer('body')"
            />

            <div>
              <EmailFieldLabel label="Background" />
              <UPopover>
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :disabled="!isEditing"
                  trailing-icon="i-lucide-chevron-down"
                >
                  <span
                    class="size-4 rounded-full ring-1 ring-default shrink-0"
                    :style="{ background: background || '#ffffff' }"
                  />
                  <span class="text-highlighted">{{ background ? 'Custom' : 'None (white)' }}</span>
                </UButton>
                <template #content>
                  <div class="grid grid-cols-6 gap-1 p-2">
                    <button
                      type="button"
                      class="size-6 rounded-full ring-1 ring-default bg-card flex items-center justify-center"
                      aria-label="No background"
                      @click="background = undefined"
                    >
                      <UIcon name="i-lucide-x" class="size-3.5 text-dimmed" />
                    </button>
                    <button
                      v-for="c in BACKGROUND_COLORS"
                      :key="c"
                      type="button"
                      class="size-6 rounded-full ring-1 ring-default"
                      :style="{ background: c }"
                      :aria-label="`Set background ${c}`"
                      @click="background = c"
                    />
                  </div>
                </template>
              </UPopover>
            </div>

            <div>
              <EmailFieldLabel label="Footer note" optional />
              <UInput
                v-model="footerNote"
                :disabled="!isEditing"
                aria-label="Footer note"
                placeholder="e.g. You are receiving this because you are an active GoTeam Team Member."
                size="sm"
                class="w-full"
              />
              <p class="text-xs text-dimmed mt-1">
                Fine print shown below the email, like an unsubscribe note.
              </p>
            </div>

            <EmailAttachSection
              v-if="current.attachment !== 'none'"
              :name="current.attachment"
              :current-form-id="current.attachmentFormId"
              subtitle="Online form via link"
              :form-options="activeFormOptions"
              @preview="previewAttachment"
              @edit="editAttachment"
              @replace="attachForm"
              @remove="removeAttachment"
            />

            <div v-else class="flex items-center">
              <UDropdownMenu
                :items="[activeFormOptions.map(f => ({ label: f.name, icon: 'i-lucide-file-text', onSelect: () => attachForm(f.id) }))]"
                :filter="activeFormOptions.length > 5"
                :ui="{ content: 'w-72 max-h-[220px] overflow-y-auto fade-scroll-y' }"
                :content="{ align: 'start', onCloseAutoFocus: preventCloseAutoFocus }"
              >
                <button
                  type="button"
                  class="flex items-center gap-2 rounded-lg border border-dashed border-accented px-4 py-2.5 text-sm font-medium text-muted hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                >
                  <UIcon name="i-lucide-paperclip" class="size-4" />
                  Attach a form
                  <UIcon name="i-lucide-chevron-down" class="size-4" />
                </button>
              </UDropdownMenu>
            </div>

            <EmailRecipientsSection
              to-token="{{TM_EMAIL}}"
              :cc="cc"
              :bcc="bcc"
              @add-cc="addCc"
              @add-bcc="addBcc"
              @remove-cc="removeCc"
              @remove-bcc="removeBcc"
            />
          </div>
        </div>

        <EmailPreviewPane :subject="subject" :body="body" :background="background" :footer-note="footerNote" />
      </div>

      <EmailHistoryTab
        v-else
        class="stage-enter"
        :entries="historyEntries"
        :retired="status === 'retired'"
        @view="viewHistoryEntry"
        @restore="restoreHistoryEntry"
      />

      <EmailFullPreviewModal
        v-if="fullPreviewEntry"
        v-model="fullPreviewOpen"
        :title="fullPreviewEntry.label"
        icon="i-lucide-history"
        :subject="fullPreviewEntry.subject"
        :body="fullPreviewEntry.body"
        show-restore
        @restore="restoreHistoryEntry(fullPreviewEntry); fullPreviewOpen = false"
      />
    </div>
  </div>
</template>
