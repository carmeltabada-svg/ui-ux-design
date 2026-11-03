<script setup lang="ts">
// Movements tab. Built from the asset detail design and polished with the pipeline's Stage 4 rules.
//  - Day pills centred on a divider line, as in the Activity feed, so the two logs read the same way.
//  - Summary: the custody history's two cards (movement summary, currently and first recorded).
//  - Each card has one header row (what, status, number, time) and a grid of labelled facts, with comments
//    underneath. A fact with nothing in it keeps its place and says so.
//  - A Check ins / Check outs filter; states for loading, empty (with a next action), a filter with no matches.
//  - Responsive: the facts grid is two columns on desktop and one on a phone; the header wraps.
// A Supplier Return is a check in at the supplier and a Client Pull-Out a check out to the client, both with the
// document that backs them, which opens in a new tab. "Add historical movement" is an existing action this task
// does not change.
import {
  findAsset, badgeDate, assetsSimState, assetsSimTransit, assetsSimRole, isExited, openDoc, STATUS_BG, statusDef
} from '~/data/assets'
import { movementCardsOf, initialsOf, type MovementCard } from '~/data/assetsDetail'

const route = useRoute()
const toast = useToast()
const asset = computed(() => findAsset(String(route.params.tag ?? '')))
const cards = computed(() => asset.value ? movementCardsOf(asset.value) : [])
const loading = computed(() => assetsSimState.value === 'loading')
const canMove = computed(() => assetsSimRole.value === 'officer' && !!asset.value && !isExited(asset.value))

type Filter = 'all' | 'check_in' | 'check_out'
const filter = ref<Filter>('all')
const filters = computed(() => [
  { value: 'all' as const, label: 'All', count: cards.value.length },
  { value: 'check_in' as const, label: 'Check ins', count: cards.value.filter(c => c.type === 'check_in').length },
  { value: 'check_out' as const, label: 'Check outs', count: cards.value.filter(c => c.type === 'check_out').length }
])
const filtered = computed(() => cards.value.filter(c => filter.value === 'all' || c.type === filter.value))

const PAGE = 10
const page = ref(1)
watch(filter, () => { page.value = 1 })
watch(() => filtered.value.length, (n) => { const last = Math.max(1, Math.ceil(n / PAGE)); if (page.value > last) page.value = last })
const shown = computed(() => filtered.value.slice((page.value - 1) * PAGE, page.value * PAGE))

// "Today" and "Yesterday" read faster than a date; anything older shows the date.
function dayLabel(iso: string, ago: string): string {
  if (ago === 'today') return 'Today'
  if (ago === '1 day ago') return 'Yesterday'
  return badgeDate(iso)
}
const days = computed(() => {
  const out: { date: string, label: string, items: MovementCard[] }[] = []
  for (const m of shown.value) {
    const last = out[out.length - 1]
    if (last && last.date === m.date) last.items.push(m)
    else out.push({ date: m.date, label: dayLabel(m.date, m.ago), items: [m] })
  }
  return out
})

const latest = computed(() => cards.value[0])
const earliest = computed(() => cards.value[cards.value.length - 1])
const outCount = computed(() => cards.value.filter(c => c.type === 'check_out').length)
const inCount = computed(() => cards.value.length - outCount.value)

function historicalToast() {
  toast.add({ title: 'Add historical movement', description: 'Recording past movements is an existing action. It is not changed by this task.', icon: 'i-lucide-info', color: 'info' })
}
function badgeClass(status?: string) {
  return STATUS_BG[statusDef(status ?? '')?.color ?? 'gray']
}
</script>

