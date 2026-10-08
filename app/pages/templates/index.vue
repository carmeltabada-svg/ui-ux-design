<script setup lang="ts">
// Templates directory - Email and Forms are functionally twins (named,
// described, mode-tagged, status-tracked, versioned content records
// referenced elsewhere in the system), so they now share one list-cards page
// under two tabs instead of Email living behind a drawer and Forms living
// under Master Data.
import { TEMPLATES, TEMPLATE_GROUPS } from '~/data/templates'
import { ensureTemplateRuntime, createTemplate as createTemplateRuntime, duplicateTemplate, deleteTemplate, CUSTOM_TEMPLATE_IDS, DELETED_TEMPLATE_KEYS } from '~/data/templateRuntime'
import { RETRIEVAL_FORMS, RETRIEVAL_FORM_SECTIONS, RETRIEVAL_FORM_CONTENT, duplicateForm, createDraftForm, deleteForm } from '~/data/retrievalForms'
import { ensureFormContent } from '~/utils/formContentMigration'

const route = useRoute()
const toast = useToast()

useSeoMeta({
  title: 'AMS · Templates',
  description: 'The emails and forms your team sends and collects, all in one place.'
})

const activeTab = ref<'email' | 'forms'>(route.query.tab === 'forms' ? 'forms' : 'email')
watch(activeTab, (tab) => {
  navigateTo({ query: { ...route.query, tab } }, { replace: true })
})

const tabItems = [
  { label: 'Email', value: 'email' as const, icon: 'i-lucide-mail' },
  { label: 'Forms', value: 'forms' as const, icon: 'i-lucide-form' }
]

// Draft/retired get a small status dot on the row icon (different colors per
// state) so their state is visible at a glance without reading the badge;
// active rows stay clean since "active" is the expected default state.
function statusDotColor(status: string) {
  if (status === 'draft') return '#94A3B8'
  if (status === 'retired') return 'rgb(137,75,0)'
  return null
}

const modeChips = [
  { label: 'All modes', value: 'all' as const },
  { label: 'Onsite', value: 'onsite' as const },
  { label: 'Remote', value: 'remote' as const }
]

const statusChips = [
  { label: 'All', value: 'all' as const },
  { label: 'Active', value: 'active' as const },
  { label: 'Draft', value: 'draft' as const },
  { label: 'Retired', value: 'retired' as const }
]

// --- Email tab -----------------------------------------------------------
const emailSearch = ref('')
const emailStatusFilter = ref<'all' | 'active' | 'draft' | 'retired'>('all')
const emailModeFilter = ref<'all' | 'onsite' | 'remote'>('all')

const emailModeFilterLabel = computed(() => modeChips.find(c => c.value === emailModeFilter.value)?.label ?? 'All modes')
const emailModeMenuItems = computed(() => [
  modeChips.map(chip => ({
    label: chip.label,
    type: 'checkbox' as const,
    checked: emailModeFilter.value === chip.value,
    ui: emailModeFilter.value === chip.value ? { itemLabel: 'text-primary font-medium', itemTrailingIcon: 'text-primary' } : undefined,
    onSelect: () => { emailModeFilter.value = chip.value }
  }))
])

const allEmailKeys = computed(() => [
  ...CUSTOM_TEMPLATE_IDS,
  ...TEMPLATE_GROUPS.flatMap(g => g.keys).filter(key => TEMPLATES[key])
].filter(key => !DELETED_TEMPLATE_KEYS.has(key)))

const emailRows = computed(() => allEmailKeys.value.map((key) => {
  const rt = ensureTemplateRuntime(key)
  return {
    key,
    name: rt.name,
    mode: rt.mode,
    description: rt.description,
    status: rt.status,
    lastSavedAt: rt.lastSavedAt
  }
}))

const filteredEmailRows = computed(() => {
  const q = emailSearch.value.toLowerCase()
  return emailRows.value.filter((row) => {
    if (emailStatusFilter.value !== 'all' && row.status !== emailStatusFilter.value) return false
    if (emailModeFilter.value !== 'all' && row.mode !== emailModeFilter.value) return false
    if (q && !row.name.toLowerCase().includes(q) && !row.description.toLowerCase().includes(q)) return false
    return true
  })
})

