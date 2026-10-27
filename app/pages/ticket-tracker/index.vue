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
  TICKETS, ticketStatusLabel, ticketStatusTone, REASON_LABELS,
  formsColumnsFor, daysLeftLabel, currentUserName, localISO
} from '~/data/ticketTrackers'
import { deepClone } from '~/utils/deepClone'

useSeoMeta({
  title: 'AMS · Ticket Tracker',
  description: 'Masterlist of ticket trackers.'
})

const toast = useToast()

const search = ref('')
const statusFilter = ref<'all' | 'open' | 'closed'>('all')
const statusFilterItems = [
  { label: 'All Tickets', value: 'all' as const },
  { label: 'Open', value: 'open' as const },
  { label: 'Closed', value: 'closed' as const }
]

// Scope - "All Tickets" vs tickets assigned to the current Asset Team operator
// (CURRENT_ASSIGNEE_NAME). Surfaced as an "Assigned to me" toggle in the filter
// toolbar (an active toggle stays visibly pressed, so it can't be silently left
// on and forgotten the way a buried dropdown filter can) rather than its own
// tabs row, which stacked another full-width strip above an already short table.
const scopeTab = ref<'all' | 'mine'>('all')

// Selected option in a filter dropdown: blue label and blue check, same as
// the Templates page's mode filter.
const selectedFilterUi = {
  item: 'group',
  itemLabel: 'group-data-[state=checked]:text-primary group-data-[state=checked]:font-medium',
  itemTrailingIcon: 'text-primary'
}
const typeFilter = ref<'all' | 'retrieval' | 'onboarding' | 'replacement'>('all')
const typeFilterItems = [
  { label: 'All Types', value: 'all' as const },
  { label: 'Retrieval', value: 'retrieval' as const },
  { label: 'Onboarding', value: 'onboarding' as const },
  { label: 'Replacement', value: 'replacement' as const }
]

// Set from the summary cards above the table: show only open tickets that are due within three days, or overdue.
const deadlineFilter = ref<'all' | 'soon' | 'overdue'>('all')

const modeFilter = ref<'all' | 'onsite' | 'remote'>('all')
const modeFilterItems = [
  { label: 'All Deployment Types', value: 'all' as const },
  { label: 'Onsite', value: 'onsite' as const },
  { label: 'Remote', value: 'remote' as const }
]

// Status dot colors, keyed by ticket status - a small
// filled dot + plain-text label (no pill background) reads calmer in a
// dense, many-column table than a solid tinted chip on every row.
const STATUS_DOT_CLASS: Record<string, string> = {
  open: 'bg-success',
  transit: 'bg-info',
  holdoff: 'bg-warning',
  overdue: 'bg-error',
  closed: 'bg-dimmed'
}

// Verification-only: the seed set is just the 5 real archetypes, so the list never fills a page
// and the pagination / "Show N" controls look inert. The High volume scenario clones those
// archetypes (every field intact, so the live-computed status, deadline and form badges still
// vary the way they do on a real ticket) into ~40 distinct rows, purely to review the list at
// scale. Nothing here persists or reaches any other screen.
const HIGH_VOLUME_NAMES = [
  'Arabella Ocampo', 'Benedict Yu', 'Carmela Sison', 'Dominic Reyes', 'Elena Padilla', 'Franco Lim',
  'Gabriela Torres', 'Hector Mendoza', 'Isabel Navarro', 'Julius Aquino', 'Katrina Bautista', 'Leon Castillo',
  'Mariel Gatchalian', 'Noel Villanueva', 'Olivia Santiago', 'Paolo Enriquez', 'Queenie Ramos', 'Rafael Dizon',
  'Sofia Mercado', 'Tomas Alcantara', 'Ursula Fajardo', 'Victor Salazar', 'Wilma Rosario', 'Xavier Panganiban',
  'Yolanda Cruz', 'Zacarias Lacson', 'Agnes Moreno', 'Bruno Tolentino', 'Celeste Ignacio', 'Darius Valdez',
  'Erika Pascual', 'Felix Montoya', 'Grace Dela Cruz', 'Hugo Rivera', 'Imelda Soriano'
]
function buildHighVolumeRows(): Ticket[] {
  const base = Object.values(TICKETS)
  if (!base.length) return []
  return HIGH_VOLUME_NAMES.map((name, i) => {
    const src = base[i % base.length]!
    const t = deepClone(src)
    const number = 900 - i
    t.id = `demo-hv-${number}`
    t.ticketNumber = number
    t.reference = `APR-26-${String(number).padStart(5, '0')}`
    const first = name.split(' ')[0]!.toLowerCase()
    const last = name.split(' ').slice(-1)[0]!.toLowerCase()
    t.employee = { ...t.employee, name, email: `${first}.${last}@goteam.io` }
    return t
  })
}

