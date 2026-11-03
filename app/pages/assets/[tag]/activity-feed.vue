<script setup lang="ts">
// Activity Feed tab, as an ordered log. It follows the retrieval Activity Log (a uniform blue icon on a rail
// with a connecting line, the title first, the reason in a box with a rounded bar on its left) and takes two
// things from the reference images: day pills centred on a divider line, and the note set in a quiet card.
//  - Each event is one sentence: who, what, with the real status badges in it. A small meta line under it
//    carries the kind of event and the time, so the sentence is what the eye lands on.
//  - The chevron after the sentence opens the field by field detail.
//  - States: loading, empty, a filter with no matches (with a way out), long notes that wrap.
//  - Responsive: one column at every width; the rail stays on the left and the sentence wraps beside it.
import { findAsset, badgeDate, assetsSimState, openDoc } from '~/data/assets'
import { feedOf, avatarTint, type FeedItem } from '~/data/assetsDetail'

const route = useRoute()
const asset = computed(() => findAsset(String(route.params.tag ?? '')))
const items = computed(() => asset.value ? feedOf(asset.value) : [])
const loading = computed(() => assetsSimState.value === 'loading')

type Filter = 'all' | 'status' | 'movement'
const filter = ref<Filter>('all')
const filters = computed(() => [
  { value: 'all' as const, label: 'All activity', count: items.value.length },
  { value: 'status' as const, label: 'Status changes', count: items.value.filter(i => i.kind !== 'movement').length },
  { value: 'movement' as const, label: 'Movements', count: items.value.filter(i => i.kind === 'movement').length }
])
const filtered = computed(() => items.value.filter(i => filter.value === 'all' || (filter.value === 'movement' ? i.kind === 'movement' : i.kind !== 'movement')))

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
  const out: { date: string, label: string, ago: string, events: FeedItem[] }[] = []
  for (const e of shown.value) {
    const last = out[out.length - 1]
    if (last && last.date === e.date) last.events.push(e)
    else out.push({ date: e.date, label: dayLabel(e.date, e.ago), ago: e.ago, events: [e] })
  }
  return out
})