const EMAIL_PAGE_SIZE = 7
const emailPage = ref(1)
watch([emailSearch, emailStatusFilter, emailModeFilter], () => { emailPage.value = 1 })
watch(filteredEmailRows, (rows) => {
  const maxPage = Math.max(1, Math.ceil(rows.length / EMAIL_PAGE_SIZE))
  if (emailPage.value > maxPage) emailPage.value = maxPage
})
const paginatedEmailRows = computed(() => {
  const start = (emailPage.value - 1) * EMAIL_PAGE_SIZE
  return filteredEmailRows.value.slice(start, start + EMAIL_PAGE_SIZE)
})

function createTemplate() {
  const id = createTemplateRuntime()
  navigateTo(`/templates/email/${id}/edit?created=1`)
}

// "Start from an existing template" reuses the exact same copy mechanism as
// a row's "Duplicate" action (duplicateTemplate: fresh id, forced to draft)
// - it's the same operation from a different entry point (starting a new
// template with a head start, vs. copying one you're already looking at),
// not a second competing concept.
function createFromExisting(key: string) {
  const id = duplicateTemplate(key)
  navigateTo(`/templates/email/${id}/edit?created=1`)
}

const createMenuItems = computed(() => [[
  { label: 'Start from blank', icon: 'i-lucide-file-plus', onSelect: createTemplate },
  {
    label: 'Start from an existing template',
    icon: 'i-lucide-copy',
    ui: { content: 'ml-1 max-h-72 overflow-y-auto fade-scroll-y' },
    filter: allEmailKeys.value.length > 5,
    children: allEmailKeys.value.map(key => ({
      label: ensureTemplateRuntime(key).name,
      onSelect: () => createFromExisting(key)
    }))
  }
]])

function duplicateTemplateRow(key: string) {
  const id = duplicateTemplate(key)
  toast.add({
    title: 'Template duplicated',
    description: `"${ensureTemplateRuntime(id).name}" was added as a draft.`,
    icon: 'i-lucide-copy',
    color: 'success'
  })
}

function retireTemplateRow(key: string) {
  ensureTemplateRuntime(key).status = 'retired'
  toast.add({ title: 'Template retired', icon: 'i-lucide-archive', color: 'warning' })
}

function reactivateTemplateRow(key: string) {
  ensureTemplateRuntime(key).status = 'active'
  toast.add({ title: 'Template reactivated', icon: 'i-lucide-rotate-ccw', color: 'success' })
}

// The row's own action buttons (Edit/Duplicate/•••) only show up on
// `group-hover` - but the ••• menu's own content is portaled out to the end
// of <body>, not rendered inside the row's `.group` element, so the instant
// the mouse actually moves onto the opened menu to click "Retire"/"Delete",
// the cursor is no longer over the row at all - `group-hover` drops, and
// every one of those buttons (including the trigger the user was just
// looking at) faded straight back to invisible while the menu was still
// open. Tracked per list (only one row's menu is ever open at a time) so
// the row's action container can force itself visible for exactly as long
// as its own menu is open, not just while the mouse happens to still be
// over it.
const openEmailActionsKey = ref<string | null>(null)
const openFormActionsId = ref<string | null>(null)

// --- Delete (email + forms share one confirm modal) -------------------------
// A real UModal, not `window.confirm()` - the browser's native dialog can't
// carry the app's own styling/wording and reads as a jarring escape from the
// rest of the UI for what's otherwise a fully custom design system.
const deleteTarget = ref<{ type: 'email' | 'form', id: string, name: string } | null>(null)
const deleteModalOpen = computed({
  get: () => !!deleteTarget.value,
  set: (v) => { if (!v) deleteTarget.value = null }
})

function requestDeleteTemplate(key: string) {
  deleteTarget.value = { type: 'email', id: key, name: ensureTemplateRuntime(key).name }
}

function requestDeleteForm(form: (typeof RETRIEVAL_FORMS)[number]) {
  deleteTarget.value = { type: 'form', id: form.id, name: form.name }
}

function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  if (target.type === 'email') {
    deleteTemplate(target.id)
    toast.add({ title: 'Template deleted', icon: 'i-lucide-trash-2', color: 'error' })
  } else {
    deleteForm(target.id)
    toast.add({ title: 'Form deleted', icon: 'i-lucide-trash-2', color: 'error' })
  }
  deleteTarget.value = null
}