const rows = computed<Ticket[]>(() => {
  if (simScenario.value === 'first-timer') return []
  if (simScenario.value === 'high-volume') return buildHighVolumeRows()
  return Object.values(TICKETS).sort((a, b) => b.ticketNumber - a.ticketNumber)
})

const filteredRows = computed(() => {
  const q = search.value.toLowerCase()
  const me = currentUserName()
  return rows.value.filter((t) => {
    if (scopeTab.value === 'mine' && t.assignee.name !== me) return false
    // Every current record is Retrieval (see the file-level note above) - the
    // other two options are real, functioning filters, they just have no
    // matching rows yet until Onboarding/Replacement tickets exist.
    if (typeFilter.value !== 'all' && typeFilter.value !== 'retrieval') return false
    if (modeFilter.value !== 'all' && t.mode !== modeFilter.value) return false
    if (statusFilter.value !== 'all' && t.status !== statusFilter.value) return false
    if (deadlineFilter.value !== 'all' && (t.status !== 'open' || deadlineInfo(t)?.tone !== deadlineFilter.value)) return false
    if (q && !t.employee.name.toLowerCase().includes(q) && !String(t.ticketNumber).includes(q)) return false
    return true
  })
})

watch([search, statusFilter, scopeTab, typeFilter, modeFilter, deadlineFilter], () => { page.value = 1 })

const page = ref(1)

// Real product's status/type pill palette: semantic color pairs (see AMS
// Design Conventions / the extracted reference).
const badgeBase = 'font-medium inline-flex items-center text-xs px-1.5 py-0.5 gap-1 rounded-sm'

