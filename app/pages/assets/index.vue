<script setup lang="ts">
// Assets list, built to match the ticket tracker exactly: a fixed page header (status headline +
// filterable summary chips) over one scroll area holding the search/filter strip and a table card.
// The table's own column header scrolls with the rows; Tag and Serial stay frozen on the left and
// Actions on the right. The two new Terminal-lane exit statuses appear in the status filter and the
// summary. Clicking a tag opens the asset detail page, where the Activity Feed and Movements tabs show every move.
import { initialsOf as initials, avatarTint } from '~/data/assetsDetail'
import {
  allAssets, isExited, STATUSES, ASSET_TYPES, ASSET_NAMES, memberCompany, LANE_ORDER, LANE_LABELS, TYPE_ICON, locationView, warrantyDaysLeft, localToday,
  assetsSimState, assetsSimScenario, assetsSimRole, type Asset
} from '~/data/assets'

definePageMeta({ layout: 'assets' })
useSeoMeta({ title: 'Assets - GoTeam Assets', description: 'Track every unit\'s status, custody and location.' })

const toast = useToast()
const search = ref('')
// The placeholder is cut with an ellipsis when the box is narrow, and the tooltip then shows all of it.
const searchPlaceholder = 'Search tag, serial or custodian'
const searchBox = ref<HTMLElement>()
const placeholderClipped = ref(false)
function measurePlaceholder() {
  const input = searchBox.value?.querySelector('input')
  const ctx = document.createElement('canvas').getContext('2d')
  if (!input || !ctx) return
  const cs = getComputedStyle(input)
  ctx.font = cs.font
  placeholderClipped.value = ctx.measureText(searchPlaceholder).width > input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
}
onMounted(measurePlaceholder)
let searchObserver: ResizeObserver | undefined
onMounted(() => { if (searchBox.value && typeof ResizeObserver !== 'undefined') { searchObserver = new ResizeObserver(measurePlaceholder); searchObserver.observe(searchBox.value) } })
onBeforeUnmount(() => searchObserver?.disconnect())
// The live page's filters, and only those (Tech Pack Currency is switched off there, so it is not here). Status, Asset Type,
// Asset Name, Ownership and Warranty Status are the promoted ones and sit in the toolbar; Brand (Hardware), Tech Pack Type
// and Owner (Commercial), Movement Type, Location Type and Checked Out To (Lifecycle) are in the panel. Option lists
// follow the live page: Status grouped by lane with every status listed, Asset Type as "CE - Computer Equipment",
// Asset Name only once a type is picked, the fixed Ownership, Warranty, Movement and Location type lists.
// Each count respects the other filters.
type FilterKey = 'status' | 'type' | 'name' | 'ownership' | 'warranty' | 'brand' | 'techPack' | 'owner' | 'movement' | 'locationType' | 'checkedOutTo'
interface FilterOption { label: string, value?: string, count?: number, type?: 'label' }
interface FilterDef {
  key: FilterKey, label: string, noun: string, group: 'Promoted' | 'Hardware' | 'Commercial' | 'Lifecycle'
  quick?: boolean, searchable?: boolean
  read: (a: Asset) => string
  /** Every value the filter can take, when that is a fixed list rather than whatever the data holds */
  all?: () => string[]
  /** The label for a value, when it differs from the value itself */
  text?: (v: string) => string
  /** Keep `all` in the order given instead of sorting by label */
  keepOrder?: boolean
}
const typeCodeOf = (a: Asset) => a.tag.split('-')[1] ?? ''
const WARRANTY_TEXT: Record<string, string> = { expired: 'Already Expired', '30_days': 'Expiring in 30 Days', '60_days': 'Expiring in 60 Days', '90_days': 'Expiring in 90 Days' }
function warrantyBucket(a: Asset) {
  const d = warrantyDaysLeft(a, localToday())
  return d === null ? '' : d < 0 ? 'expired' : d <= 30 ? '30_days' : d <= 60 ? '60_days' : d <= 90 ? '90_days' : ''
}
// The live page knows three location types. A unit at a client has none of them, so it is not listed under any.
function locationTypeOf(a: Asset) {
  if (a.status === 'Supplier Return') return 'Supplier'
  if (a.status === 'Client Pull-Out') return ''
  return a.custodian ? 'User Address' : 'Office Location'
}
const FILTERS: FilterDef[] = [
  { key: 'status', noun: 'statuses', label: 'Status', group: 'Promoted', quick: true, searchable: true, read: a => a.status, all: () => STATUSES.map(x => x.name) },
  { key: 'type', noun: 'types', label: 'Asset Type', group: 'Promoted', quick: true, read: typeCodeOf, all: () => ASSET_TYPES.map(t => t.code), text: v => `${v} - ${ASSET_TYPES.find(t => t.code === v)?.label ?? v}` },
  { key: 'name', noun: 'names', label: 'Asset Name', group: 'Promoted', quick: true, read: a => a.name, all: () => filters.type.flatMap(c => ASSET_NAMES[c] ?? []) },
  { key: 'ownership', noun: 'ownerships', label: 'Ownership', group: 'Promoted', quick: true, read: a => ownershipLabel(a), all: () => ['GoTeam-Owned', 'Client-Owned'], keepOrder: true },
  { key: 'warranty', noun: 'warranty statuses', label: 'Warranty Status', group: 'Promoted', quick: true, read: warrantyBucket, all: () => Object.keys(WARRANTY_TEXT), text: v => WARRANTY_TEXT[v] ?? v, keepOrder: true },
  { key: 'brand', noun: 'brands', label: 'Brand', group: 'Hardware', searchable: true, read: a => a.model.split(' ')[0] ?? '' },
  { key: 'techPack', noun: 'tech pack types', label: 'Tech Pack Type', group: 'Commercial', read: a => a.techPack, all: () => ['Monthly Rental', 'Outright Purchase', 'BYOD'] },
  { key: 'owner', noun: 'owners', label: 'Owner', group: 'Commercial', read: a => a.owner },
  { key: 'movement', noun: 'movement types', label: 'Movement Type', group: 'Lifecycle', read: a => a.movementStatus, all: () => ['Checked In', 'Checked Out'] },
  { key: 'locationType', noun: 'location types', label: 'Location Type', group: 'Lifecycle', read: locationTypeOf, all: () => ['User Address', 'Office Location', 'Supplier'] },
  { key: 'checkedOutTo', noun: 'people', label: 'Checked Out To', group: 'Lifecycle', searchable: true, read: a => a.custodian, text: v => memberCompany(v) ? `${v} — ${memberCompany(v)}` : v }
]
const FILTER_GROUPS = ['Promoted', 'Hardware', 'Commercial', 'Lifecycle'] as const
const filters = reactive<Record<FilterKey, string[]>>(Object.fromEntries(FILTERS.map(d => [d.key, [] as string[]])) as Record<FilterKey, string[]>)