// --- Multi-select + bulk retire (email only) --------------------------------
const selectedKeys = ref<Set<string>>(new Set())

function toggleSelected(key: string, checked: boolean) {
  const next = new Set(selectedKeys.value)
  if (checked) next.add(key)
  else next.delete(key)
  selectedKeys.value = next
}

function clearSelection() {
  selectedKeys.value = new Set()
}

// A selection can mix retired and non-retired templates - a single "Retire
// selected" button can't resolve that (retiring an already-retired template
// is a no-op, and there was no way to reactivate one from the bulk bar at
// all). Instead, each action only ever touches the subset of the selection
// it actually applies to, and both actions show whenever their subset is
// non-empty - so a mixed selection just gets both buttons.
const selectedNonRetiredCount = computed(() => {
  let n = 0
  selectedKeys.value.forEach((key) => { if (ensureTemplateRuntime(key).status !== 'retired') n++ })
  return n
})
const selectedRetiredCount = computed(() => selectedKeys.value.size - selectedNonRetiredCount.value)

function retireSelected() {
  let count = 0
  selectedKeys.value.forEach((key) => {
    const rt = ensureTemplateRuntime(key)
    if (rt.status !== 'retired') { rt.status = 'retired'; count++ }
  })
  toast.add({ title: `${count} template${count === 1 ? '' : 's'} retired`, icon: 'i-lucide-archive', color: 'warning' })
  clearSelection()
}

function reactivateSelected() {
  let count = 0
  selectedKeys.value.forEach((key) => {
    const rt = ensureTemplateRuntime(key)
    if (rt.status === 'retired') { rt.status = 'active'; count++ }
  })
  toast.add({ title: `${count} template${count === 1 ? '' : 's'} reactivated`, icon: 'i-lucide-rotate-ccw', color: 'success' })
  clearSelection()
}

// --- Forms tab -------------------------------------------------------------
const formSearch = ref('')
const formStatusFilter = ref<'all' | 'active' | 'draft' | 'retired'>('all')
const formModeFilter = ref<'all' | 'onsite' | 'remote'>('all')

const formModeFilterLabel = computed(() => modeChips.find(c => c.value === formModeFilter.value)?.label ?? 'All modes')
const formModeMenuItems = computed(() => [
  modeChips.map(chip => ({
    label: chip.label,
    type: 'checkbox' as const,
    checked: formModeFilter.value === chip.value,
    ui: formModeFilter.value === chip.value ? { itemLabel: 'text-primary font-medium', itemTrailingIcon: 'text-primary' } : undefined,
    onSelect: () => { formModeFilter.value = chip.value }
  }))
])

const filteredForms = computed(() => {
  const q = formSearch.value.toLowerCase()
  return RETRIEVAL_FORMS.filter((form) => {
    if (formStatusFilter.value !== 'all' && form.status !== formStatusFilter.value) return false
    if (formModeFilter.value !== 'all' && form.mode !== formModeFilter.value) return false
    if (q && !form.name.toLowerCase().includes(q) && !form.description.toLowerCase().includes(q)) return false
    return true
  })
})

const FORM_PAGE_SIZE = 7
const formPage = ref(1)
watch([formSearch, formStatusFilter, formModeFilter], () => { formPage.value = 1 })
watch(filteredForms, (forms) => {
  const maxPage = Math.max(1, Math.ceil(forms.length / FORM_PAGE_SIZE))
  if (formPage.value > maxPage) formPage.value = maxPage
})
const paginatedForms = computed(() => {
  const start = (formPage.value - 1) * FORM_PAGE_SIZE
  return filteredForms.value.slice(start, start + FORM_PAGE_SIZE)
})

// Creates the draft here, eagerly, and navigates straight to its real id -
// mirroring createTemplate() above (the email flow). This used to navigate
// straight to the literal `/templates/forms/new/edit` route and let that
// page's own setup create the draft and immediately re-navigate to the real
// id. That redirect-on-mount dance works fine on a full page load (confirmed
// - SSR/hydration has one clean navigation to settle), but from this SPA
// button click it raced: this navigateTo() and the destination page's own
// await navigateTo(...) were two navigations landing back to back in the
// same in-flight Vue Router transition, and the second one got silently
// dropped - the exact "flash, then nothing happens" the user reported.
// Creating the draft up front means there's only ever one navigation for
// this click to resolve.
function createForm() {
  const draft = createDraftForm()
  RETRIEVAL_FORMS.push(draft)
  RETRIEVAL_FORM_SECTIONS[draft.id] = []
  navigateTo(`/templates/forms/${draft.id}/edit?created=1`)
}