// Ticket types read apart at a glance: each has its own hue and the same icon
// the Create Ticket menu uses (never a status color pair: green/orange/red
// stay reserved for status).
type TicketType = 'retrieval' | 'onboarding' | 'replacement'
const TYPE_BADGE: Record<TicketType, { label: string, icon: string, cls: string }> = {
  retrieval: { label: 'Retrieval', icon: 'i-lucide-package-check', cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  onboarding: { label: 'Onboarding', icon: 'i-lucide-user-plus', cls: 'bg-teal-50 text-teal-700 ring-teal-600/20' },
  replacement: { label: 'Replacement', icon: 'i-lucide-repeat', cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' }
}
// Every current record is Retrieval; Onboarding and Replacement have no data yet.
function ticketTypeOf(_t: Ticket): TicketType { return 'retrieval' }

// Return Deadline urgency: overdue is red with an icon, due within 3 days is
// orange, anything later stays quiet.
function deadlineInfo(t: Ticket): { tone: 'overdue' | 'soon' | 'ok', label: string } | null {
  const label = daysLeftLabel(t)
  if (!label) return null
  if (label.startsWith('Overdue')) return { tone: 'overdue', label }
  return { tone: Number.parseInt(label) <= 3 ? 'soon' : 'ok', label }
}

// Header summary - "Ticket Tracker" already names the page in the sidebar and the breadcrumb, so
// the heading itself carries value instead: a live headline of what the operator has to act on,
// with the at-a-glance tiles centered below it. Counts are over the whole (unfiltered) list so they
// stay a true total while the table is filtered. Overdue and Due soon only count open tickets - a
// closed ticket is never chased.
const summary = computed(() => {
  const all = rows.value
  const open = all.filter(t => t.status === 'open')
  return {
    total: all.length,
    open: open.length,
    overdue: open.filter(t => deadlineInfo(t)?.tone === 'overdue').length,
    dueSoon: open.filter(t => deadlineInfo(t)?.tone === 'soon').length
  }
})
// Three metric cards in the same visual family as the dashboard's (rounded card, colored count, faint
// watermark icon, slate stats strip with an arrow) but with ticket-specific content. Open is the
// headcount; Due soon and Overdue are the urgency of those open tickets. Each card's arrow filters the
// table below to that group (press again to clear). Counts and details are true totals over the whole
// list, independent of the table's own filters.
type SummaryTone = 'blue' | 'orange' | 'red'
const TILE_COUNT: Record<SummaryTone, string> = {
  blue: 'text-blue-600 dark:text-blue-400',
  orange: 'text-orange-600 dark:text-orange-400',
  red: 'text-red-600 dark:text-red-400'
}
const TILE_WASH: Record<SummaryTone, string> = { blue: '#155DFC', orange: '#F54900', red: '#E7000B' }
const daysIn = (t: Ticket) => Number.parseInt(/(\d+)d/.exec(deadlineInfo(t)?.label ?? '')?.[1] ?? '0')
const byEarliestDeadline = (list: Ticket[]) => [...list].sort((a, b) => (a.targetDateISO ?? '').localeCompare(b.targetDateISO ?? ''))
function groupStats(list: Ticket[]) {
  const me = currentUserName()
  return {
    mine: list.filter(t => t.assignee.name === me).length,
    remote: list.filter(t => t.mode === 'remote').length,
    onsite: list.filter(t => t.mode === 'onsite').length
  }
}
const summaryTiles = computed(() => {
  const all = rows.value
  const open = all.filter(t => t.status === 'open')
  const soon = byEarliestDeadline(open.filter(t => deadlineInfo(t)?.tone === 'soon'))
  const late = byEarliestDeadline(open.filter(t => deadlineInfo(t)?.tone === 'overdue'))
  const avgLate = late.length ? Math.round(late.reduce((s, t) => s + daysIn(t), 0) / late.length) : 0
  const so = groupStats(soon); const la = groupStats(late); const op = groupStats(open)
  // Counts only, never a named ticket: with many tickets in a group a single example would mislead.
  const dueWithinDay = soon.filter(t => daysIn(t) <= 1).length
  const lateOverWeek = late.filter(t => daysIn(t) > 7).length
  return [
    {
      key: 'open', label: 'Open', icon: 'i-lucide-folder-open', tone: 'blue' as SummaryTone, count: open.length,
      detailValue: String(all.length), detailText: `in total, ${all.length - open.length} closed`,
      footer: [{ label: 'Onsite', value: op.onsite }, { label: 'Remote', value: op.remote }, { label: 'Mine', value: op.mine }],
      action: 'Show open tickets', active: statusFilter.value === 'open' && deadlineFilter.value === 'all',
      select: () => { deadlineFilter.value = 'all'; statusFilter.value = statusFilter.value === 'open' ? 'all' : 'open' }
    },
    {
      key: 'dueSoon', label: 'Due soon', icon: 'i-lucide-clock-alert', tone: 'orange' as SummaryTone, count: soon.length,
      detailValue: String(dueWithinDay), detailText: 'due within a day',
      footer: [{ label: 'Remote', value: so.remote }, { label: 'Onsite', value: so.onsite }, { label: 'Mine', value: so.mine }],
      action: 'Show tickets due soon', active: deadlineFilter.value === 'soon',
      select: () => { statusFilter.value = 'all'; deadlineFilter.value = deadlineFilter.value === 'soon' ? 'all' : 'soon' }
    },
    {
      key: 'overdue', label: 'Overdue', icon: 'i-lucide-alarm-clock', tone: 'red' as SummaryTone, count: late.length,
      detailValue: String(lateOverWeek), detailText: 'more than a week late',
      footer: [{ label: 'Avg late', value: `${avgLate}d` }, { label: 'Remote', value: la.remote }, { label: 'Mine', value: la.mine }],
      action: 'Show overdue tickets', active: deadlineFilter.value === 'overdue',
      select: () => { statusFilter.value = 'all'; deadlineFilter.value = deadlineFilter.value === 'overdue' ? 'all' : 'overdue' }
    }
  ]
})
const attentionCount = computed(() => summary.value.overdue + summary.value.dueSoon)
// The page is already named in the sidebar and breadcrumb, so the heading is a real status line and
// the line under it points at the single most urgent ticket (earliest Return Deadline among open ones).
const headline = computed(() => {
  if (!rows.value.length) return 'No tickets yet'
  if (attentionCount.value === 0) return 'You are all caught up'
  return attentionCount.value === 1 ? '1 ticket needs your attention' : `${attentionCount.value} tickets need your attention`
})
// The line under the heading is about ownership, which the cards below do not say: how much of the open
// work is yours, and how much sits with the rest of the team.
const subline = computed(() => {
  if (!rows.value.length) return 'Create the first ticket to start tracking returns.'
  const open = rows.value.filter(t => t.status === 'open')
  const mine = open.filter(t => t.assignee.name === currentUserName()).length
  if (!open.length) return 'Every ticket is closed.'
  return `${mine} of ${open.length} open ${open.length === 1 ? 'ticket is' : 'tickets are'} assigned to you.`
})

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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
  const header = ['Ticket #', 'Reference', 'Team Member', 'Mode', 'Assignee', 'Reason', 'Status', 'Created At']
  const lines = selected.map(t => [
    String(t.ticketNumber), t.reference, t.employee.name, t.mode, t.assignee.name, REASON_LABELS[t.reason], ticketStatusLabel(t), t.createdAt
  ].map(csvEscape).join(','))
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tickets-${localISO(new Date())}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.add({ title: `${selected.length} ticket${selected.length === 1 ? '' : 's'} exported`, icon: 'i-lucide-download', color: 'success' })
}

// --- "Show N per page". The table grows to its content height and the page
// scrolls, so the page size just controls how many rows are listed.
const pageSize = ref<number>(10)
const pageSizeOptions = [
  { label: '10', value: 10 },
  { label: '15', value: 15 },
  { label: '25', value: 25 }
]
watch(pageSize, () => { page.value = 1 })
// Rows can shrink without a filter change (scenario switch, a ticket changing elsewhere): stay on a real page.
watch(() => filteredRows.value.length, (n) => {
  const last = Math.max(1, Math.ceil(n / pageSize.value))
  if (page.value > last) page.value = last
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
  { label: 'Onboarding', icon: 'i-lucide-user-plus', description: 'Issue assets to a new hire', onSelect: () => createMenuSelect('onboarding') },
  { label: 'Replacement', icon: 'i-lucide-repeat', description: 'Swap a faulty or lost device', onSelect: () => createMenuSelect('replacement') },
  { label: 'Retrieval', icon: 'i-lucide-package-check', description: 'Recover assets from a departing or absent team member', onSelect: () => createMenuSelect('retrieval') }
]])
</script>

