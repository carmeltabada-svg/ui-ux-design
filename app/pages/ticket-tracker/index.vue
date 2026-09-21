<script setup lang="ts">
// Ticket Tracker Overview - column set/badge semantics come from the real
// product screen (reference: "Ticket Tracker Overview.html", the V2 table),
// but the visual density (padding, header fill, edge-to-edge row borders,
// font sizes) follows direct feedback against that build: rows were too
// padded, the header had no fill, borders stopped short of the table edges,
// and text ran too small. Only Retrieval has real ticket data behind it (see
// ~/data/ticketTrackers).
import type { Ticket } from '~/data/ticketTrackers'
import {
  TICKETS, seedDemoTickets, ticketStatusLabel, ticketStatusTone, REASON_LABELS,
  formsColumnsFor, daysLeftLabel
} from '~/data/ticketTrackers'

useSeoMeta({
  title: 'AMS · Ticket Tracker (V2)',
  description: 'Masterlist of ticket trackers.'
})

seedDemoTickets()

const toast = useToast()

const search = ref('')
const statusFilter = ref<'all' | 'open' | 'closed'>('all')
const statusFilterItems = [
  { label: 'All Tickets', value: 'all' as const },
  { label: 'Open', value: 'open' as const },
  { label: 'Closed', value: 'closed' as const }
]

// Status dot colors, keyed the same as STATUS_TONE_CLASS below - a small
// filled dot + plain-text label (no pill background) reads calmer in a
// dense, many-column table than a solid tinted chip on every row.
const STATUS_DOT_CLASS: Record<string, string> = {
  open: 'bg-success',
  transit: 'bg-info',
  blocked: 'bg-warning',
  holdoff: 'bg-warning',
  overdue: 'bg-error',
  closed: 'bg-dimmed'
}

const rows = computed(() => Object.values(TICKETS).sort((a, b) => b.ticketNumber - a.ticketNumber))

const filteredRows = computed(() => {
  const q = search.value.toLowerCase()
  return rows.value.filter((t) => {
    if (statusFilter.value !== 'all' && t.status !== statusFilter.value) return false
    if (q && !t.employee.name.toLowerCase().includes(q) && !String(t.ticketNumber).includes(q)) return false
    return true
  })
})

// The table fills the rest of the viewport (below the fixed header/toolbar)
// instead of shrinking to fit its content, so the page count depends on how
// many rows actually fit in that space - not a fixed page size. This
// measures the real rendered header/row heights (rather than assuming a
// constant) and recomputes on any resize, same ResizeObserver-driven-layout
// idiom already used elsewhere in this app (see AlignedTabs.vue,
// RecipientsSection's useOverflowRow).
const bodyWrapRef = ref<HTMLElement>()
const theadRef = ref<HTMLElement>()
const firstRowRef = ref<HTMLElement>()
const autoPageSize = ref(8)

function recalcPageSize() {
  const wrap = bodyWrapRef.value
  if (!wrap) return
  const headH = theadRef.value?.offsetHeight ?? 0
  const rowH = firstRowRef.value?.offsetHeight ?? 48
  const available = wrap.clientHeight - headH
  autoPageSize.value = Math.max(3, Math.floor(available / rowH))
}

onMounted(() => {
  recalcPageSize()
  const ro = new ResizeObserver(() => recalcPageSize())
  if (bodyWrapRef.value) ro.observe(bodyWrapRef.value)
  onBeforeUnmount(() => ro.disconnect())
})

watch([search, statusFilter], () => { page.value = 1 })
watch(filteredRows, () => nextTick(recalcPageSize))

const page = ref(1)

// Real product's status/type pill palette: semantic color pairs (see AMS
// Design Conventions / the extracted reference).
const STATUS_TONE_CLASS: Record<string, string> = {
  open: 'bg-success/10 text-success',
  transit: 'bg-info/10 text-info',
  blocked: 'bg-warning/10 text-warning',
  holdoff: 'bg-warning/10 text-warning',
  overdue: 'bg-error/10 text-error ring ring-inset ring-error/25',
  closed: 'text-default bg-elevated'
}
const badgeBase = 'font-medium inline-flex items-center text-xs px-1.5 py-0.5 gap-1 rounded-sm'

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// A little avatar-color variety (deterministic per name, not random - the
// same person always lands on the same tint) reads less monotonous over a
// full page of rows than every avatar sharing one flat gray.
const AVATAR_TINTS = [
  'bg-blue-100 text-blue-700',
  'bg-orange-100 text-orange-700',
  'bg-purple-100 text-purple-700',
  'bg-emerald-100 text-emerald-700',
  'bg-pink-100 text-pink-700'
]
function avatarTint(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_TINTS[hash % AVATAR_TINTS.length]
}