// "Start from an existing form" reuses duplicateForm() - the same fresh-id,
// forced-to-draft copy the row-level Duplicate action uses, from a
// different entry point.
function createFormFromExisting(source: (typeof RETRIEVAL_FORMS)[number]) {
  const { form, sections, content } = duplicateForm(source, RETRIEVAL_FORM_SECTIONS[source.id] ?? [], ensureFormContent(source.id))
  RETRIEVAL_FORMS.push(form)
  RETRIEVAL_FORM_SECTIONS[form.id] = sections
  RETRIEVAL_FORM_CONTENT[form.id] = content
  navigateTo(`/templates/forms/${form.id}/edit?mode=edit`)
}

const createFormMenuItems = computed(() => [[
  { label: 'Start from blank', icon: 'i-lucide-file-plus', onSelect: createForm },
  {
    label: 'Start from an existing form',
    icon: 'i-lucide-copy',
    ui: { content: 'ml-1 max-h-72 overflow-y-auto fade-scroll-y' },
    filter: RETRIEVAL_FORMS.length > 5,
    children: RETRIEVAL_FORMS.map(f => ({
      label: f.name,
      onSelect: () => createFormFromExisting(f)
    }))
  }
]])

function duplicateFormRow(source: (typeof RETRIEVAL_FORMS)[number]) {
  const { form, sections, content } = duplicateForm(source, RETRIEVAL_FORM_SECTIONS[source.id] ?? [], ensureFormContent(source.id))
  RETRIEVAL_FORMS.push(form)
  RETRIEVAL_FORM_SECTIONS[form.id] = sections
  RETRIEVAL_FORM_CONTENT[form.id] = content
  toast.add({
    title: 'Form duplicated',
    description: `"${form.name}" was added as a draft.`,
    icon: 'i-lucide-copy',
    color: 'success'
  })
}

function retireFormRow(form: (typeof RETRIEVAL_FORMS)[number]) {
  form.status = 'retired'
  toast.add({ title: 'Form retired', icon: 'i-lucide-archive', color: 'warning' })
}

function reactivateFormRow(form: (typeof RETRIEVAL_FORMS)[number]) {
  form.status = 'active'
  toast.add({ title: 'Form reactivated', icon: 'i-lucide-rotate-ccw', color: 'success' })
}

// --- Multi-select + bulk retire (forms) - same pattern as email's -----------
const selectedFormIds = ref<Set<string>>(new Set())

function toggleFormSelected(id: string, checked: boolean) {
  const next = new Set(selectedFormIds.value)
  if (checked) next.add(id)
  else next.delete(id)
  selectedFormIds.value = next
}

function clearFormSelection() {
  selectedFormIds.value = new Set()
}

const selectedFormNonRetiredCount = computed(() => {
  let n = 0
  selectedFormIds.value.forEach((id) => {
    const form = RETRIEVAL_FORMS.find(f => f.id === id)
    if (form && form.status !== 'retired') n++
  })
  return n
})
const selectedFormRetiredCount = computed(() => selectedFormIds.value.size - selectedFormNonRetiredCount.value)

function retireFormsSelected() {
  let count = 0
  selectedFormIds.value.forEach((id) => {
    const form = RETRIEVAL_FORMS.find(f => f.id === id)
    if (form && form.status !== 'retired') { form.status = 'retired'; count++ }
  })
  toast.add({ title: `${count} form${count === 1 ? '' : 's'} retired`, icon: 'i-lucide-archive', color: 'warning' })
  clearFormSelection()
}

function reactivateFormsSelected() {
  let count = 0
  selectedFormIds.value.forEach((id) => {
    const form = RETRIEVAL_FORMS.find(f => f.id === id)
    if (form && form.status === 'retired') { form.status = 'active'; count++ }
  })
  toast.add({ title: `${count} form${count === 1 ? '' : 's'} reactivated`, icon: 'i-lucide-rotate-ccw', color: 'success' })
  clearFormSelection()
}
</script>

