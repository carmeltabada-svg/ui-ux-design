<script setup lang="ts">
// Custody History tab, matching the live page (assets/[assetId]/custody-history.vue) element for element:
// the title and "Copy Custody History" button, the info note, the Age summary card and the Currently with /
// First deployed to card, then the search, the table (Asset Tag, Seq, Emp No., Custodian, Condition, Deploy Date,
// Received Date, Location, Used Age), the selected-rows footer and the pager. Newest first, 15 a page, no sorting.
// Styling follows the design system: section header strips, section labels, 14px values, borders and no shadows.
import { findAsset, localToday, assetsSimState } from '~/data/assets'
import { custodyViewFor } from '~/data/assetsActivity'
import { initialsOf, stampLabel } from '~/data/assetsDetail'

const route = useRoute()
const toast = useToast()
const asset = computed(() => findAsset(String(route.params.tag ?? '')))
const loading = computed(() => assetsSimState.value === 'loading')
const view = computed(() => asset.value ? custodyViewFor(asset.value, localToday()) : null)
const summary = computed(() => view.value?.summary ?? null)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** "14 Oct 2026", the live page's date format. */
function dmy(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[(m ?? 1) - 1]} ${y}`
}
/** "14 Oct 2026 1:34 PM", the live page's date and time format. */
const dmyTime = (iso: string, id: string) => stampLabel(iso, id).replace(', ', ' ')
const ageLabel = (months: number | null) => months === null || !Number.isFinite(months) ? '—' : months <= 0 ? '< 1 mo' : `${months} mo`

const actualSub = computed(() => summary.value?.actualSince ? `Available since ${dmyTime(summary.value.actualSince.date, summary.value.actualSince.id)}` : 'No "Available" record yet')
const usedSub = computed(() => summary.value?.firstUsed ? `First used ${dmyTime(summary.value.firstUsed.date, summary.value.firstUsed.id)}` : 'No usage yet')

// Search matches the custodian, the employee number or the asset tag. The tag is one value for the whole tab,
// so it is checked once: it widens the results only when it matches.
const search = ref('')
const filtered = computed(() => {
  const all = view.value?.lines ?? []
  const q = search.value.trim().toLowerCase()
  if (!q) return all
  if ((asset.value?.tag ?? '').toLowerCase().includes(q)) return all
  return all.filter(l => l.member.toLowerCase().includes(q) || l.empNo.toLowerCase().includes(q))
})
// Newest first, while Seq still counts up from 1.
const rows = computed(() => [...filtered.value].reverse())

const PAGE = 15
const page = ref(1)
watch(search, () => { page.value = 1; selected.value = [] })
watch(() => rows.value.length, (n) => { const last = Math.max(1, Math.ceil(n / PAGE)); if (page.value > last) page.value = last })
const shown = computed(() => rows.value.slice((page.value - 1) * PAGE, page.value * PAGE))

const selected = ref<number[]>([])
// Switching the custody state in the prototype controls must not leave ticks on rows that no longer exist.
watch(() => view.value?.lines.map(l => l.seq).join(','), () => { selected.value = selected.value.filter(s => view.value?.lines.some(l => l.seq === s)) })
const allChecked = computed(() => filtered.value.length > 0 && selected.value.length === filtered.value.length)
function toggleRow(seq: number) { selected.value = selected.value.includes(seq) ? selected.value.filter(x => x !== seq) : [...selected.value, seq] }
function toggleAll() { selected.value = allChecked.value ? [] : filtered.value.map(l => l.seq) }
const copyLabel = computed(() => selected.value.length ? `Copy ${selected.value.length} Selected` : 'Copy Custody History')

// Oldest to newest, only the checked rows: "empNo_name_MM-dd-yyyy; ..." so it pastes into one spreadsheet cell.
async function copyHistory() {
  if (!selected.value.length) { toast.add({ title: 'Select at least one row to copy.', color: 'warning' }); return }
  const picked = (view.value?.lines ?? []).filter(l => selected.value.includes(l.seq))
  const text = picked.map((l) => {
    const [y, m, d] = l.deployed.split('-')
    return `${l.empNo}_${l.member.replace(/[_;]/g, ' ')}_${m}-${d}-${y}`
  }).join('; ')
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: `Copied ${picked.length} row${picked.length === 1 ? '' : 's'}. Paste into a single cell.`, color: 'success' })
  } catch {
    toast.add({ title: 'Unable to copy to clipboard', color: 'error' })
  }
}

const COLUMNS = ['Asset Tag', 'Seq', 'Emp No.', 'Custodian', 'Condition', 'Deploy Date', 'Received Date', 'Location', 'Used Age']
</script>

<template>
  <div class="stage-enter">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-lg font-semibold text-highlighted text-balance">
          Custody History
        </h2>
        <p class="text-sm text-muted mt-1 text-pretty">
          Every custodian this asset has had, in order.
        </p>
      </div>
      <UTooltip text="Copy this asset's custody history to paste into a spreadsheet">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-copy"
          :label="copyLabel"
          @click="copyHistory"
        />
      </UTooltip>
    </div>

    <UAlert
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      class="mb-4"
      :ui="{ description: 'text-xs text-default' }"
    >
      <template #description>
        Rows here are generated automatically from Check-Out and Check-In movements, including historical ones added via
        <NuxtLink
          :to="`/assets/${asset?.tag}/movements`"
          class="text-blue-700 hover:text-blue-800 dark:text-blue-400"
        >Add Historical Movement</NuxtLink>
        in the Movements tab.
      </template>
    </UAlert>

    <div
      v-if="!loading && summary"
      class="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 mb-4"
    >
      <AssetsSummaryCard title="Age summary">
        <div class="flex h-full">
          <AssetsSummaryCell
            label="Actual age"
            class="flex-1"
          >
            {{ ageLabel(summary.actualSince ? summary.actualMonths : null) }}
            <template #sub>
              {{ actualSub }}
            </template>
          </AssetsSummaryCell>
          <div class="w-px bg-default" />
          <AssetsSummaryCell
            label="Total used age"
            class="flex-1"
          >
            {{ ageLabel(summary.count ? summary.totalUsedMonths : null) }}
            <template #sub>
              Across {{ summary.count }} custodian{{ summary.count === 1 ? '' : 's' }}<span class="block">{{ usedSub }}</span>
            </template>
          </AssetsSummaryCell>
        </div>
      </AssetsSummaryCard>

      <AssetsSummaryCard>
        <AssetsSummaryCell
          label="Currently with"
          class="!pb-3"
        >
          <span
            v-if="summary.current"
            class="flex items-center gap-3 text-sm font-medium"
          >
            <span
              class="inline-flex items-center justify-center rounded-full size-6 text-xs font-normal bg-elevated text-muted"
              aria-hidden="true"
            >{{ initialsOf(summary.current.name) }}</span>
            {{ summary.current.name }}<span class="text-sm font-normal text-muted"># {{ summary.current.empNo }}</span>
          </span>
          <span
            v-else
            class="text-sm font-normal text-muted"
          >Not currently deployed</span>
        </AssetsSummaryCell>
        <div class="h-px bg-default" />
        <AssetsSummaryCell
          label="First deployed to"
          class="!pt-3"
        >
          <span
            v-if="summary.maiden"
            class="flex items-center gap-3 text-sm font-medium"
          >
            <span
              class="inline-flex items-center justify-center rounded-full size-6 text-xs font-normal bg-elevated text-muted"
              aria-hidden="true"
            >{{ initialsOf(summary.maiden.name) }}</span>
            {{ summary.maiden.name }}<span class="text-sm font-normal text-muted"># {{ summary.maiden.empNo }}</span>
          </span>
          <span
            v-else
            class="text-sm font-normal text-muted"
          >No deployments yet</span>
        </AssetsSummaryCell>
      </AssetsSummaryCard>
    </div>

    <div class="rounded-lg border border-default bg-card overflow-hidden">
      <div class="px-4 py-3">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          aria-label="Search custodians"
          placeholder="Search custodian, asset tag or emp no."
          size="md"
          class="w-full sm:w-[360px]"
        />
      </div>
      <div
        class="overflow-x-auto"
        tabindex="0"
        role="region"
        aria-label="Custody history table"
      >
        <table class="w-full min-w-[1100px] text-sm border-separate border-spacing-0">
          <thead>
            <tr>
              <th class="w-12 px-4 py-3 text-center border-b border-default">
                <UCheckbox
                  :model-value="allChecked"
                  aria-label="Select all custody rows"
                  @update:model-value="toggleAll"
                />
              </th>
              <th
                v-for="c in COLUMNS"
                :key="c"
                class="px-4 py-3 text-left text-sm font-medium text-default whitespace-nowrap border-b border-default"
              >
                {{ c }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td
                colspan="10"
                class="px-4 py-8 text-center text-sm text-muted"
                role="status"
              >
                Loading custody history...
              </td>
            </tr>
            <template v-else-if="shown.length">
              <tr
                v-for="l in shown"
                :key="l.seq"
                class="group"
              >
                <td class="px-4 py-5 text-center border-b border-default bg-card group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                  <UCheckbox
                    :model-value="selected.includes(l.seq)"
                    :aria-label="`Select ${l.member}`"
                    @update:model-value="toggleRow(l.seq)"
                  />
                </td>
                <td class="px-4 py-5 text-sm text-blue-600 dark:text-blue-400 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                  {{ asset?.tag }}
                </td>
                <td class="px-4 py-5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                  <span
                    class="inline-flex items-center justify-center size-5 rounded-full text-xs font-medium"
                    :class="l.isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'"
                  >{{ l.seq }}</span>
                </td>
                <td class="px-4 py-5 text-sm text-muted whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                  {{ l.empNo }}
                </td>
                <td class="px-4 py-5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                  <span class="flex items-center gap-3">
                    <span
                      class="inline-flex items-center justify-center shrink-0 rounded-full size-6 text-xs font-normal bg-elevated text-muted"
                      aria-hidden="true"
                    >{{ initialsOf(l.member) }}</span>
                    <span class="text-sm text-muted">{{ l.member }}</span>
                    <UBadge
                      v-if="l.isCurrent"
                      label="Current"
                      color="primary"
                      variant="outline"
                      size="md"
                    />
                    <UBadge
                      v-else-if="l.isMaiden"
                      label="Maiden"
                      color="neutral"
                      variant="outline"
                      size="md"
                    />
                  </span>
                </td>
                <td class="px-4 py-5 whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                  <UBadge
                    :label="l.condition"
                    :color="l.condition === 'Brand New' ? 'primary' : 'neutral'"
                    variant="subtle"
                    size="md"
                  />
                </td>
                <td class="px-4 py-5 text-sm text-muted whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                  {{ dmy(l.deployed) }}
                </td>
                <td class="px-4 py-5 text-sm text-muted whitespace-nowrap border-b border-default group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                  <UBadge
                    v-if="l.inTransit"
                    label="Open"
                    color="primary"
                    variant="outline"
                    size="md"
                  />
                  <span v-else>{{ dmy(l.received) }}</span>
                </td>
                <td class="px-4 py-5 text-sm text-muted whitespace-nowrap border-b border-default min-w-[300px] group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60">
                  {{ l.location }}
                </td>
                <td class="px-4 py-5 text-sm text-muted whitespace-nowrap border-b border-default min-w-[110px] group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 tabular-nums">
                  {{ ageLabel(l.usedMonths) }}
                </td>
              </tr>
            </template>
            <tr v-else>
              <td
                colspan="10"
                class="px-8 py-8 text-center text-xs text-muted"
              >
                {{ view?.lines.length ? 'No custodian matches your search.' : "No custodians recorded yet. This fills in automatically from the asset's first Check-Out movement." }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-default">
        <span class="text-sm text-muted tabular-nums">{{ selected.length }} of {{ rows.length }} row(s) selected.</span>
        <UPagination
          v-model:page="page"
          size="sm"
          :items-per-page="PAGE"
          :total="rows.length"
          :sibling-count="1"
          show-edges
        />
      </div>
    </div>
  </div>
</template>