// Forms column - a ticket further along its lifecycle can accumulate several
// form badges (ERAF, Courier Authorization, Proof-of-Receipt, Authority to
// Deduct). Showing every one inline wraps the cell across multiple lines and
// drags the whole row taller with it, so only the first 2 render inline and
// the rest sit behind a "+N" popover instead - same overflow idiom already
// used for CC/BCC recipients in RecipientsSection.vue, applied here to keep
// row height constant regardless of how many forms a ticket has touched.
const FORMS_INLINE_LIMIT = 2
function visibleForms(t: Ticket) { return formsColumnsFor(t).slice(0, FORMS_INLINE_LIMIT) }
function overflowForms(t: Ticket) { return formsColumnsFor(t).slice(FORMS_INLINE_LIMIT) }

// --- Row selection - a real utility, not decoration: lets an operator grab
// a handful of tickets and export them (e.g. for a status report) rather
// than checkboxes that do nothing once ticked. Bulk actions on the tickets
// themselves (closing, etc.) don't make sense here - closure has its own
// per-asset review flow (see [id].vue's closure modal) that a bulk button
// would just bypass.
const selectedIds = ref<Set<string>>(new Set())
const allOnPageSelected = computed(() => paginatedRows.value.length > 0 && paginatedRows.value.every(t => selectedIds.value.has(t.id)))

function toggleRow(id: string, checked: boolean) {
  const next = new Set(selectedIds.value)
  if (checked) next.add(id)
  else next.delete(id)
  selectedIds.value = next
}
function toggleAllOnPage(checked: boolean) {
  const next = new Set(selectedIds.value)
  for (const t of paginatedRows.value) {
    if (checked) next.add(t.id)
    else next.delete(t.id)
  }
  selectedIds.value = next
}
function clearSelection() { selectedIds.value = new Set() }

function csvEscape(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function exportSelected() {
  const selected = rows.value.filter(t => selectedIds.value.has(t.id))
  const header = ['Ticket #', 'Reference', 'Team Member', 'Mode', 'Reason', 'Status', 'Created At']
  const lines = selected.map(t => [
    String(t.ticketNumber), t.reference, t.employee.name, t.mode, REASON_LABELS[t.reason], ticketStatusLabel(t), t.createdAt
  ].map(csvEscape).join(','))
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ticket-trackers-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ title: `${selected.length} ticket${selected.length === 1 ? '' : 's'} exported`, icon: 'i-lucide-download', color: 'success' })
}

// --- "Show N per page" - a manual override sitting alongside the auto-fit
// sizing above; left on Auto by default (page count adapts to the available
// table height), but an operator can pin it to a fixed count instead, same
// as picking a fixed page size in any ordinary paginated table.
const pageSizeOverride = ref<number | 'auto'>('auto')
const pageSizeOptions = [
  { label: 'Auto', value: 'auto' as const },
  { label: '10', value: 10 },
  { label: '25', value: 25 },
  { label: '50', value: 50 }
]
watch(pageSizeOverride, () => { page.value = 1 })

const pageSize = computed(() => pageSizeOverride.value === 'auto' ? autoPageSize.value : pageSizeOverride.value)
watch(pageSize, (size) => {
  const maxPage = Math.max(1, Math.ceil(filteredRows.value.length / size))
  if (page.value > maxPage) page.value = maxPage
})
const paginatedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