<template>
  <!-- `h-[calc(100vh-4rem)]` (same convention as the email/forms editor
       pages) rather than the page's old `min-h-full` + window-level scroll -
       the header (bands 1+2) used to stay in view via `sticky top-16` while
       the *window* scrolled the list underneath it, with a fake gradient
       overlay standing in for a "fading under the header" effect. That
       couldn't get a matching fade at the bottom (nothing for the list to
       visually slide under down there), which is what left the bottom of
       the list looking like it just stops dead instead of fading like every
       other scrollable panel in the app. Making the list its own bounded
       scroll region - sized to the viewport, not the window - lets it use
       the same real `fade-scroll-y` mask as those other panels, which fades
       both edges identically instead of needing two different techniques. -->
  <div class="bg-gray-50 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
    <!-- Bands 1 and 2 (title+tabs, then search+filters) - no longer sticky;
         with the list below now scrolling in its own bounded region (see
         above), this header simply sits above it as a normal, non-scrolling
         flex item and never needs to reposition itself on scroll at all. -->
    <div class="shrink-0 bg-gray-50">
      <div data-tabs-header class="bg-white px-6 pt-4 pb-3 border-b border-default">
        <div class="flex items-start justify-between gap-5 mb-4">
          <div>
            <h1 class="text-2xl font-semibold text-highlighted">Templates</h1>
            <p class="text-sm text-muted max-w-[560px] pt-1">
              The emails and forms your team sends and collects, all in one place.
            </p>
          </div>

          <!-- No open-transition on this one specifically (`animate-none`) -
               a real, reproduced bug: the default ~100ms scale-in means the
               menu's *final* item positions aren't where they are yet for a
               brief window right after opening, so a quick, deliberate
               second click aimed at a known item position (exactly how
               someone reaching for "Start from blank" a second time
               would click) can land on whatever was underneath instead -
               the menu visually closes (the outside click that is) with
               nothing having actually happened. Instant appearance removes
               that window entirely for this specific, high-traffic CTA. -->
          <UDropdownMenu v-if="activeTab === 'email'" :items="createMenuItems" :ui="{ content: 'w-64 data-[state=open]:animate-none data-[state=closed]:animate-none' }">
            <UButton
              color="primary"
              variant="solid"
              size="lg"
              icon="i-lucide-mail-plus"
              trailing-icon="i-lucide-chevron-down"
            >
              Create Template
            </UButton>
          </UDropdownMenu>
          <UDropdownMenu v-else :items="createFormMenuItems" :ui="{ content: 'w-64 data-[state=open]:animate-none data-[state=closed]:animate-none' }">
            <UButton
              color="primary"
              variant="solid"
              size="lg"
              icon="i-lucide-form"
              trailing-icon="i-lucide-chevron-down"
            >
              Create Form
            </UButton>
          </UDropdownMenu>
        </div>

        <SharedAlignedTabs v-model="activeTab" :items="tabItems" />
      </div>

      <!-- Band 2: search + filters, a visually separate card sitting right
           below band 1 inside the same sticky wrapper. No `mb-3` here - that
           gap now lives as the scroll region's own `pt-3` below instead (see
           the comment down there for why it moved). -->
      <div class="bg-white mx-6 mt-3 px-4 py-4 rounded-lg border border-default">
      <div class="flex flex-col sm:flex-row sm:items-center gap-3">
        <!-- Email tab -->
        <template v-if="activeTab === 'email'">
          <UInput
            v-model="emailSearch"
            icon="i-lucide-search"
            aria-label="Search email templates"
            placeholder="Search templates..."
            size="md"
            class="w-full sm:max-w-xs"
          />
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-for="chip in statusChips"
              :key="chip.value"
              :color="emailStatusFilter === chip.value ? 'primary' : 'neutral'"
              :variant="emailStatusFilter === chip.value ? 'solid' : 'outline'"
              size="sm"
              class="rounded-full"
              @click="emailStatusFilter = chip.value"
            >
              {{ chip.label }}
            </UButton>
            <span class="w-px h-5 bg-accented mx-1" />
            <UDropdownMenu :items="emailModeMenuItems" :ui="{ content: 'w-40' }">
              <UButton color="neutral" variant="outline" size="sm" trailing-icon="i-lucide-chevron-down" class="rounded-full">
                {{ emailModeFilterLabel }}
              </UButton>
            </UDropdownMenu>
          </div>

          <!-- Bulk-selection controls replace nothing in the row's flow - they
               just appear at the far right of this same search/filter row so
               they don't push a whole separate banner above the list -->
          <template v-if="selectedKeys.size">
            <span class="text-sm font-medium text-primary sm:ml-auto">{{ selectedKeys.size }} selected</span>
            <UButton v-if="selectedNonRetiredCount" color="neutral" variant="ghost" size="sm" icon="i-lucide-archive" class="text-orange-600" @click="retireSelected">
              Retire selected
            </UButton>
            <UButton v-if="selectedRetiredCount" color="neutral" variant="ghost" size="sm" icon="i-lucide-rotate-ccw" class="text-emerald-600" @click="reactivateSelected">
              Reactivate selected
            </UButton>
            <UButton color="neutral" variant="ghost" size="sm" class="text-muted" @click="clearSelection">
              Clear
            </UButton>
          </template>
        </template>

        <!-- Forms tab -->
        <template v-else>
          <UInput
            v-model="formSearch"
            icon="i-lucide-search"
            aria-label="Search forms"
            placeholder="Search forms..."
            size="md"
            class="w-full sm:max-w-xs"
          />
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-for="chip in statusChips"
              :key="chip.value"
              :color="formStatusFilter === chip.value ? 'primary' : 'neutral'"
              :variant="formStatusFilter === chip.value ? 'solid' : 'outline'"
              size="sm"
              class="rounded-full"
              @click="formStatusFilter = chip.value"
            >
              {{ chip.label }}
            </UButton>
            <span class="w-px h-5 bg-accented mx-1" />
            <UDropdownMenu :items="formModeMenuItems" :ui="{ content: 'w-40' }">
              <UButton color="neutral" variant="outline" size="sm" trailing-icon="i-lucide-chevron-down" class="rounded-full">
                {{ formModeFilterLabel }}
              </UButton>
            </UDropdownMenu>
          </div>

          <template v-if="selectedFormIds.size">
            <span class="text-sm font-medium text-primary sm:ml-auto">{{ selectedFormIds.size }} selected</span>
            <UButton v-if="selectedFormNonRetiredCount" color="neutral" variant="ghost" size="sm" icon="i-lucide-archive" class="text-orange-600" @click="retireFormsSelected">
              Retire selected
            </UButton>
            <UButton v-if="selectedFormRetiredCount" color="neutral" variant="ghost" size="sm" icon="i-lucide-rotate-ccw" class="text-emerald-600" @click="reactivateFormsSelected">
              Reactivate selected
            </UButton>
            <UButton color="neutral" variant="ghost" size="sm" class="text-muted" @click="clearFormSelection">
              Clear
            </UButton>
          </template>
        </template>
      </div>
      </div>
    </div>

    <!-- The list itself - its own bounded, masked scroll region (see the
         root div's comment above). `fade-scroll-y` fades both the top and
         bottom edges identically, same utility every other scrollable
         panel/drawer in the app already uses (see main.css), instead of the
         page's old top-only gradient hack that couldn't have a bottom
         counterpart.
         The 12px gap to band 2 above lives as this wrapper's own `pt-3`,
         not as band 2's external `mb-3` (moved from there - see its own
         comment) - the fade mask is painted on *this* scrollable element,
         starting from its very first pixel, so with zero top padding that
         12px fade zone landed directly on the first row's own border/
         background instead of on empty space, reading as a stray horizontal
         "stroke" cutting into the card rather than a clean fade. Giving the
         gap to this element's own padding instead puts the fade's top 12px
         over blank space, exactly like every other `fade-scroll-y` region
         in the app (they all have their own leading padding for the same
         reason - see PlaceholderDrawer.vue's `pt-[10px]`, for one). -->
    <div :key="activeTab" class="flex-1 min-h-0 overflow-y-auto fade-scroll-y stage-enter">
    <div class="px-6 pt-3 pb-4">
      <!-- Email tab -->
      <template v-if="activeTab === 'email'">
        <div v-if="filteredEmailRows.length" class="flex flex-col gap-[10px]">
          <div
            v-for="row in paginatedEmailRows"
            :key="row.key"
            class="group relative flex items-center gap-3 rounded-lg border border-default bg-white px-4 py-3 hover:bg-elevated/50 transition-colors"
          >
            <UCheckbox
              :model-value="selectedKeys.has(row.key)"
              class="shrink-0 transition-opacity"
              :class="selectedKeys.has(row.key) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
              aria-label="Select template"
              @update:model-value="(v) => toggleSelected(row.key, !!v)"
            />

            <NuxtLink :to="`/templates/email/${row.key}/edit`" class="flex items-center gap-3 flex-1 min-w-0">
              <div class="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 relative">
                <UIcon name="i-lucide-mail" class="size-4 text-primary" />
                <span
                  v-if="statusDotColor(row.status)"
                  class="absolute -top-0.5 -right-0.5 size-2 rounded-full ring-1 ring-white"
                  :style="{ background: statusDotColor(row.status)! }"
                />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-semibold text-highlighted">{{ row.name }}</span>
                  <SharedStatusBadge :status="row.status" />
                  <EmailModeBadge :mode="row.mode" />
                </div>
                <p class="text-sm text-muted mt-0.5 truncate">{{ row.description }}</p>
                <p v-if="row.lastSavedAt" class="text-xs text-dimmed mt-1">
                  {{ row.status === 'draft' ? 'Last saved' : 'Updated' }} {{ row.lastSavedAt }}
                </p>
              </div>
            </NuxtLink>

            <div
              class="flex items-center gap-1 shrink-0 transition-opacity"
              :class="openEmailActionsKey === row.key ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
            >
              <UTooltip text="Edit">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  square
                  icon="i-lucide-pencil"
                  class="text-muted"
                  aria-label="Edit"
                  @click.stop.prevent="navigateTo(`/templates/email/${row.key}/edit?mode=edit`)"
                />
              </UTooltip>
              <UTooltip text="Duplicate">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  square
                  icon="i-lucide-copy"
                  class="text-muted"
                  aria-label="Duplicate"
                  @click.stop.prevent="duplicateTemplateRow(row.key)"
                />
              </UTooltip>
              <UDropdownMenu
                :items="[[
                  row.status !== 'retired'
                    ? { label: 'Retire', icon: 'i-lucide-archive', onSelect: () => retireTemplateRow(row.key) }
                    : { label: 'Reactivate', icon: 'i-lucide-rotate-ccw', onSelect: () => reactivateTemplateRow(row.key) },
                  { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => requestDeleteTemplate(row.key) }
                ]]"
                :content="{ align: 'end' }"
                @update:open="(v) => { openEmailActionsKey = v ? row.key : null }"
              >
                <UTooltip text="More actions">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    square
                    icon="i-lucide-ellipsis"
                    class="text-muted"
                    aria-label="More actions"
                    @click.stop.prevent
                  />
                </UTooltip>
              </UDropdownMenu>
            </div>
          </div>
        </div>

        <div v-if="filteredEmailRows.length > EMAIL_PAGE_SIZE" class="flex justify-center pt-4">
          <UPagination
            v-model:page="emailPage"
            size="xs"
            :items-per-page="EMAIL_PAGE_SIZE"
            :total="filteredEmailRows.length"
          />
        </div>

        <div v-else-if="!filteredEmailRows.length" class="flex flex-col items-center text-center gap-2 py-16 text-muted">
          <UIcon name="i-lucide-file-x" class="size-6" />
          <div class="text-sm font-medium text-default">No templates found</div>
          <div class="text-xs">Try clearing filters or adjusting your search.</div>
        </div>
      </template>

      <!-- Forms tab -->
      <template v-else>
        <div v-if="filteredForms.length" class="flex flex-col gap-[10px]">
          <div
            v-for="form in paginatedForms"
            :key="form.id"
            class="group relative flex items-center gap-3 rounded-lg border border-default bg-white px-4 py-3 hover:bg-elevated/50 transition-colors"
          >
            <UCheckbox
              :model-value="selectedFormIds.has(form.id)"
              class="shrink-0 transition-opacity"
              :class="selectedFormIds.has(form.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
              aria-label="Select form"
              @update:model-value="(v) => toggleFormSelected(form.id, !!v)"
            />

            <NuxtLink :to="`/templates/forms/${form.id}/edit`" class="flex items-center gap-3 flex-1 min-w-0">
              <div class="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 relative">
                <UIcon name="i-lucide-form" class="size-4 text-primary" />
                <span
                  v-if="statusDotColor(form.status)"
                  class="absolute -top-0.5 -right-0.5 size-2 rounded-full ring-1 ring-white"
                  :style="{ background: statusDotColor(form.status)! }"
                />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-semibold text-highlighted">{{ form.name }}</span>
                  <SharedStatusBadge :status="form.status" />
                  <EmailModeBadge :mode="form.mode" />
                </div>
                <p class="text-sm text-muted mt-0.5 truncate">{{ form.description }}</p>
                <p class="text-xs text-dimmed mt-1">
                  {{ form.status === 'draft' ? 'Last saved' : 'Updated' }} {{ form.updatedAt }}
                </p>
              </div>
            </NuxtLink>

            <div
              class="flex items-center gap-1 shrink-0 transition-opacity"
              :class="openFormActionsId === form.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
            >
              <UTooltip text="Edit">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  square
                  icon="i-lucide-pencil"
                  class="text-muted"
                  aria-label="Edit"
                  @click.stop.prevent="navigateTo(`/templates/forms/${form.id}/edit?mode=edit`)"
                />
              </UTooltip>
              <UTooltip text="Duplicate">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  square
                  icon="i-lucide-copy"
                  class="text-muted"
                  aria-label="Duplicate"
                  @click.stop.prevent="duplicateFormRow(form)"
                />
              </UTooltip>
              <UDropdownMenu
                :items="[[
                  form.status !== 'retired'
                    ? { label: 'Retire', icon: 'i-lucide-archive', onSelect: () => retireFormRow(form) }
                    : { label: 'Reactivate', icon: 'i-lucide-rotate-ccw', onSelect: () => reactivateFormRow(form) },
                  { label: 'Delete', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => requestDeleteForm(form) }
                ]]"
                :content="{ align: 'end' }"
                @update:open="(v) => { openFormActionsId = v ? form.id : null }"
              >
                <UTooltip text="More actions">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    square
                    icon="i-lucide-ellipsis"
                    class="text-muted"
                    aria-label="More actions"
                    @click.stop.prevent
                  />
                </UTooltip>
              </UDropdownMenu>
            </div>
          </div>
        </div>

        <div v-if="filteredForms.length > FORM_PAGE_SIZE" class="flex justify-center pt-4">
          <UPagination
            v-model:page="formPage"
            size="xs"
            :items-per-page="FORM_PAGE_SIZE"
            :total="filteredForms.length"
          />
        </div>

        <div v-else-if="!filteredForms.length" class="flex flex-col items-center text-center gap-2 py-16 text-muted">
          <UIcon name="i-lucide-file-x" class="size-6" />
          <div class="text-sm font-medium text-default">No forms found</div>
          <div class="text-xs">Try clearing filters or adjusting your search.</div>
        </div>
      </template>
    </div>
    </div>

    <!-- Shared between the Email and Forms tabs - one delete confirmation
         modal, driven by `deleteTarget` rather than two near-identical
         copies, since the two rows already differ only in which delete
         function actually runs (see confirmDelete above). -->
    <UModal v-model:open="deleteModalOpen" :ui="{ content: 'max-w-sm' }">
      <template #header="{ close }">
        <h2 class="text-base font-semibold text-highlighted flex items-center gap-2 flex-1 min-w-0">
          <UIcon name="i-lucide-triangle-alert" class="text-error size-5" />
          Delete {{ deleteTarget?.type === 'form' ? 'form' : 'template' }}
        </h2>
        <UButton color="neutral" variant="ghost" size="sm" square icon="i-lucide-x" aria-label="Close" @click="close" />
      </template>
      <template #body>
        <p class="text-sm text-default">
          Delete <span class="font-semibold">"{{ deleteTarget?.name }}"</span>? This can't be undone.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="deleteTarget = null">
            Keep it
          </UButton>
          <UButton color="error" variant="solid" icon="i-lucide-trash-2" @click="confirmDelete">
            Delete {{ deleteTarget?.type === 'form' ? 'form' : 'template' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