const rows = computed<Asset[]>(() => assetsSimScenario.value === 'empty' ? [] : allAssets())
const textOf = (d: FilterDef, v: string) => d.text ? d.text(v) : v
// Asset Name stays off until a type is picked, as on the live page, and then lists only the names of those types.
const nameDisabled = computed(() => !filters.type.length)
watch(() => filters.type.slice(), () => { filters.name = filters.name.filter(n => filters.type.some(c => ASSET_NAMES[c]?.includes(n))) })
const isDisabled = (d: FilterDef) => d.key === 'name' && nameDisabled.value

/** Whether a unit passes the search and every filter, except the one named in `skip`. */
function matches(a: Asset, skip?: FilterKey) {
  const q = search.value.trim().toLowerCase()
  if (q && ![a.tag, a.serial, a.custodian].some(v => v.toLowerCase().includes(q))) return false
  return FILTERS.every(d => d.key === skip || !filters[d.key].length || filters[d.key].includes(d.read(a)))
}
const filtered = computed(() => rows.value.filter(a => matches(a)))

const facets = computed(() => {
  const out = {} as Record<FilterKey, FilterOption[]>
  for (const d of FILTERS) {
    const counts = new Map<string, number>()
    for (const a of rows.value) {
      const v = d.read(a)
      if (v && matches(a, d.key)) counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    const values = d.all ? d.all() : [...new Set(rows.value.map(a => d.read(a)).filter(Boolean))]
    // A picked value stays listed even when no unit has it, so it can always be unpicked.
    for (const v of filters[d.key]) if (!values.includes(v)) values.push(v)
    if (!d.keepOrder && d.key !== 'status') values.sort((x, y) => textOf(d, x).localeCompare(textOf(d, y)))
    const opt = (v: string): FilterOption => ({ label: textOf(d, v), value: v, count: counts.get(v) ?? 0 })
    if (d.key === 'status') {
      // Grouped by lifecycle lane, each lane headed, statuses A to Z inside it, every status listed.
      const list: FilterOption[] = []
      for (const lane of LANE_ORDER) {
        const names = values.filter(v => STATUSES.find(x => x.name === v)?.lane === lane).sort((x, y) => x.localeCompare(y))
        if (names.length) list.push({ type: 'label', label: LANE_LABELS[lane] }, ...names.map(opt))
      }
      out[d.key] = list
    } else {
      out[d.key] = values.map(opt)
    }
  }
  return out
})

const activeChips = computed(() => FILTERS.filter(d => filters[d.key].length).map(d => ({
  key: d.key, label: d.label, summary: filters[d.key].map(v => textOf(d, v)).join(', '), remove: () => { filters[d.key] = [] }
})))
const anyFilter = computed(() => activeChips.value.length > 0 || !!search.value.trim())
function clearFilters() { for (const d of FILTERS) filters[d.key] = []; search.value = '' }
const panelOpen = ref(false)

// Compact metric cards: one line each, a label and a value across all assets. They answer questions the status
// filter can not (how many need attention, how many warranties are about to end), and a card that maps to a filter
// applies it with one click.
const METRIC_DOT = { gray: '#4A5565', blue: '#155DFC', green: '#008236', red: '#E7000B', orange: '#F54900' }
const sameSet = (a: string[], b: string[]) => a.length === b.length && b.every(v => a.includes(v))
const WARRANTY_SOON = ['30_days', '60_days', '90_days']
const metrics = computed(() => {
  const all = rows.value
  const count = (fn: (a: Asset) => boolean) => all.filter(fn).length
  return [
    { key: 'total', label: 'Total assets', value: all.length, hint: 'Every unit in the system, whatever its status.', dot: METRIC_DOT.gray, active: false, apply: null as null | (() => void) },
    { key: 'in-use', label: 'In use', value: count(a => a.status === 'In Use'), hint: 'Units in the active custody of a team member (status In Use). Click to filter.', dot: METRIC_DOT.blue, active: sameSet(filters.status, ['In Use']), apply: () => { filters.status = ['In Use'] } },
    { key: 'ready', label: 'Ready to deploy', value: count(a => a.status === 'Available'), hint: 'Units in the pool and free to assign (status Available). Click to filter.', dot: METRIC_DOT.green, active: sameSet(filters.status, ['Available']), apply: () => { filters.status = ['Available'] } },
    { key: 'overdue', label: 'Overdue returns', value: count(a => a.status === 'Overdue Return'), hint: 'Returns not completed within the window (status Overdue Return). Click to filter.', dot: METRIC_DOT.red, active: sameSet(filters.status, ['Overdue Return']), apply: () => { filters.status = ['Overdue Return'] } },
    { key: 'warranty', label: 'Warranty ending in 90 days', value: count(a => WARRANTY_SOON.includes(warrantyBucket(a))), hint: 'Warranties that end within 30, 60 or 90 days, counted from the purchase order date and the model warranty. Click to filter.', dot: METRIC_DOT.orange, active: sameSet(filters.warranty, WARRANTY_SOON), apply: () => { filters.warranty = [...WARRANTY_SOON] } },
    { key: 'exited', label: 'Returned or pulled out', value: count(isExited), hint: `Units that left the company: ${count(a => a.status === 'Supplier Return')} Supplier Return and ${count(a => a.status === 'Client Pull-Out')} Client Pull-Out. Click to filter.`, dot: METRIC_DOT.gray, active: sameSet(filters.status, ['Supplier Return', 'Client Pull-Out']), apply: () => { filters.status = ['Supplier Return', 'Client Pull-Out'] } }
  ]
})
function toggleMetric(m: { active: boolean, apply: null | (() => void), key: string }) {
  if (!m.apply) return
  if (m.active) { filters.status = []; filters.warranty = [] } else { filters.status = []; filters.warranty = []; m.apply() }
}


// Paging, selection and export, as on the ticket tracker.
const page = ref(1)
const pageSize = ref<number>(10)
const pageSizeOptions = [{ label: '10', value: 10 }, { label: '15', value: 15 }, { label: '25', value: 25 }]
watch([search, filters, pageSize], () => { page.value = 1 }, { deep: true })
watch(() => filtered.value.length, (n) => {
  const last = Math.max(1, Math.ceil(n / pageSize.value))
  if (page.value > last) page.value = last
})
const paginated = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

const selectedTags = ref<Set<string>>(new Set())
// A selection never holds rows that a filter, a search or a scenario has taken off the list.
watch(filtered, (list) => {
  const keep = new Set(list.map(a => a.tag))
  const next = new Set([...selectedTags.value].filter(t => keep.has(t)))
  if (next.size !== selectedTags.value.size) selectedTags.value = next
})
const allOnPageSelected = computed(() => paginated.value.length > 0 && paginated.value.every(a => selectedTags.value.has(a.tag)))
function toggleRow(tag: string, checked: boolean) {
  const next = new Set(selectedTags.value)
  if (checked) next.add(tag)
  else next.delete(tag)
  selectedTags.value = next
}
function toggleAllOnPage(checked: boolean) {
  const next = new Set(selectedTags.value)
  for (const a of paginated.value) {
    if (checked) next.add(a.tag)
    else next.delete(a.tag)
  }
  selectedTags.value = next
}
function clearSelection() { selectedTags.value = new Set() }
// A cell that starts with = + - @ would run as a formula in a spreadsheet, so it gets a leading quote.
const csvEscape = (raw: string) => {
  const v = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}
function exportSelected() {
  const picked = rows.value.filter(a => selectedTags.value.has(a.tag))
  const lines = picked.map(a => [a.tag, a.serial, a.model, a.type, a.status, a.sub ?? '', a.techPack, a.custodian, a.owner, a.location].map(csvEscape).join(','))
  const csv = [['Tag', 'Serial', 'Model', 'Type', 'Status', 'Sub-status', 'Tech Pack', 'Checked out to', 'Owner', 'Location'].join(','), ...lines].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'assets.csv'
  link.click()
  URL.revokeObjectURL(url)
  toast.add({ title: `${picked.length} asset${picked.length === 1 ? '' : 's'} exported`, icon: 'i-lucide-download', color: 'success' })
}

const loading = computed(() => assetsSimState.value === 'loading')
const notFound = computed(() => assetsSimState.value === 'notfound')
const canMove = computed(() => assetsSimRole.value === 'officer')

// Headline + summary. The page is named in the sidebar and breadcrumb, so the heading is a live
// status line instead of repeating "Assets".
function countStatus(name: string) { return allAssets().filter(a => a.status === name).length }
const total = computed(() => allAssets().length)
const exitedCount = computed(() => allAssets().filter(isExited).length)


// The title counts the units; the line under it says where they are, which the status cards below do not.
const headline = computed(() => `${rows.value.length} assets tracked`)
const subline = computed(() => {
  const all = rows.value
  const withMembers = all.filter(a => locationTypeOf(a) === 'User Address').length
  const atGoTeam = all.filter(a => locationTypeOf(a) === 'Office Location').length
  const away = all.length - withMembers - atGoTeam
  const parts = [
    withMembers ? `${withMembers} with team members` : '',
    atGoTeam ? `${atGoTeam} at GoTeam locations` : '',
    away ? `${away} at a supplier or client` : ''
  ].filter(Boolean)
  return parts.length ? `${parts.join(', ')}.` : 'Assets you add will show here.'
})

const NAME_ICON: Record<string, string> = { Laptop: 'i-lucide-laptop', Monitor: 'i-lucide-monitor', Desktop: 'i-lucide-computer' }
const ownershipLabel = (a: Asset) => a.owner === 'GoTeam' ? 'GoTeam-Owned' : 'Client-Owned'
function poToast(a: Asset) {
  toast.add({ title: a.po, description: 'This opens the purchase order page. It is an existing view in the system and out of scope for this task.', icon: 'i-lucide-file-text', color: 'info' })
}
function locationToast(a: Asset) {
  toast.add({ title: locationView(a).text, description: 'This opens the location page. It is an existing view in the system and out of scope for this task.', icon: 'i-lucide-map-pin', color: 'info' })
}
function modelToast(a: Asset) {
  toast.add({ title: a.model, description: 'This opens the asset model detail page. It is an existing view in the system and out of scope for this task.', icon: 'i-lucide-box', color: 'info' })
}
function money(a: Asset) {
  return a.cost ? `${a.currency} ${a.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''
}
</script>

<template>
  <div class="bg-gray-50 dark:bg-transparent h-full flex flex-col overflow-hidden">
    <!-- Fixed header: live status headline, actions, filterable summary chips -->
    <div class="shrink-0 bg-card px-4 sm:px-8 pt-5 pb-3 border-b border-default">
      <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-6 mb-4">
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold text-highlighted">{{ headline }}</h1>
          <p class="text-sm text-muted pt-1">{{ subline }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
          <UButton color="neutral" variant="outline" size="md" icon="i-lucide-qr-code" label="Find by QR" />
          <UButton color="neutral" variant="outline" size="md" icon="i-lucide-download" label="CSV" />
          <UButton color="primary" size="md" icon="i-lucide-plus" label="Add Asset" />
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Asset metrics">
        <UTooltip v-for="m in metrics" :key="m.key" :text="m.hint" :delay-duration="200">
        <component
          :is="m.apply ? 'button' : 'div'"
          :type="m.apply ? 'button' : undefined"
          class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors"
          :class="[m.active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-default bg-card', m.apply ? 'hover:bg-elevated' : '']"
          :aria-pressed="m.apply ? m.active : undefined"
          @click="toggleMetric(m)"
        >
          <span class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: m.dot }" aria-hidden="true" />
          <span class="text-sm text-muted">{{ m.label }}</span>
          <span class="text-sm font-semibold tabular-nums text-highlighted">{{ m.value }}</span>
        </component>
        </UTooltip>
      </div>
    </div>

    <!-- One scroll area: filter strip + table card -->
    <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div class="flex flex-col px-6 pt-3 pb-4 stage-enter">
        <div class="flex flex-col rounded-xl overflow-hidden bg-card border border-default shadow-sm">
          <!-- Toolbar -->
          <div class="px-6 py-4">
            <div class="flex flex-col sm:flex-row sm:items-center gap-3">
              <UTooltip :text="searchPlaceholder" :disabled="!placeholderClipped || !!search" :delay-duration="150">
                <div ref="searchBox" class="w-full sm:max-w-[15rem]">
                  <UInput v-model="search" icon="i-lucide-search" aria-label="Search assets" :placeholder="searchPlaceholder" size="md" class="w-full" :ui="{ base: 'text-ellipsis' }" />
                </div>
              </UTooltip>
              <div class="flex flex-wrap items-center gap-2">
                <AssetsFilterMenu v-for="d in FILTERS.filter(x => x.quick)" :key="d.key" v-model="filters[d.key]" compact :label="d.label" :noun="d.noun" :items="facets[d.key]" :searchable="d.searchable" :disabled="isDisabled(d)" />
                <UButton color="neutral" :variant="activeChips.length ? 'subtle' : 'outline'" size="sm" icon="i-lucide-sliders-horizontal" aria-haspopup="dialog" @click="panelOpen = true">
                  All filters
                  <UBadge v-if="activeChips.length" :label="String(activeChips.length)" color="primary" variant="solid" size="sm" class="rounded-full tabular-nums" />
                </UButton>
                <UButton v-if="anyFilter" color="neutral" variant="ghost" size="sm" class="text-muted" @click="clearFilters">Clear</UButton>
              </div>
              <template v-if="selectedTags.size">
                <span class="text-sm font-medium text-primary sm:ml-auto">{{ selectedTags.size }} selected</span>
                <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-download" @click="exportSelected">Export selected</UButton>
                <UButton color="neutral" variant="ghost" size="sm" class="text-muted" @click="clearSelection">Clear</UButton>
              </template>
            </div>
          </div>

          <!-- Applied filters: one removable chip per filter, named, so a bare value like "In Use" is never ambiguous.
               The row only exists while something is applied, so a quiet table costs no space. -->
          <div v-if="activeChips.length" class="flex flex-wrap items-center gap-2 px-6 pb-4" role="group" aria-label="Applied filters">
            <span v-for="c in activeChips" :key="c.key" class="inline-flex max-w-full sm:max-w-sm items-center gap-1.5 rounded-md border border-default bg-slate-50 dark:bg-gray-800 pl-2 pr-1 py-1 text-xs">
              <span class="shrink-0 font-medium text-default">{{ c.label }}:</span>
              <AssetsTruncate :text="c.summary" class="text-highlighted" />
              <button type="button" class="shrink-0 rounded p-0.5 text-muted hover:bg-elevated hover:text-default" :aria-label="`Remove ${c.label} filter`" @click="c.remove()">
                <UIcon name="i-lucide-x" class="size-3.5" aria-hidden="true" />
              </button>
            </span>
            <UButton color="neutral" variant="link" size="xs" label="Clear all" @click="clearFilters" />
          </div>

          <!-- Not found -->
          <div v-if="notFound" class="flex flex-col items-center text-center gap-2 py-16 text-muted">
            <UIcon name="i-lucide-unplug" class="size-6" />
            <p class="text-sm font-medium text-default">We couldn't load the assets</p>
            <p class="text-xs">Check your connection and try again.</p>
            <UButton color="neutral" variant="outline" size="sm" label="Try again" class="mt-1" @click="assetsSimState = 'populated'" />
          </div>

          <!-- Empty -->
          <div v-else-if="!loading && !filtered.length" class="flex flex-col items-center text-center gap-2 py-16 text-muted">
            <UIcon name="i-lucide-box" class="size-6" />
            <p class="text-sm font-medium text-default">{{ anyFilter ? 'No assets match' : 'No assets yet' }}</p>
            <p class="text-xs">{{ anyFilter ? 'Try removing a filter or changing the search.' : 'Assets you add will show here.' }}</p>
            <UButton v-if="anyFilter" color="neutral" variant="outline" size="sm" label="Clear search and filters" class="mt-1" @click="clearFilters" />
          </div>

          <!-- Table: the ticket tracker's markup. Checkbox, Tag and Serial are frozen on the left, Actions on the
               right; each frozen cell has a fixed width so the left offsets add up exactly. -->
          <div v-else class="px-6">
            <div class="overflow-x-auto">
              <table class="w-full table-fixed overflow-clip text-sm border-separate border-spacing-0" style="min-width: 3726px">
                <colgroup><col style="width: 48px"><col style="width: 250px"><col style="width: 260px"><col style="width: 220px"><col style="width: 150px"><col style="width: 200px"><col style="width: 300px"><col style="width: 180px"><col style="width: 170px"><col style="width: 170px"><col style="width: 240px"><col style="width: 220px"><col style="width: 200px"><col style="width: 470px"><col style="width: 150px"><col style="width: 230px"><col style="width: 180px"><col style="width: 88px"></colgroup>
                <thead>
                  <tr class="relative">
                    <th class="sticky left-0 z-[20] w-12 min-w-12 max-w-12 bg-slate-50 dark:bg-gray-800 pl-4 pr-2 py-3.5 border-b border-t border-l border-default rounded-tl-lg">
                      <UCheckbox :model-value="allOnPageSelected" aria-label="Select all on page" @update:model-value="(v) => toggleAllOnPage(!!v)" />
                    </th>
                    <th class="sticky left-12 z-[20] w-[250px] min-w-[250px] max-w-[250px] bg-slate-50 dark:bg-gray-800 px-4 py-3.5 text-xs text-muted text-left font-medium whitespace-nowrap border-b border-t border-default">Tag</th>
                    <th class="sticky left-[298px] z-[20] w-[260px] min-w-[260px] max-w-[260px] bg-slate-50 dark:bg-gray-800 px-4 py-3.5 text-xs text-muted text-left font-medium whitespace-nowrap border-b border-t border-default border-r">Serial</th>
                    <th v-for="h in ['Model', 'Name', 'Type', 'Status', 'Tech Pack', 'Ownership', 'Movement Status', 'Checked in by / Checked out to', 'Checked out to (Client)', 'Owner', 'Location', 'Purchase Order', 'Supplier']" :key="h" class="bg-slate-50 dark:bg-gray-800 px-4 py-3.5 text-xs text-muted text-left font-medium whitespace-nowrap border-b border-t border-default">{{ h }}</th>
                    <th class="bg-slate-50 dark:bg-gray-800 px-4 py-3.5 text-xs text-muted text-left font-medium whitespace-nowrap border-b border-t border-default text-right">Acquisition Cost</th>
                    <!-- The corner pixels outside this header's radius are painted with the card colour, so
                         the scrolling header cells beneath can't show through at the top right. -->
                    <th class="sticky right-0 z-[20] w-[88px] min-w-[88px] max-w-[88px] bg-slate-50 dark:bg-gray-800 px-4 py-3.5 text-xs text-muted text-center font-medium whitespace-nowrap border-b border-t border-l border-r border-default rounded-tr-lg after:absolute after:-top-px after:-right-px after:size-2 after:pointer-events-none after:content-[''] after:bg-[radial-gradient(circle_at_0_100%,transparent_7.5px,var(--color-card)_8px)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <!-- Loading: the same row shapes as the real cells, so nothing jumps when the data arrives -->
                  <template v-if="loading">
                    <tr v-for="n in 6" :key="n" role="status" aria-label="Loading assets">
                      <td class="sticky left-0 z-[10] w-12 min-w-12 max-w-12 bg-card pl-4 pr-2 py-3.5 border-b border-default"><SharedSkeleton width="w-4" height="h-4" rounded="rounded-sm" /></td>
                      <td class="sticky left-12 z-[10] w-[250px] min-w-[250px] max-w-[250px] bg-card group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 px-4 py-3.5 whitespace-nowrap border-b border-default"><SharedSkeleton width="w-52" height="h-4" /></td>
                      <td class="sticky left-[298px] z-[10] w-[260px] min-w-[260px] max-w-[260px] bg-card group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 px-4 py-3.5 whitespace-nowrap border-b border-default border-r"><SharedSkeleton width="w-24" height="h-4" /></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><SharedSkeleton width="w-36" height="h-4" /></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><div class="flex items-center gap-2"><SharedSkeleton width="w-4" height="h-4" rounded="rounded-sm" /><SharedSkeleton width="w-16" height="h-4" /></div></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><div class="flex items-center gap-2"><SharedSkeleton width="w-4" height="h-4" rounded="rounded-sm" /><SharedSkeleton width="w-32" height="h-4" /></div></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><SharedSkeleton width="w-52" height="h-5" rounded="rounded-md" /></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><div class="flex items-center gap-2"><SharedSkeleton width="w-16" height="h-5" rounded="rounded-md" /><SharedSkeleton width="w-14" height="h-5" rounded="rounded-md" /></div></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><SharedSkeleton width="w-24" height="h-4" /></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><div class="flex items-center gap-2"><SharedSkeleton width="w-4" height="h-4" rounded="rounded-sm" /><SharedSkeleton width="w-20" height="h-4" /></div></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><div class="flex items-center gap-2"><SharedSkeleton width="w-6" height="h-6" circle /><SharedSkeleton width="w-24" height="h-4" /></div></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><div class="flex items-center gap-2"><SharedSkeleton width="w-6" height="h-6" rounded="rounded-md" /><SharedSkeleton width="w-28" height="h-4" /></div></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><div class="flex items-center gap-2"><SharedSkeleton width="w-6" height="h-6" rounded="rounded-md" /><SharedSkeleton width="w-24" height="h-4" /></div></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><div class="flex items-center gap-2"><SharedSkeleton width="w-4" height="h-4" rounded="rounded-sm" /><SharedSkeleton width="w-64" height="h-4" /></div></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><SharedSkeleton width="w-20" height="h-4" /></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><div class="flex items-center gap-2"><SharedSkeleton width="w-6" height="h-6" rounded="rounded-md" /><SharedSkeleton width="w-28" height="h-4" /></div></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 text-right"><div class="flex justify-end"><SharedSkeleton width="w-24" height="h-4" /></div></td>
                      <td class="sticky right-0 z-[10] w-[88px] min-w-[88px] max-w-[88px] bg-card group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 px-4 py-3.5 whitespace-nowrap border-b border-default border-l"><div class="flex justify-center"><SharedSkeleton width="w-6" height="h-6" rounded="rounded-md" /></div></td>
                    </tr>
                  </template>
                  <template v-else>
                    <tr v-for="a in paginated" :key="a.tag" class="group relative transition-colors">
                      <td class="sticky left-0 z-[10] w-12 min-w-12 max-w-12 bg-card group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 pl-4 pr-2 py-3.5 border-b border-default">
                        <UCheckbox :model-value="selectedTags.has(a.tag)" aria-label="Select asset" @update:model-value="(v) => toggleRow(a.tag, !!v)" />
                      </td>
                      <td class="sticky left-12 z-[10] w-[250px] min-w-[250px] max-w-[250px] bg-card group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 px-4 py-3.5 whitespace-nowrap border-b border-default">
                        <NuxtLink :to="`/assets/${a.tag}`" class="text-sm font-medium text-blue-700 hover:text-blue-800 dark:text-blue-400">{{ a.tag }}</NuxtLink>
                      </td>
                      <td class="sticky left-[298px] z-[10] w-[260px] min-w-[260px] max-w-[260px] bg-card group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 px-4 py-3.5 whitespace-nowrap border-b border-default border-r text-muted">{{ a.serial }}</td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                        <button type="button" class="text-sm text-blue-700 hover:text-blue-800 dark:text-blue-400 text-left" @click="modelToast(a)">{{ a.model }}</button>
                      </td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                        <span class="inline-flex items-center gap-2 text-default">
                          <UIcon :name="NAME_ICON[a.name] ?? 'i-lucide-tag'" class="size-4 text-muted shrink-0" aria-hidden="true" />{{ a.name }}
                        </span>
                      </td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                        <span class="inline-flex items-center gap-2 text-default">
                          <UIcon v-if="TYPE_ICON[a.type]" :name="TYPE_ICON[a.type]!" class="size-4 text-muted shrink-0" aria-hidden="true" />
                          {{ a.type }}
                        </span>
                      </td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><AssetsStatusPill :status="a.status" :date="a.statusDate" /></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60"><AssetsTechPackBadge :type="a.techPack" :tier="a.tier" /></td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 text-default">{{ ownershipLabel(a) }}</td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                        <span class="inline-flex items-center gap-1.5 text-default">
                          <UIcon :name="a.movementStatus === 'Checked In' ? 'i-lucide-log-in' : 'i-lucide-log-out'" class="size-4" :class="a.movementStatus === 'Checked In' ? 'text-blue-500' : 'text-purple-500'" aria-hidden="true" />{{ a.movementStatus }}
                        </span>
                      </td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                        <span v-if="a.custodian" class="inline-flex items-center gap-2">
                          <span class="inline-flex items-center justify-center shrink-0 rounded-full size-6 text-xs font-semibold" :class="avatarTint(a.custodian)" aria-hidden="true">{{ initials(a.custodian) }}</span>
                          <span class="text-default">{{ a.custodian }}</span>
                        </span>
                        <AssetsEmptyMark v-else />
                      </td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                        <span v-if="a.movementStatus === 'Checked Out' && a.client" class="inline-flex items-center gap-2">
                          <span class="inline-flex items-center justify-center shrink-0 rounded-md bg-elevated size-6 text-xs font-medium text-slate-600 dark:text-slate-300" aria-hidden="true">{{ initials(a.client) }}</span>
                          <span class="text-default">{{ a.client }}</span>
                        </span>
                        <AssetsEmptyMark v-else />
                      </td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                        <span class="inline-flex items-center gap-2">
                          <span class="inline-flex items-center justify-center shrink-0 rounded-md bg-elevated size-6 text-xs font-medium text-slate-600 dark:text-slate-300" aria-hidden="true">{{ initials(a.owner) }}</span>
                          <span class="text-default">{{ a.owner }}</span>
                        </span>
                      </td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                        <UTooltip :text="locationView(a).tip">
                          <span class="inline-flex items-center gap-2 text-default">
                            <UIcon :name="locationView(a).icon" class="size-4 text-muted shrink-0" aria-hidden="true" />
                            <button v-if="locationView(a).kind === 'location'" type="button" class="text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-left" @click="locationToast(a)">{{ locationView(a).text }}</button>
                            <template v-else>{{ locationView(a).text }}</template>
                          </span>
                        </UTooltip>
                      </td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                        <button v-if="a.po" type="button" class="text-sm text-blue-700 hover:text-blue-800 dark:text-blue-400 text-left" @click="poToast(a)">{{ a.po }}</button>
                        <AssetsEmptyMark v-else />
                      </td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                        <span v-if="a.supplier" class="inline-flex items-center gap-2">
                          <span class="inline-flex items-center justify-center shrink-0 rounded-md bg-elevated size-6 text-xs font-medium text-slate-600 dark:text-slate-300" aria-hidden="true">{{ initials(a.supplier) }}</span>
                          <span class="text-default">{{ a.supplier }}</span>
                        </span>
                        <AssetsEmptyMark v-else />
                      </td>
                      <td class="px-4 py-3.5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 text-right tabular-nums">
                        <template v-if="money(a)">{{ money(a) }}</template>
                        <AssetsEmptyMark v-else />
                      </td>
                      <td class="sticky right-0 z-[10] w-[88px] min-w-[88px] max-w-[88px] bg-card group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 px-4 py-3.5 whitespace-nowrap border-b border-default border-l text-center">
                        <UTooltip v-if="canMove && !isExited(a)" text="Move asset">
                          <UButton :to="`/move-asset/${a.tag}/move`" color="neutral" variant="ghost" size="xs" square icon="i-lucide-truck" :aria-label="`Move ${a.tag}`" />
                        </UTooltip>
                        <AssetsEmptyMark v-else />
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="!loading && !notFound && filtered.length" class="border-t border-default p-4 sm:px-6">
            <div class="flex flex-col gap-3 w-full md:flex-row md:items-center md:justify-between">
              <div class="flex items-center gap-2">
                <span class="text-sm text-muted">Show</span>
                <USelect v-model="pageSize" :items="pageSizeOptions" aria-label="Rows per page" size="xs" class="w-24" />
                <span class="text-sm text-muted">assets per page &middot; {{ (page - 1) * pageSize + 1 }}-{{ Math.min(page * pageSize, filtered.length) }} of {{ filtered.length }}</span>
              </div>
              <UPagination v-model:page="page" size="xs" :items-per-page="pageSize" :total="filtered.length" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- All filters. Built like the Placeholder Library drawer: inset card, header with a close button, a pinned strip,
         a scrolling body with section strips, and a pinned footer. -->
    <USlideover v-model:open="panelOpen" inset :ui="{ content: 'max-w-[440px] w-[calc(100%-1.5rem)] inset-y-3 right-3 overflow-hidden', header: 'p-4 sm:px-6 min-h-16 bg-card', body: 'p-0 sm:p-0 flex flex-col overflow-hidden bg-card', footer: 'px-4 sm:px-6 py-3 border-t border-default bg-card' }">
      <template #header="{ close }">
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-semibold text-highlighted">All filters</h2>
          <p class="mt-0.5 text-xs text-muted">Results update as you choose. Counts show how many assets each value would match.</p>
        </div>
        <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-x" aria-label="Close" class="absolute top-4 end-4" @click="close" />
      </template>

      <template #body>
        <div class="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 pt-4 pb-4 border-b border-default">
          <span class="text-sm text-default tabular-nums">{{ filtered.length }} of {{ rows.length }} assets</span>
          <UBadge v-if="activeChips.length" color="primary" variant="subtle" size="sm" class="rounded-full tabular-nums">{{ activeChips.length }} applied</UBadge>
        </div>

        <div class="flex-1 overflow-y-auto px-4 pt-[10px] pb-4 sm:px-6 sm:pb-6 fade-scroll-y">
          <template v-for="g in FILTER_GROUPS" :key="g">
            <div v-if="g !== 'Promoted'" class="flex items-center gap-2 rounded-lg bg-elevated px-3 py-2 mt-4 mb-3">
              <span class="text-xs font-semibold uppercase tracking-wide text-muted">{{ g }}</span>
              <UBadge v-if="FILTERS.filter(x => x.group === g && filters[x.key].length).length" color="primary" variant="solid" size="xs" class="rounded-full">{{ FILTERS.filter(x => x.group === g && filters[x.key].length).length }}</UBadge>
            </div>
            <div class="flex flex-col gap-4" :class="g === 'Promoted' ? 'pt-3' : ''">
              <AssetsFilterMenu v-for="d in FILTERS.filter(x => x.group === g)" :key="d.key" v-model="filters[d.key]" :label="d.label" :noun="d.noun" :items="facets[d.key]" :searchable="d.searchable" :disabled="isDisabled(d)" />
            </div>
          </template>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full items-center justify-between gap-3">
          <UButton color="neutral" variant="ghost" label="Clear all" :disabled="!anyFilter" @click="clearFilters" />
          <UButton color="primary" :label="`Show ${filtered.length} asset${filtered.length === 1 ? '' : 's'}`" @click="panelOpen = false" />
        </div>
      </template>
    </USlideover>
  </div>
</template>