// --- Create Ticket - type decided before landing on a page, matching the
// real product's create-type-picker pattern. Only Retrieval has a real page
// behind it so far.
function createMenuSelect(type: 'replacement' | 'onboarding' | 'retrieval') {
  if (type === 'retrieval') {
    navigateTo('/ticket-tracker/create')
    return
  }
  toast.add({
    title: `${type === 'replacement' ? 'Replacement' : 'Onboarding'} tickets aren't built yet`,
    description: 'Only Retrieval is implemented so far.',
    icon: 'i-lucide-info',
    color: 'neutral'
  })
}
const createMenuItems = computed(() => [[
  { label: 'Replacement', icon: 'i-lucide-repeat', description: 'Swap a faulty or lost device', onSelect: () => createMenuSelect('replacement') },
  { label: 'Onboarding', icon: 'i-lucide-user-plus', description: 'Issue assets to a new hire', onSelect: () => createMenuSelect('onboarding') },
  { label: 'Retrieval', icon: 'i-lucide-package-check', description: 'Recover assets from a departing or absent team member', onSelect: () => createMenuSelect('retrieval') }
]])
</script>

<template>
  <div class="bg-gray-50 h-[calc(100vh-4rem)] flex flex-col overflow-hidden px-8 py-4 dark:bg-gray-900">
    <div class="shrink-0 mb-6">
      <h1 class="text-2xl font-semibold text-highlighted">
        Ticket Tracker
        <span class="font-medium inline-flex items-center text-xs px-2 py-1 gap-1 rounded-md bg-primary text-inverted align-middle ml-2">V2</span>
      </h1>
      <p class="text-muted">Masterlist of retrieval ticket trackers.</p>
    </div>

    <div class="shrink-0 mb-4 flex items-center gap-2">
      <UInput v-model="search" icon="i-lucide-search" placeholder="Search ticket trackers..." size="sm" class="w-64" />
      <USelect v-model="statusFilter" :items="statusFilterItems" size="sm" class="w-40" />

      <template v-if="selectedIds.size">
        <span class="text-sm font-medium text-primary ml-2">{{ selectedIds.size }} selected</span>
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-download" @click="exportSelected">Export selected</UButton>
        <UButton color="neutral" variant="ghost" size="sm" class="text-muted" @click="clearSelection">Clear</UButton>
      </template>

      <UDropdownMenu :items="createMenuItems" :ui="{ content: 'w-72' }" class="ml-auto">
        <UButton color="primary" size="sm" icon="i-lucide-plus" trailing-icon="i-lucide-chevron-down">
          Create Ticket
        </UButton>
      </UDropdownMenu>
    </div>

    <div class="flex-1 min-h-0 flex flex-col rounded-lg overflow-hidden bg-default ring ring-default">
      <div ref="bodyWrapRef" class="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <table class="min-w-full overflow-clip text-sm border-separate border-spacing-0">
          <thead ref="theadRef">
            <tr class="bg-elevated">
              <th class="pl-6 pr-2 py-3 w-8 border-b border-default">
                <UCheckbox :model-value="allOnPageSelected" aria-label="Select all on page" @update:model-value="(v) => toggleAllOnPage(!!v)" />
              </th>
              <th v-for="h in ['Ticket #', 'Type', 'Deployment Type', 'Team Member', 'Client', '# To Replace', '# Replacement', 'Assignee', 'Status', 'Forms', 'Return Deadline', 'Reason', 'Created At']" :key="h" class="px-4 py-3 text-sm text-highlighted text-left font-semibold whitespace-nowrap border-b border-default last:pr-6">
                {{ h }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(t, i) in paginatedRows" :key="t.id" :ref="i === 0 ? (el) => (firstRowRef = el as HTMLElement) : undefined" class="hover:bg-elevated/50 transition-colors">
              <td class="pl-6 pr-2 py-3 border-b border-default">
                <UCheckbox :model-value="selectedIds.has(t.id)" aria-label="Select ticket" @update:model-value="(v) => toggleRow(t.id, !!v)" />
              </td>
              <td class="px-4 py-3 whitespace-nowrap border-b border-default">
                <NuxtLink :to="`/ticket-tracker/${t.id}`" class="inline-flex items-center gap-1 font-medium text-blue-500 hover:text-blue-600">
                  <UIcon name="i-lucide-clipboard-list" class="size-3.5 text-muted" />
                  <span>{{ t.ticketNumber }}</span>
                </NuxtLink>
              </td>
              <td class="px-4 py-3 whitespace-nowrap border-b border-default">
                <span :class="[badgeBase, 'bg-primary/10 text-primary']">Retrieval</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap border-b border-default">
                <span :class="[badgeBase, t.mode === 'remote' ? 'bg-info/10 text-info' : 'bg-success/10 text-success']">
                  {{ t.mode === 'remote' ? 'Remote' : 'Onsite' }}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap border-b border-default">
                <NuxtLink :to="`/ticket-tracker/${t.id}`" class="flex items-center gap-2.5 py-1 px-2 -mx-2 rounded-lg hover:bg-elevated">
                  <span class="inline-flex items-center justify-center shrink-0 rounded-full size-8 text-xs font-semibold" :class="avatarTint(t.employee.name)">{{ initials(t.employee.name) }}</span>
                  <span class="flex flex-col leading-tight">
                    <span class="font-medium text-sm text-highlighted">{{ t.employee.name }}</span>
                    <span class="text-xs text-dimmed">{{ t.employee.email }}</span>
                  </span>
                </NuxtLink>
              </td>
              <td class="px-4 py-3 whitespace-nowrap border-b border-default">
                <div class="flex items-center gap-1.5">
                  <span class="inline-flex items-center justify-center shrink-0 rounded-md bg-elevated size-6 text-xs font-medium text-muted">{{ initials(t.employee.client) }}</span>
                  <span>{{ t.employee.client }}</span>
                </div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap border-b border-default"><span class="font-medium">{{ t.assets.length }}</span></td>
              <td class="px-4 py-3 whitespace-nowrap border-b border-default"><span class="text-dimmed">Not applicable</span></td>
              <td class="px-4 py-3 whitespace-nowrap border-b border-default">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center justify-center shrink-0 rounded-full bg-elevated size-7 text-xs font-medium text-muted">DR</span>
                  <span class="font-medium">D. Reyes</span>
                </div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap border-b border-default">
                <div class="flex items-center gap-1.5">
                  <span class="size-1.5 rounded-full shrink-0" :class="STATUS_DOT_CLASS[ticketStatusTone(t)]" />
                  <span class="font-medium text-default">{{ ticketStatusLabel(t) }}</span>
                </div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap border-b border-default">
                <div v-if="formsColumnsFor(t).length" class="flex items-center gap-1">
                  <span
                    v-for="f in visibleForms(t)"
                    :key="f.label"
                    :class="[badgeBase, f.tone === 'success' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning']"
                  >{{ f.label }}</span>
                  <UPopover v-if="overflowForms(t).length">
                    <button type="button" class="text-xs font-semibold text-muted hover:text-primary px-1">+{{ overflowForms(t).length }}</button>
                    <template #content>
                      <div class="flex flex-col gap-1 p-2">
                        <span
                          v-for="f in overflowForms(t)"
                          :key="f.label"
                          :class="[badgeBase, f.tone === 'success' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning']"
                        >{{ f.label }}</span>
                      </div>
                    </template>
                  </UPopover>
                </div>
                <span v-else class="text-dimmed">No forms yet</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap border-b border-default">
                <div v-if="t.targetDateISO" class="flex flex-col">
                  <span>{{ fmtDate(t.targetDateISO) }}</span>
                  <span class="text-xs text-muted">{{ daysLeftLabel(t) }}</span>
                </div>
                <span v-else class="text-dimmed">Not set</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap border-b border-default">{{ REASON_LABELS[t.reason] }}</td>
              <td class="pl-4 pr-6 py-3 whitespace-nowrap border-b border-default">{{ fmtDate(t.createdAt) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="!filteredRows.length" class="flex flex-col items-center text-center gap-2 py-16 text-muted">
          <UIcon name="i-lucide-ticket-x" class="size-6" />
          <div class="text-sm font-medium text-default">No ticket trackers found</div>
          <div class="text-xs">Try clearing filters or adjusting your search.</div>
        </div>
      </div>

      <div class="shrink-0 border-t border-default p-4 sm:px-6">
        <div class="flex flex-col gap-3 w-full md:flex-row md:items-center md:justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted">Show</span>
            <USelect v-model="pageSizeOverride" :items="pageSizeOptions" size="xs" class="w-24" />
            <span class="text-sm text-muted">tickets per page &middot; {{ filteredRows.length ? (page - 1) * pageSize + 1 : 0 }}-{{ Math.min(page * pageSize, filteredRows.length) }} of {{ filteredRows.length }}</span>
          </div>
          <UPagination v-model:page="page" size="xs" :items-per-page="pageSize" :total="filteredRows.length" />
        </div>
      </div>
    </div>
  </div>
</template>