<template>
  <div class="stage-enter">
    <div class="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h2 class="text-lg font-semibold text-highlighted text-balance">
          Asset Movements
        </h2>
        <p class="text-sm text-muted mt-1 text-pretty">
          Track the movement history of this asset
        </p>
      </div>
      <UButton
        color="neutral"
        variant="outline"
        size="md"
        icon="i-lucide-plus"
        label="Add historical movement"
        @click="historicalToast"
      />
    </div>

    <!-- Summary: the same two cards, built from the same components, as the custody history -->
    <div
      v-if="!loading && latest"
      class="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 mb-4"
    >
      <AssetsSummaryCard title="Movement summary">
        <div class="flex h-full">
          <AssetsSummaryCell
            label="Total movements"
            class="flex-1"
          >
            {{ cards.length }}
            <template #sub>
              {{ outCount }} checked out<span class="block">{{ inCount }} checked in</span>
            </template>
          </AssetsSummaryCell>
          <div class="w-px bg-default" />
          <AssetsSummaryCell
            label="Last moved"
            class="flex-1"
          >
            {{ badgeDate(latest.date) }}
            <template #sub>
              {{ latest.time }}<span class="block">{{ latest.ago }}</span>
            </template>
          </AssetsSummaryCell>
        </div>
      </AssetsSummaryCard>

      <AssetsSummaryCard>
        <AssetsSummaryCell
          label="Currently"
          class="!pb-3"
        >
          <span class="flex items-center gap-3 text-sm font-medium">
            <span
              class="inline-flex items-center justify-center rounded-full size-6 text-xs font-normal bg-elevated text-muted"
              aria-hidden="true"
            >{{ initialsOf(latest.type === 'check_out' && latest.member ? latest.member : latest.by) }}</span>
            {{ latest.type === 'check_out' ? (latest.member || latest.location) : latest.location }}
            <span class="text-sm font-normal text-muted">{{ latest.type === 'check_out' ? 'Checked out' : 'Checked in' }}</span>
          </span>
        </AssetsSummaryCell>
        <div class="h-px bg-default" />
        <AssetsSummaryCell
          label="First recorded"
          class="!pt-3"
        >
          <span
            v-if="earliest"
            class="flex items-center gap-3 text-sm font-medium"
          >
            <span
              class="inline-flex items-center justify-center rounded-full size-6 text-xs font-normal bg-elevated text-muted"
              aria-hidden="true"
            >{{ initialsOf(earliest.by) }}</span>
            {{ badgeDate(earliest.date) }}
            <span class="text-sm font-normal text-muted">by {{ earliest.by }}</span>
          </span>
        </AssetsSummaryCell>
      </AssetsSummaryCard>
    </div>

    <AssetsFilterChips
      v-if="cards.length && !loading"
      v-model="filter"
      :items="filters"
      label="Filter movements"
    />

    <div
      v-if="loading"
      class="flex flex-col gap-5"
      role="status"
      aria-label="Loading movements"
    >
      <div
        v-for="n in 3"
        :key="n"
        class="flex gap-4"
      >
        <SharedSkeleton
          circle
          width="w-8"
          height="h-8"
        />
        <div class="flex-1 flex flex-col gap-3">
          <SharedSkeleton
            width="w-56"
            height="h-5"
          /><SharedSkeleton
            width="w-full"
            height="h-28"
            rounded="rounded-lg"
          />
        </div>
      </div>
    </div>

    <div
      v-else-if="!cards.length"
      class="flex flex-col items-center text-center gap-2 py-12 text-muted rounded-lg border border-dashed border-default bg-card"
    >
      <UIcon
        name="i-lucide-arrow-left-right"
        class="size-6"
        aria-hidden="true"
      />
      <p class="text-sm font-medium text-default">
        No movements recorded yet
      </p>
      <p class="text-xs">
        Check ins and check outs for this asset will appear here.
      </p>
      <UButton
        v-if="canMove"
        :to="`/move-asset/${asset?.tag}/move`"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-truck"
        label="Move this asset"
        class="mt-1"
      />
    </div>

    <div
      v-else-if="!filtered.length"
      class="flex flex-col items-center text-center gap-2 py-12 text-muted rounded-lg border border-dashed border-default bg-card"
    >
      <UIcon
        name="i-lucide-filter-x"
        class="size-6"
        aria-hidden="true"
      />
      <p class="text-sm font-medium text-default">
        No movements match this filter
      </p>
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        label="Show all movements"
        class="mt-1"
        @click="filter = 'all'"
      />
    </div>

    <ol
      v-else
      class="flex flex-col"
    >
      <template
        v-for="(d, di) in days"
        :key="`${d.date}-${di}`"
      >
        <!-- Day pill centred on a divider line, the same as the Activity feed -->
        <li class="flex items-center gap-3 py-3 first:pt-0">
          <span
            class="h-px flex-1 bg-gray-200 dark:bg-gray-700"
            aria-hidden="true"
          />
          <h3 class="rounded-full border border-default bg-card px-3 py-0.5 text-xs font-medium text-default">
            {{ d.label }}
          </h3>
          <span
            class="h-px flex-1 bg-gray-200 dark:bg-gray-700"
            aria-hidden="true"
          />
        </li>

        <li
          v-for="(m, i) in d.items"
          :key="m.id"
          class="flex gap-4 items-stretch"
        >
          <div class="flex flex-col items-center shrink-0">
            <span
              class="inline-flex items-center justify-center size-8 rounded-full shrink-0"
              :class="m.type === 'check_out' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300' : 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'"
              aria-hidden="true"
            >
              <UIcon
                :name="m.type === 'check_out' ? 'i-lucide-log-out' : 'i-lucide-log-in'"
                class="size-4"
              />
            </span>
            <span
              v-if="i < d.items.length - 1"
              class="w-px flex-1 bg-gray-200 dark:bg-gray-700 mt-1"
              aria-hidden="true"
            />
          </div>

          <article
            class="flex-1 min-w-0 rounded-lg border border-default bg-card overflow-hidden"
            :class="i < d.items.length - 1 ? 'mb-5' : 'mb-1'"
          >
            <header class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2.5 border-b border-default bg-slate-50 dark:bg-gray-800/60">
              <div class="flex items-center gap-2.5 flex-wrap min-w-0">
                <h4 class="text-sm font-semibold text-highlighted">
                  {{ m.type === 'check_out' ? 'Checked out' : 'Checked in' }}
                </h4>
                <span
                  v-if="m.status"
                  class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
                  :class="badgeClass(m.status)"
                >{{ m.status }}</span>
                <span class="text-xs text-muted tabular-nums">{{ m.num }}</span>
                <span
                  v-if="m.historical"
                  class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200"
                >Historical</span>
              </div>
              <p class="text-xs text-muted whitespace-nowrap tabular-nums">
                {{ m.time }}
              </p>
            </header>

            <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 px-5 py-4">
              <div class="min-w-0">
                <dt class="text-xs font-normal text-default">
                  Location
                </dt>
                <dd class="text-sm text-highlighted mt-1 inline-flex items-start gap-1.5">
                  <UIcon
                    :name="m.locationIcon"
                    class="size-4 text-dimmed shrink-0 mt-0.5"
                    aria-hidden="true"
                  /><span class="break-words min-w-0">{{ m.location }}</span>
                </dd>
              </div>
              <div class="min-w-0">
                <dt class="text-xs font-normal text-default">
                  {{ m.type === 'check_out' && m.member ? 'Checked out to' : 'Checked in by' }}
                </dt>
                <dd class="text-sm text-highlighted mt-1 inline-flex items-center gap-2">
                  <span
                    class="inline-flex items-center justify-center shrink-0 rounded-full size-6 text-xs font-semibold bg-blue-100 text-blue-700"
                    aria-hidden="true"
                  >{{ initialsOf(m.type === 'check_out' && m.member ? m.member : m.by) }}</span>
                  <span class="truncate">{{ m.type === 'check_out' && m.member ? m.member : m.by }}</span>
                </dd>
              </div>
              <div
                v-if="m.type === 'check_out' && m.member && m.by !== m.member"
                class="min-w-0"
              >
                <dt class="text-xs font-normal text-default">
                  Recorded by
                </dt>
                <dd class="text-sm text-highlighted mt-1 truncate">
                  {{ m.by }}
                </dd>
              </div>
              <div class="md:col-span-2 min-w-0">
                <dt class="text-xs font-normal text-default">
                  Note
                </dt>
                <dd
                  v-if="m.note"
                  class="text-sm text-highlighted mt-1 text-pretty break-words"
                >
                  {{ m.note }}
                </dd>
                <dd
                  v-else
                  class="text-sm text-placeholder mt-1"
                >
                  No note recorded
                </dd>
              </div>
              <div class="md:col-span-2 min-w-0">
                <dt class="text-xs font-normal text-default">
                  Supporting document
                </dt>
                <dd class="mt-1">
                  <button
                    v-if="m.doc"
                    type="button"
                    class="inline-flex w-fit items-center gap-1.5 rounded-md border border-default bg-card px-2 py-1 text-xs text-blue-700 hover:text-blue-800 hover:bg-elevated dark:text-blue-400 transition-colors"
                    @click="openDoc(m.id, m.doc)"
                  >
                    <UIcon
                      name="i-lucide-paperclip"
                      class="size-3.5"
                      aria-hidden="true"
                    />{{ m.doc.name }}<UIcon
                      name="i-lucide-arrow-up-right"
                      class="size-3 opacity-70"
                      aria-hidden="true"
                    />
                  </button>
                  <span
                    v-else
                    class="text-sm text-placeholder"
                  >No document attached</span>
                </dd>
              </div>
              <div
                v-if="i === 0 && d === days[0] && filter === 'all' && assetsSimTransit === 'transit'"
                class="md:col-span-2"
              >
                <p class="inline-flex items-center gap-1.5 rounded-md bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 px-3 py-2 text-xs">
                  <UIcon
                    name="i-lucide-clock"
                    class="size-3.5"
                    aria-hidden="true"
                  />Waiting for the custodian to confirm receipt.
                </p>
              </div>
            </dl>

            <div class="px-5 pb-4">
              <AssetsMovementComments
                :movement-id="m.id"
                :title="m.type === 'check_out' ? 'Checked out' : 'Checked in'"
                :num="m.num"
                :location="m.location"
              />
            </div>
          </article>
        </li>
      </template>
    </ol>

    <div
      v-if="filtered.length > PAGE"
      class="mt-2 flex justify-center"
    >
      <UPagination
        v-model:page="page"
        size="xs"
        :items-per-page="PAGE"
        :total="filtered.length"
      />
    </div>
  </div>
</template>
