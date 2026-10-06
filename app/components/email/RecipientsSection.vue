<script setup lang="ts">
import type { ComputedRef } from 'vue'
import { TEAM_MEMBERS } from '~/data/teamMembers'

interface Recipient {
  email: string
  locked?: boolean
}

interface Props {
  toToken: string
  cc: Recipient[]
  bcc: Recipient[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  addCc: [string]
  addBcc: [string]
  removeCc: [string]
  removeBcc: [string]
}>()

const ccOpen = ref(false)
const bccOpen = ref(false)

// keep CC/BCC each on a single line: show as many chips as actually fit, only
// tucking the rest behind a "+N more" popover once the row would otherwise wrap
function useOverflowRow(list: ComputedRef<Recipient[]>) {
  const rowRef = ref<HTMLElement>()
  const visibleCount = ref(list.value.length)

  async function recalc() {
    const row = rowRef.value
    if (!row) return
    let count = list.value.length
    const lockedCount = list.value.filter(r => r.locked).length
    visibleCount.value = count
    await nextTick()
    while (count > lockedCount && row.scrollWidth > row.clientWidth + 1) {
      count--
      visibleCount.value = count
      await nextTick()
    }
  }

  watch(list, recalc, { deep: true })

  onMounted(() => {
    recalc()
    const ro = new ResizeObserver(() => recalc())
    if (rowRef.value) ro.observe(rowRef.value)
    onBeforeUnmount(() => ro.disconnect())
  })

  const visible = computed(() => list.value.slice(0, visibleCount.value))
  const overflow = computed(() => list.value.slice(visibleCount.value))

  return { rowRef, visible, overflow, recalc }
}

const ccList = computed(() => props.cc)
const bccList = computed(() => props.bcc)
const { rowRef: ccRowRef, visible: ccVisible, overflow: ccOverflow } = useOverflowRow(ccList)
const { rowRef: bccRowRef, visible: bccVisible, overflow: bccOverflow } = useOverflowRow(bccList)

const teamMemberItems = TEAM_MEMBERS.map(m => ({ label: `${m.name} · ${m.email}`, name: m.name, email: m.email, value: m.email }))

const ccModel = computed<string[]>({
  get: () => props.cc.filter(r => !r.locked).map(r => r.email),
  set: (values) => {
    const current = props.cc.filter(r => !r.locked).map(r => r.email)
    for (const email of values) if (!current.includes(email)) emit('addCc', email)
    for (const email of current) if (!values.includes(email)) emit('removeCc', email)
  }
})

const bccModel = computed<string[]>({
  get: () => props.bcc.map(r => r.email),
  set: (values) => {
    const current = props.bcc.map(r => r.email)
    for (const email of values) if (!current.includes(email)) emit('addBcc', email)
    for (const email of current) if (!values.includes(email)) emit('removeBcc', email)
  }
})
</script>

<template>
  <div class="pt-5 border-t border-default">
    <label class="text-xs font-semibold uppercase tracking-wide text-dimmed block mb-3.5">
      Recipients
      <span class="normal-case font-normal tracking-normal text-dimmed">· Sent by Asset Management</span>
    </label>

    <div class="flex items-center gap-2.5 py-1.5 mb-1.5">
      <span class="text-xs font-semibold uppercase tracking-wider text-dimmed min-w-10">To</span>
      <UTooltip text="GoTeam email address resolved from the retrieval ticket">
        <span class="inline-flex items-center gap-1.5 text-xs italic text-muted bg-elevated rounded-full px-3 py-1.5">
          <UIcon name="i-lucide-lock" class="size-2.5 text-dimmed" />
          <span class="not-italic rounded px-1" style="background: rgb(254,249,194); color: rgb(137,75,0);">{{ toToken }}</span>
        </span>
      </UTooltip>
    </div>

    <div class="mb-4">
      <div class="flex items-start gap-2.5 mb-1.5">
        <span class="text-xs font-semibold uppercase tracking-wider text-dimmed min-w-10 pt-1.5 shrink-0">CC</span>