<template>
  <div class="bg-gray-50 h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
    <!-- The page header (title, status line, Create button, Open / Due soon / Overdue chips)
         is fixed and never scrolls. Everything under it (the search and filters, the table,
         the paging footer) is one scroll area, and the table card inside it is exactly as
         tall as its rows, so 10, 15 or 25 rows each show in full. -->
    <div class="shrink-0 bg-gray-50">
      <div data-tabs-header class="bg-card px-8 pt-5 pb-3 border-b border-default">
        <div class="flex items-start justify-between gap-6 mb-4">
          <div class="min-w-0">
            <!-- The page is already named in the sidebar and the breadcrumb, so nothing here repeats
                 it: a live status headline, and the one ticket to look at first. -->
            <h1 class="text-2xl font-semibold text-highlighted">{{ headline }}</h1>
            <p class="text-sm text-muted pt-1">{{ subline }}</p>
          </div>

          <UDropdownMenu :items="createMenuItems" :ui="{ content: 'w-80', itemLabel: 'whitespace-normal', itemDescription: 'whitespace-normal' }">
            <UButton color="primary" variant="solid" size="md" icon="i-lucide-plus" trailing-icon="i-lucide-chevron-down" class="shrink-0">
              Create Ticket
            </UButton>
          </UDropdownMenu>
        </div>

        <!-- At-a-glance stat chips, one compact row. The headline count on each
             chip is the primary number; the Onsite/Remote/Mine breakdown lives
             in the tooltip so the default view isn't a wall of numbers (the
             data-table guidance: cap the visible metrics, breakdown on hover).
             Each chip is also the filter it names - clicking it filters the
             table, clicking again clears. -->
        <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Ticket summary">
          <UTooltip
            v-for="tile in summaryTiles"
            :key="tile.key"
            :text="`${tile.detailValue} ${tile.detailText} · ${tile.footer.map(f => `${f.label} ${f.value}`).join(', ')}`"
            :delay-duration="200"
          >
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 transition-colors"
              :class="tile.active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-default bg-card hover:bg-elevated'"
              :aria-pressed="tile.active"
              :aria-label="`${tile.label}: ${tile.count}. ${tile.active ? 'Active filter, press to clear' : tile.action}`"
              @click="tile.select"
            >
              <span class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: TILE_WASH[tile.tone] }" aria-hidden="true" />
              <span class="text-sm font-medium text-default">{{ tile.label }}</span>
              <span class="text-sm font-bold tabular-nums" :class="TILE_COUNT[tile.tone]">{{ tile.count }}</span>
              <UIcon v-if="tile.active" name="i-lucide-x" class="size-3.5 text-muted" aria-hidden="true" />
            </button>
          </UTooltip>
        </div>
      </div>

    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
    <!-- Unified container: the search + filters row and the table live in ONE
         bordered white panel (open item #10, per the Workflow Library reference
         image). The header row keeps its own tint; its top-left and top-right
         cells carry a small radius so the header reads as its own distinct
         strip inside the container. Overflow-hidden on the outer container
         keeps the panel's bottom corners square against the table body. -->
    <div class="flex flex-col px-6 pt-3 pb-4 stage-enter">
      <div class="flex flex-col rounded-xl overflow-hidden bg-card border border-default shadow-sm">
      <div class="px-6 py-4">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <UInput v-model="search" icon="i-lucide-search" aria-label="Search tickets" placeholder="Search ticket trackers..." size="md" class="w-full sm:max-w-[15rem]" />

          <div class="flex flex-wrap items-center gap-2">
            <UButton
              v-for="chip in statusFilterItems"
              :key="chip.value"
              :color="statusFilter === chip.value ? 'primary' : 'neutral'"
              :variant="statusFilter === chip.value ? 'solid' : 'outline'"
              size="sm"
              class="rounded-full"
              @click="statusFilter = chip.value"
            >
              {{ chip.label }}
            </UButton>
            <span class="w-px h-5 bg-accented mx-1" />
            <!-- "My Tickets" is a toggle here, not a separate tabs row: it filters
                 the list to tickets assigned to the current user. -->
            <UButton
              :color="scopeTab === 'mine' ? 'primary' : 'neutral'"
              :variant="scopeTab === 'mine' ? 'solid' : 'outline'"
              size="sm"
              icon="i-lucide-user-round"
              class="rounded-full"
              :aria-pressed="scopeTab === 'mine'"
              @click="scopeTab = scopeTab === 'mine' ? 'all' : 'mine'"
            >
              Assigned to me
            </UButton>
            <span class="w-px h-5 bg-accented mx-1" />
            <USelect v-model="typeFilter" :items="typeFilterItems" aria-label="Filter by type" size="sm" class="w-32" :ui="selectedFilterUi" />
            <USelect v-model="modeFilter" :items="modeFilterItems" aria-label="Filter by deployment type" size="sm" class="w-44" :ui="selectedFilterUi" />
          </div>

          <template v-if="selectedIds.size">
            <span class="text-sm font-medium text-primary sm:ml-auto">{{ selectedIds.size }} selected</span>
            <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-download" @click="exportSelected">Export selected</UButton>
            <UButton color="neutral" variant="ghost" size="sm" class="text-muted" @click="clearSelection">Clear</UButton>
          </template>
        </div>
      </div>
      <!-- Unified padding (5 Oct 2026 feedback): the scroll container is
           inset by 24px on both sides so the search strip, the slate header
           strip and the body rows all share the same horizontal boundary.
           The sticky first-column anchors read `left-0` as "the padded
           content edge", so they stay in alignment while scrolling. Removed
           `pl-6` from the first sticky th/td and the `last:pr-6` on the
           tail column since the container now owns that spacing. -->
      <!-- The 24px inset lives on this wrapper, NOT on the scroller: padding
           inside an overflow scroller scrolls with the content, so scrolled
           columns slid through the left gutter and the right gutter only
           appeared at the far end. Outside the scroller, both gutters stay
           clean and the table is clipped at the same edge as the strips above. -->
      <div class="px-6">
      <!-- Sideways overflow only, for the wide table: the five left columns stay put
           while the rest scrolls. Up and down scrolling belongs to the card. -->
      <div class="overflow-x-auto">
        <!-- Loading: row-shaped placeholders in place of the table. -->
        <div v-if="simState === 'loading'" class="flex flex-col gap-3 py-4" role="status" aria-live="polite" aria-label="Loading tickets">
          <div v-for="n in 6" :key="n" class="flex items-center gap-4">
            <SharedSkeleton width="w-16" height="h-4" />
            <SharedSkeleton width="w-20" height="h-5" />
            <SharedSkeleton circle width="w-8" height="h-8" />
            <SharedSkeleton width="w-40" height="h-4" />
            <SharedSkeleton width="w-24" height="h-4" class="hidden md:block" />
            <SharedSkeleton width="w-32" height="h-4" class="hidden lg:block" />
          </div>
        </div>
        <table v-else class="min-w-full overflow-clip text-sm border-separate border-spacing-0">
          <thead>
            <!-- No tr-level `bg-slate-50`: each cell carries its own opaque
                 bg. A tr-level bg was scrolling WITH the horizontal content
                 (the tr itself isn't sticky), which read as the header fill
                 "moving together" with the row (user feedback 5 Oct 2026,
                 7th pass). Each cell owns its own bg, so sticky cells stay
                 opaque at their fixed left offset and scrollable cells carry
                 the identical slate strip under them. -->
            <!-- The column header scrolls away with the rows (it is not pinned to the top). The five left
                 cells stay sticky to the left only, so they hold their place when the table scrolls sideways;
                 they keep z-[20] over the scrollable header cells. -->
            <tr class="relative">
              <th class="sticky left-0 z-[20] w-12 min-w-12 bg-slate-50 pl-4 pr-2 py-3.5 border-b border-t border-l border-default rounded-tl-lg">
                <UCheckbox :model-value="allOnPageSelected" aria-label="Select all on page" @update:model-value="(v) => toggleAllOnPage(!!v)" />
              </th>
              <th class="sticky left-12 z-[20] w-[110px] min-w-[110px] bg-slate-50 px-4 py-3.5 text-xs text-muted text-left font-medium whitespace-nowrap border-b border-t border-default">Ticket #</th>
              <th class="sticky left-[158px] z-[20] w-[140px] min-w-[140px] bg-slate-50 px-4 py-3.5 text-xs text-muted text-left font-medium whitespace-nowrap border-b border-t border-default">Type</th>
              <th class="sticky left-[298px] z-[20] w-[140px] min-w-[140px] bg-slate-50 px-4 py-3.5 text-xs text-muted text-left font-medium whitespace-nowrap border-b border-t border-default">Deployment Type</th>
              <th class="sticky left-[438px] z-[20] w-[220px] min-w-[220px] bg-slate-50 px-4 py-3.5 text-xs text-muted text-left font-medium whitespace-nowrap border-b border-t border-r border-default">Team Member</th>
              <!-- Scrollable columns, reordered 5 Oct 2026 by importance: what
                   is happening now (Status), when it must happen by (Return
                   Deadline), who owns it (Assignee), why it exists (Reason),
                   then the context columns, with Created At last since it is
                   the least action-relevant.
                   The last cell carries `border-r` so the thead strip closes
                   cleanly on both sides (user feedback 6th pass). -->
              <th
                v-for="h in ['Status', 'Return Deadline', 'Assignee', 'Reason', 'Client', 'Assets Affected', 'Replacement Assets', 'Forms', 'Created At']"
                :key="h"
                class="bg-slate-50 px-4 py-3.5 text-xs text-muted text-left font-medium whitespace-nowrap border-b border-t border-default last:border-r last:rounded-tr-lg"
              >
                {{ h }}
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Hover state is applied PER-CELL (via group-hover) rather than
                 on the tr, so the sticky-column opaque bg and the scrollable
                 cells line up pixel-identical with no bleed past the sticky
                 edge when scrolling horizontally (user feedback 5 Oct 2026,
                 6th pass: fill still "overflowed" past the sticky edge). -->
            <tr v-for="t in paginatedRows" :key="t.id" class="group relative transition-colors">
              <td class="sticky left-0 z-[10] w-12 min-w-12 bg-card group-hover:bg-gray-50 pl-4 pr-2 py-3.5 border-b border-default">
                <UCheckbox :model-value="selectedIds.has(t.id)" aria-label="Select ticket" @update:model-value="(v) => toggleRow(t.id, !!v)" />
              </td>
              <td class="sticky left-12 z-[10] w-[110px] min-w-[110px] bg-card group-hover:bg-gray-50 px-4 py-3.5 whitespace-nowrap border-b border-default">
                <NuxtLink :to="`/ticket-tracker/${t.ticketNumber}`" class="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-800">
                  <UIcon name="i-lucide-clipboard-list" class="size-3.5 text-muted" />
                  <span>{{ t.ticketNumber }}</span>
                  <UTooltip v-if="t.hrisUpdatePending" text="An employee record update needs your review">
                    <span class="size-1.5 rounded-full bg-error shrink-0" />
                  </UTooltip>
                </NuxtLink>
              </td>
              <td class="sticky left-[158px] z-[10] w-[140px] min-w-[140px] bg-card group-hover:bg-gray-50 px-4 py-3.5 whitespace-nowrap border-b border-default">
                <span :class="[badgeBase, 'ring-1 ring-inset', TYPE_BADGE[ticketTypeOf(t)].cls]">
                  <UIcon :name="TYPE_BADGE[ticketTypeOf(t)].icon" class="size-3" />
                  {{ TYPE_BADGE[ticketTypeOf(t)].label }}
                </span>
              </td>
              <td class="sticky left-[298px] z-[10] w-[140px] min-w-[140px] bg-card group-hover:bg-gray-50 px-4 py-3.5 whitespace-nowrap border-b border-default">
                <EmailModeBadge :mode="t.mode" />
              </td>
              <td class="sticky left-[438px] z-[10] w-[220px] min-w-[220px] bg-card group-hover:bg-gray-50 px-4 py-3.5 whitespace-nowrap border-b border-r border-default">
                <NuxtLink :to="`/ticket-tracker/${t.ticketNumber}`" class="flex items-center gap-2.5 py-1 px-2 -mx-2 rounded-lg hover:bg-elevated">
                  <span class="inline-flex items-center justify-center shrink-0 rounded-full size-8 text-xs font-semibold" :class="avatarTint(t.employee.name)">{{ initials(t.employee.name) }}</span>
                  <span class="flex flex-col leading-tight">
                    <span class="font-medium text-sm text-highlighted">{{ t.employee.name }}</span>
                    <span class="text-xs text-toned">{{ t.employee.email }}</span>
                  </span>
                </NuxtLink>
              </td>
              <!-- Status -->
              <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50">
                <div class="flex items-center gap-1.5">
                  <span class="size-1.5 rounded-full shrink-0" :class="STATUS_DOT_CLASS[ticketStatusTone(t)]" />
                  <span class="text-default">{{ ticketStatusLabel(t) }}</span>
                </div>
              </td>
              <!-- Return Deadline -->
              <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50">
                <div v-if="t.targetDateISO" class="flex flex-col items-start gap-1">
                  <span :class="deadlineInfo(t)?.tone === 'overdue' ? 'font-semibold text-highlighted' : ''">{{ fmtDate(t.targetDateISO) }}</span>
                  <span v-if="deadlineInfo(t)?.tone === 'overdue'" :class="[badgeBase, 'font-semibold ring-1 ring-inset bg-red-50 text-red-700 ring-red-600/20']">
                    <UIcon name="i-lucide-alarm-clock" class="size-3" />
                    {{ deadlineInfo(t)!.label }}
                  </span>
                  <span v-else-if="deadlineInfo(t)?.tone === 'soon'" :class="[badgeBase, 'font-semibold ring-1 ring-inset bg-orange-50 text-orange-700 ring-orange-600/20']">
                    <UIcon name="i-lucide-clock-alert" class="size-3" />
                    {{ deadlineInfo(t)!.label }}
                  </span>
                  <span v-else-if="deadlineInfo(t)" class="text-xs text-muted">{{ deadlineInfo(t)!.label }}</span>
                </div>
                <span v-else class="text-dimmed">Not set</span>
              </td>
              <!-- Assignee -->
              <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center justify-center shrink-0 rounded-full bg-elevated size-7 text-xs font-medium text-slate-600">{{ initials(t.assignee.name) }}</span>
                  <span class="font-medium">{{ t.assignee.name }}</span>
                </div>
              </td>
              <!-- Reason -->
              <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50">{{ REASON_LABELS[t.reason] }}</td>
              <!-- Client -->
              <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50">
                <div class="flex items-center gap-1.5">
                  <span class="inline-flex items-center justify-center shrink-0 rounded-md bg-elevated size-6 text-xs font-medium text-slate-600">{{ initials(t.employee.client) }}</span>
                  <span>{{ t.employee.client }}</span>
                </div>
              </td>
              <!-- Assets Affected -->
              <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50"><span class="font-medium">{{ t.assets.length }}</span></td>
              <!-- Replacement Assets -->
              <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50"><span class="text-dimmed">N/A</span></td>
              <!-- Forms -->
              <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50">
                <div v-if="formsColumnsFor(t).length" class="flex items-center gap-1">
                  <span
                    v-for="f in visibleForms(t)"
                    :key="f.label"
                    :class="[badgeBase, f.tone === 'success' ? 'bg-success/10 text-ams-success' : 'bg-warning/10 text-ams-warning']"
                  >{{ f.label }}</span>
                  <UPopover v-if="overflowForms(t).length">
                    <!-- Styled as a real chip so it reads as clickable (5 Oct 2026 feedback). -->
                    <button type="button" class="text-xs font-semibold text-slate-600 bg-gray-100 border border-default rounded-sm px-1.5 py-0.5 hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors cursor-pointer">+{{ overflowForms(t).length }}</button>
                    <template #content>
                      <div class="flex flex-col gap-1 p-2">
                        <span
                          v-for="f in overflowForms(t)"
                          :key="f.label"
                          :class="[badgeBase, f.tone === 'success' ? 'bg-success/10 text-ams-success' : 'bg-warning/10 text-ams-warning']"
                        >{{ f.label }}</span>
                      </div>
                    </template>
                  </UPopover>
                </div>
                <span v-else class="text-dimmed">No forms yet</span>
              </td>
              <!-- Created At -->
              <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50">{{ fmtDate(t.createdAt) }}</td>
            </tr>
          </tbody>
        </table>

        <div v-if="simState !== 'loading' && !filteredRows.length" class="flex flex-col items-center text-center gap-2 py-16 text-muted">
          <UIcon name="i-lucide-ticket-x" class="size-6" />
          <template v-if="!rows.length">
            <div class="text-sm font-medium text-default">No tickets yet</div>
            <div class="text-xs">Tickets appear here once they are created.</div>
          </template>
          <template v-else>
            <div class="text-sm font-medium text-default">No tickets match</div>
            <div class="text-xs">Try adjusting your search or filters.</div>
            <UButton color="neutral" variant="outline" size="sm" class="mt-2" @click="search = ''; statusFilter = 'all'; scopeTab = 'all'; typeFilter = 'all'; modeFilter = 'all'; deadlineFilter = 'all'">Clear search and filters</UButton>
          </template>
        </div>
      </div>
      </div>

      <div class="border-t border-default p-4 sm:px-6">
        <div class="flex flex-col gap-3 w-full md:flex-row md:items-center md:justify-between">
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted">Show</span>
            <USelect v-model="pageSize" :items="pageSizeOptions" aria-label="Rows per page" size="xs" class="w-24" />
            <span class="text-sm text-muted">tickets per page &middot; {{ filteredRows.length ? (page - 1) * pageSize + 1 : 0 }}-{{ Math.min(page * pageSize, filteredRows.length) }} of {{ filteredRows.length }}</span>
          </div>
          <UPagination v-model:page="page" size="xs" :items-per-page="pageSize" :total="filteredRows.length" />
        </div>
      </div>
      </div>
    </div>
    </div>
  </div>
</template>
