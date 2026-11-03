<script setup lang="ts">
// Searchable, grouped status picker for the Move Asset New Status field. Built on UPopover so it
// can host per-option behavior the native selects can't. Every status in it can be picked.
import { LANE_ORDER, LANE_LABELS, type StatusOption } from '~/data/assets'

const props = defineProps<{
  modelValue: string
  options: StatusOption[]
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const query = ref('')

const groups = computed(() => {
  const q = query.value.trim().toLowerCase()
  // The lanes in lifecycle order, then the Legacy group, as in the live status select.
  return [...LANE_ORDER, 'legacy' as const].map(lane => ({
    lane,
    label: LANE_LABELS[lane],
    items: props.options.filter(o => o.lane === lane && (!q || o.name.toLowerCase().includes(q)))
  })).filter(g => g.items.length)
})

const selectedName = computed(() => props.options.find(o => o.name === props.modelValue)?.name ?? '')

function choose(o: StatusOption) {
  emit('update:modelValue', o.name)
  open.value = false
  query.value = ''
}
</script>

<template>
  <UPopover
    v-model:open="open"
    :content="{ align: 'start' }"
    :ui="{ content: 'w-(--reka-popper-anchor-width) min-w-72' }"
  >
    <button
      type="button"
      class="flex items-center gap-2 w-full h-9 px-2.5 text-sm text-left bg-default border border-accented rounded-md hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :class="selectedName ? 'text-default' : 'text-dimmed'"
    >
      <span class="flex-1 min-w-0 truncate">{{ selectedName || placeholder || 'Select status' }}</span>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-4 shrink-0 text-dimmed"
      />
    </button>

    <template #content>
      <div class="flex flex-col max-h-80">
        <div class="p-2 border-b border-default shrink-0">
          <UInput
            v-model="query"
            size="sm"
            icon="i-lucide-search"
            placeholder="Search status"
            autofocus
            class="w-full"
          />
        </div>
        <div class="min-h-0 overflow-y-auto overscroll-contain fade-scroll-y p-1">
          <!-- One block per lane: a divider above it, and a tinted title strip that stays at the top while its
               statuses scroll past, so it is always clear which section a status belongs to. -->
          <div
            v-for="group in groups"
            :key="group.lane"
            class="not-first:mt-2 not-first:pt-2 not-first:border-t not-first:border-default"
          >
            <p class="sticky top-0 z-[1] mb-1 rounded-md bg-elevated px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {{ group.label }}
            </p>

            <template
              v-for="o in group.items"
              :key="o.name"
            >
              <!-- Selectable -->
              <button
                type="button"
                class="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left rounded-md hover:bg-elevated"
                :class="o.name === modelValue ? 'text-primary font-medium' : 'text-default'"
                @click="choose(o)"
              >
                <span class="flex-1 min-w-0 truncate">{{ o.name }}</span>
                <UIcon
                  v-if="o.name === modelValue"
                  name="i-lucide-check"
                  class="size-4 shrink-0 text-primary"
                />
              </button>
            </template>
          </div>
          <p
            v-if="!groups.length"
            class="px-2 py-6 text-sm text-center text-muted"
          >
            No status matches.
          </p>
        </div>
      </div>
    </template>
  </UPopover>
</template>