        <div ref="ccRowRef" class="flex flex-nowrap gap-1.5 items-center flex-1 min-w-0">
          <USelectMenu
            v-model="ccModel"
            v-model:open="ccOpen"
            :items="teamMemberItems"
            multiple
            value-key="value"
            searchable
            placeholder="Search team members"
            size="xs"
            class="w-auto shrink-0"
            :content="{ side: 'top', align: 'start', avoidCollisions: false, sideOffset: 6 }"
            :ui="{
              base: 'rounded-full border-dashed border-primary bg-transparent hover:bg-primary/5 text-primary gap-1 px-3',
              content: 'w-72 max-h-[min(22rem,var(--reka-combobox-content-available-height,22rem))]',
              item: 'data-[state=checked]:text-primary',
              trailingIcon: 'text-primary'
            }"
          >
            <template #leading>
              <UIcon name="i-lucide-plus" class="size-3.5 text-primary" />
            </template>
            <template #default>
              <span class="text-xs font-medium">Add CC</span>
            </template>
            <template #trailing>
              <UIcon :name="ccOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3.5 text-primary" />
            </template>
            <template #item-label="{ item }">
              <div class="flex flex-col min-w-0">
                <span class="truncate">{{ item.name }}</span>
                <span class="text-dimmed text-xs truncate">{{ item.email }}</span>
              </div>
            </template>
          </USelectMenu>

          <span
            v-for="chip in ccVisible"
            :key="chip.email"
            class="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 shrink-0"
            :class="chip.locked ? 'bg-elevated' : 'bg-primary/10 text-primary'"
          >
            <UIcon v-if="chip.locked" name="i-lucide-lock" class="size-2.5 text-dimmed shrink-0" />
            <span class="truncate max-w-36">{{ chip.email }}</span>
            <button
              v-if="!chip.locked"
              type="button"
              class="opacity-70 hover:opacity-100"
              @click="$emit('removeCc', chip.email)"
            >
              <UIcon name="i-lucide-x" class="size-2.5" />
            </button>
          </span>

          <UPopover v-if="ccOverflow.length">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 shrink-0 border border-dashed border-amber-600 text-amber-600 bg-amber-50 hover:bg-amber-100"
            >
              +{{ ccOverflow.length }} more
            </button>
            <template #content>
              <div class="flex flex-col gap-1 p-2 max-w-72">
                <span
                  v-for="chip in ccOverflow"
                  :key="chip.email"
                  class="inline-flex items-center justify-between gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 bg-primary/10 text-primary"
                >
                  <span class="truncate">{{ chip.email }}</span>
                  <button type="button" class="opacity-70 hover:opacity-100 shrink-0" @click="$emit('removeCc', chip.email)">
                    <UIcon name="i-lucide-x" class="size-2.5" />
                  </button>
                </span>
              </div>
            </template>
          </UPopover>
        </div>
      </div>
    </div>

    <div class="mb-1.5">
      <div class="flex items-start gap-2.5">
        <span class="text-xs font-semibold uppercase tracking-wider text-dimmed min-w-10 pt-1.5 shrink-0">BCC</span>

        <div ref="bccRowRef" class="flex flex-nowrap gap-1.5 items-center flex-1 min-w-0">
          <USelectMenu
            v-model="bccModel"
            v-model:open="bccOpen"
            :items="teamMemberItems"
            multiple
            value-key="value"
            searchable
            placeholder="Search team members"
            size="xs"
            class="w-auto shrink-0"
            :content="{ side: 'top', align: 'start', avoidCollisions: false, sideOffset: 6 }"
            :ui="{
              base: 'rounded-full border-dashed border-primary bg-transparent hover:bg-primary/5 text-primary gap-1 px-3',
              content: 'w-72 max-h-[min(22rem,var(--reka-combobox-content-available-height,22rem))]',
              item: 'data-[state=checked]:text-primary',
              trailingIcon: 'text-primary'
            }"
          >
            <template #leading>
              <UIcon name="i-lucide-plus" class="size-3.5 text-primary" />
            </template>
            <template #default>
              <span class="text-xs font-medium">Add BCC</span>
            </template>
            <template #trailing>
              <UIcon :name="bccOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3.5 text-primary" />
            </template>
            <template #item-label="{ item }">
              <div class="flex flex-col min-w-0">
                <span class="truncate">{{ item.name }}</span>
                <span class="text-dimmed text-xs truncate">{{ item.email }}</span>
              </div>
            </template>
          </USelectMenu>

          <span
            v-for="chip in bccVisible"
            :key="chip.email"
            class="inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 bg-primary/10 text-primary shrink-0"
          >
            <span class="truncate max-w-36">{{ chip.email }}</span>
            <button type="button" class="opacity-70 hover:opacity-100" @click="$emit('removeBcc', chip.email)">
              <UIcon name="i-lucide-x" class="size-2.5" />
            </button>
          </span>

          <UPopover v-if="bccOverflow.length">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs font-semibold rounded-full px-3 py-1.5 shrink-0 border border-dashed border-amber-600 text-amber-600 bg-amber-50 hover:bg-amber-100"
            >
              +{{ bccOverflow.length }} more
            </button>
            <template #content>
              <div class="flex flex-col gap-1 p-2 max-w-72">
                <span
                  v-for="chip in bccOverflow"
                  :key="chip.email"
                  class="inline-flex items-center justify-between gap-1.5 text-xs font-medium rounded-full px-3 py-1.5 bg-primary/10 text-primary"
                >
                  <span class="truncate">{{ chip.email }}</span>
                  <button type="button" class="opacity-70 hover:opacity-100 shrink-0" @click="$emit('removeBcc', chip.email)">
                    <UIcon name="i-lucide-x" class="size-2.5" />
                  </button>
                </span>
              </div>
            </template>
          </UPopover>
        </div>
      </div>
    </div>

    <p class="text-xs text-dimmed mt-1.5">
      itasset@go.team is the Asset Team's shared inbox. It stays on every email automatically, so there's always a copy on record.
    </p>
  </div>
</template>
