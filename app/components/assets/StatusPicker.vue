<script setup lang="ts">
// Searchable, grouped status picker for the Move Asset New Status field. Built on UPopover so it
// can host per-option behavior the native selects can't. Statuses out of this prototype's scope are
// shown plainly disabled. Only Client Pull-Out, when the unit isn't eligible, carries an info
// affordance: hovering the row (or the info button) shows the reason in a tooltip above, and
// clicking the disabled row raises a toast with the same reason.
import { LANE_ORDER, LANE_LABELS, type StatusOption } from '~/data/assets'

const props = defineProps<{
  modelValue: string
  options: StatusOption[]
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const toast = useToast()
const open = ref(false)
const query = ref('')

function explain(o: StatusOption) {
  if (o.reason) toast.add({ title: `${o.name} isn't available for this unit`, description: o.reason, icon: 'i-lucide-info', color: 'info' })
}

const groups = computed(() => {
  const q = query.value.trim().toLowerCase()
  return LANE_ORDER.map(lane => ({
    lane,
    label: LANE_LABELS[lane],
    items: props.options.filter(o => o.lane === lane && (!q || o.name.toLowerCase().includes(q)))
  })).filter(g => g.items.length)
})

const selectedName = computed(() => props.options.find(o => o.name === props.modelValue)?.name ?? '')

function choose(o: StatusOption) {
  if (o.disabled) { explain(o); return }
  emit('update:modelValue', o.name)
  open.value = false
  query.value = ''
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'start' }" :ui="{ content: 'w-(--reka-popper-anchor-width) min-w-72' }">
    <button
      type="button"
      class="flex items-center gap-2 w-full h-9 px-2.5 text-sm text-left bg-default border border-accented rounded-md hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      :class="selectedName ? 'text-default' : 'text-dimmed'"
    >
      <span class="flex-1 min-w-0 truncate">{{ selectedName || placeholder || 'Select status' }}</span>
      <UIcon name="i-lucide-chevron-down" class="size-4 shrink-0 text-dimmed" />
    </button>

    <template #content>
      <div class="flex flex-col max-h-80">
        <div class="p-2 border-b border-default shrink-0">
          <UInput v-model="query" size="sm" icon="i-lucide-search" placeholder="Search status" autofocus class="w-full" />
        </div>
        <div class="min-h-0 overflow-y-auto fade-scroll-y p-1">
          <template v-for="group in groups" :key="group.lane">
            <p class="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-dimmed">{{ group.label }}</p>

            <template v-for="o in group.items" :key="o.name">
              <!-- Client Pull-Out, ineligible: hovering the row shows the reason in a tooltip above;
                   clicking the status or the info button surfaces the same reason as a toast (clicks
                   close the dropdown, so a toast is what stays visible). -->
              <UTooltip v-if="o.disabled && o.info" :text="o.reason" :content="{ side: 'top' }">
                <div class="flex items-center gap-1 rounded-md">
                  <button
                    type="button"
                    class="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-sm text-left rounded-md text-dimmed cursor-not-allowed"
                    aria-disabled="true"
                    @click="explain(o)"
                  >
                    <span class="flex-1 min-w-0 truncate">{{ o.name }}</span>
                  </button>
                  <UButton
                    color="neutral" variant="ghost" size="xs" square icon="i-lucide-info"
                    :aria-label="`Why is ${o.name} unavailable`"
                    class="shrink-0 text-dimmed"
                    @click="explain(o)"
                  />
                </div>
              </UTooltip>

              <!-- Other out-of-scope statuses: plainly disabled, no info affordance -->
              <div
                v-else-if="o.disabled"
                class="px-2 py-1.5 text-sm rounded-md text-dimmed/70 cursor-not-allowed select-none"
              >{{ o.name }}</div>

              <!-- Selectable -->
              <button
                v-else
                type="button"
                class="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left rounded-md hover:bg-elevated"
                :class="o.name === modelValue ? 'text-primary font-medium' : 'text-default'"
                @click="choose(o)"
              >
                <span class="flex-1 min-w-0 truncate">{{ o.name }}</span>
                <UIcon v-if="o.name === modelValue" name="i-lucide-check" class="size-4 shrink-0 text-primary" />
              </button>
            </template>
          </template>
          <p v-if="!groups.length" class="px-2 py-6 text-sm text-center text-muted">No status matches.</p>
        </div>
      </div>
    </template>
  </UPopover>
</template>