const open = ref<Set<string>>(new Set())
function toggle(id: string) {
  const next = new Set(open.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  open.value = next
}

// One blue for every event, as in the retrieval log: the icon says what kind, the colour is not a second code.
const KIND: Record<FeedItem['kind'], { icon: string, label: string }> = {
  created: { icon: 'i-lucide-plus', label: 'Added' },
  status: { icon: 'i-lucide-refresh-cw', label: 'Status change' },
  movement: { icon: 'i-lucide-arrow-left-right', label: 'Movement' },
  link: { icon: 'i-lucide-link', label: 'Replacement' }
}
</script>

<template>
  <div class="stage-enter">
    <div class="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h2 class="text-lg font-semibold text-highlighted text-balance">
          Activity feed
        </h2>
        <p class="text-sm text-muted mt-1 text-pretty">
          Everything that has happened to this asset, newest first.
        </p>
      </div>
    </div>

    <AssetsFilterChips
      v-if="items.length"
      v-model="filter"
      :items="filters"
      label="Filter activity"
    />

    <div
      v-if="loading"
      class="flex flex-col gap-6"
      role="status"
      aria-label="Loading activity"
    >
      <div
        v-for="n in 3"
        :key="n"
        class="flex gap-3.5"
      >
        <SharedSkeleton
          circle
          width="w-8"
          height="h-8"
        />
        <div class="flex-1 flex flex-col gap-2.5 pt-1">
          <SharedSkeleton
            width="w-3/4"
            height="h-4"
          /><SharedSkeleton
            width="w-32"
            height="h-3"
          />
        </div>
      </div>
    </div>

    <div
      v-else-if="!items.length"
      class="flex flex-col items-center text-center gap-2 py-12 text-muted rounded-lg border border-dashed border-default bg-card"
    >
      <UIcon
        name="i-lucide-history"
        class="size-6"
        aria-hidden="true"
      />
      <p class="text-sm font-medium text-default">
        No activity yet
      </p>
      <p class="text-xs">
        Status changes and movements will show up here as they happen.
      </p>
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
        Nothing matches this filter
      </p>
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        label="Show all activity"
        class="mt-1"
        @click="filter = 'all'"
      />
    </div>

    <ol
      v-else
      class="flex flex-col min-w-0"
    >
      <template
        v-for="(d, di) in days"
        :key="`${d.date}-${di}`"
      >
        <!-- Day pill centred on a divider line -->
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
          v-for="(e, i) in d.events"
          :key="e.id"
          class="flex gap-3.5"
        >
          <div class="flex flex-col items-center shrink-0">
            <span
              class="inline-flex items-center justify-center shrink-0 rounded-full size-8 text-xs font-semibold"
              :class="avatarTint(e.actor)"
              :title="e.actor"
              aria-hidden="true"
            >{{ e.initials }}</span>
            <span
              v-if="i < d.events.length - 1"
              class="w-px flex-1 my-2 bg-gray-200 dark:bg-gray-700"
              aria-hidden="true"
            />
          </div>

          <div
            class="flex-1 min-w-0"
            :class="i < d.events.length - 1 ? 'mb-4' : 'mb-1'"
          >
            <div class="rounded-lg border border-default bg-card px-4 py-3">
              <div class="flex items-start gap-2">
                <p class="flex-1 min-w-0 text-sm text-muted text-pretty flex flex-wrap items-center gap-x-1.5 gap-y-1.5 leading-snug">
                  <span class="font-semibold text-highlighted">{{ e.actor }}</span>
                  <template v-if="e.kind === 'created'">
                    <span>added this asset as</span><AssetsStatusPill :status="e.to!.status" />
                  </template>
                  <template v-else-if="e.kind === 'status'">
                    <span>changed the status from</span><AssetsStatusPill
                      :status="e.from!.status"
                      :sub="e.from!.sub"
                    /><span>to</span><AssetsStatusPill
                      :status="e.to!.status"
                      :sub="e.to!.sub"
                    />
                  </template>
                  <template v-else-if="e.kind === 'link'">
                    <span>linked this unit as the replacement for</span><span class="font-medium text-highlighted">{{ e.link!.tag }}</span>
                  </template>
                  <template v-else>
                    <span v-if="e.movement!.type === 'check_out'">checked this asset out to <span class="font-medium text-highlighted">{{ e.movement!.member || e.movement!.location }}</span></span>
                    <span v-else>checked this asset in at <span class="font-medium text-highlighted">{{ e.movement!.location }}</span></span>
                    <span class="text-xs tabular-nums">{{ e.movement!.num }}</span>
                  </template>
                </p>
                <button
                  type="button"
                  class="relative shrink-0 inline-flex items-center justify-center size-6 rounded-md text-muted hover:text-default hover:bg-elevated transition-[background-color,color,transform] duration-150 active:scale-[0.96] before:absolute before:-inset-2 before:content-['']"
                  :aria-expanded="open.has(e.id)"
                  :aria-label="open.has(e.id) ? 'Hide details' : 'View details'"
                  @click="toggle(e.id)"
                >
                  <UIcon
                    :name="open.has(e.id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                    class="size-4"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <!-- Meta line: the kind of event and the time -->
              <p class="flex items-center gap-1.5 mt-2 text-xs text-muted tabular-nums">
                <UIcon
                  :name="KIND[e.kind].icon"
                  class="size-3.5 text-dimmed"
                  aria-hidden="true"
                />
                <span>{{ e.time }}</span><span
                  class="text-dimmed"
                  aria-hidden="true"
                >·</span><span>{{ KIND[e.kind].label }}</span>
              </p>

              <!-- The reason, set apart in a card with a rounded bar on its left. No note keeps its place. -->
              <div class="relative mt-3 rounded-lg border border-default bg-slate-50 dark:bg-gray-800/60 py-2.5 pr-3 pl-5">
                <span
                  class="absolute left-2.5 top-2.5 bottom-2.5 w-0.5 rounded-full"
                  :class="e.note ? 'bg-primary/50' : 'bg-gray-300 dark:bg-gray-600'"
                  aria-hidden="true"
                />
                <p
                  v-if="e.note"
                  class="text-sm text-default text-pretty break-words"
                >
                  {{ e.note }}
                </p>
                <p
                  v-else
                  class="text-sm text-placeholder"
                >
                  No note recorded
                </p>
              </div>
              <div class="mt-2">
                <button
                  v-if="e.doc && e.docRef"
                  type="button"
                  class="inline-flex w-fit items-center gap-1.5 rounded-md border border-default bg-card px-2 py-1 text-xs text-blue-700 hover:text-blue-800 hover:bg-elevated dark:text-blue-400 transition-colors"
                  @click="openDoc(e.docRef!.id, e.docRef!.doc)"
                >
                  <UIcon
                    name="i-lucide-paperclip"
                    class="size-3.5"
                    aria-hidden="true"
                  />{{ e.doc }}<UIcon
                    name="i-lucide-arrow-up-right"
                    class="size-3 opacity-70"
                    aria-hidden="true"
                  />
                </button>
                <p
                  v-else
                  class="inline-flex items-center gap-1.5 text-xs text-placeholder"
                >
                  <UIcon
                    name="i-lucide-paperclip"
                    class="size-3.5"
                    aria-hidden="true"
                  />No document attached
                </p>
              </div>

              <dl
                v-if="open.has(e.id)"
                class="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-default bg-elevated/50 p-4"
              >
                <div
                  v-for="[k, v] in e.detail"
                  :key="k"
                  class="min-w-0"
                >
                  <dt class="text-xs font-normal text-default">
                    {{ k }}
                  </dt>
                  <dd class="text-sm text-highlighted mt-1 break-words">
                    {{ v }}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </li>
      </template>
    </ol>

    <div
      v-if="filtered.length > PAGE"
      class="mt-6 flex justify-center"
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
