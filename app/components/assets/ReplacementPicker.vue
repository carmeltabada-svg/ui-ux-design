<script setup lang="ts">
// Replacement unit picker for a Supplier Return. Searchable and grouped by how each unit relates to the unit being
// returned: same purchase order, same supplier, then other suggestions that share a model, a tech pack or a client.
// Every option can be opened on its own asset page in a new tab (the icon on the row, or Ctrl or Cmd plus click), so
// the officer can check a unit without leaving the form. The field is always optional, so a list with nothing in it
// is a normal state and says so.
import { findAsset, type ReplacementGroups, type ReplacementOption } from '~/data/assets'

const props = defineProps<{
  modelValue: string
  groups: ReplacementGroups
  placeholder?: string
  disabled?: boolean
  id?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const router = useRouter()
const open = ref(false)
const query = ref('')

const GROUPS = [
  { key: 'supplier', label: 'Same supplier', help: 'Available units from the same supplier, or received on the same purchase order.' },
  { key: 'similar', label: 'Other suggestions', help: 'Available units from another supplier that share the same model, tech pack or client with the unit being returned. The more they share, the higher they are listed.' }
] as const

const total = computed(() => props.groups.supplier.length + props.groups.similar.length)

// The top padding keeps the list below the prototype controls and the navbar when it opens upward.
// The help text of a section shows in a tooltip on hover or focus, and a click pins it open under the title.
const helpShown = ref('')

function matches(o: ReplacementOption, q: string) {
  return !q || [o.tag, o.model, o.serial, o.supplier, o.po, o.client].some(v => v.toLowerCase().includes(q))
}
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return GROUPS.map(g => ({ ...g, items: props.groups[g.key].filter(o => matches(o, q)) })).filter(g => g.items.length)
})

const selected = computed(() => {
  if (!props.modelValue) return ''
  const a = findAsset(props.modelValue)
  return a ? `${a.tag} · ${a.model}` : props.modelValue
})
const triggerText = computed(() => selected.value || (total.value ? (props.placeholder ?? 'Select a replacement unit') : 'No available units to link yet'))

/** Opens the unit's asset page in a new tab, in whichever link style the app is running with. */
function openUnit(tag: string) {
  window.open(router.resolve({ path: `/assets/${encodeURIComponent(tag)}` }).href, '_blank', 'noopener')
}

function choose(o: ReplacementOption, e: MouseEvent) {
  if (e.ctrlKey || e.metaKey) { openUnit(o.tag); return }
  emit('update:modelValue', o.tag)
  open.value = false
  query.value = ''
}
function clear() {
  emit('update:modelValue', '')
  open.value = false
  query.value = ''
}
</script>

<template>
  <!-- modal: while the list is open the page behind it does not scroll, so the list never moves or resizes under the
       pointer. -->
  <UPopover
    v-model:open="open"
    modal
    :content="{ align: 'start', side: 'bottom', sideOffset: 4, collisionPadding: { top: 120, right: 16, bottom: 16, left: 16 } }"
    :ui="{ content: 'w-[36rem] max-w-[calc(100vw-2rem)]' }"
  >
    <button
      :id="id"
      type="button"
      :disabled="disabled"
      class="flex items-center gap-2 w-full h-9 px-2.5 text-sm text-left bg-default border border-accented rounded-md hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 disabled:cursor-not-allowed"
      :class="selected ? 'text-default' : 'text-dimmed'"
    >
      <span class="flex-1 min-w-0 truncate">{{ triggerText }}</span>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-4 shrink-0 text-dimmed"
      />
    </button>

    <template #content>
      <div class="flex flex-col max-h-[min(26rem,var(--reka-popper-available-height))]">
        <div class="p-2 border-b border-default shrink-0">
          <UInput
            v-model="query"
            size="sm"
            icon="i-lucide-search"
            placeholder="Search tag, model, serial, supplier or PO"
            autofocus
            class="w-full"
          />
        </div>

        <div class="min-h-0 overflow-y-auto overscroll-contain fade-scroll-y p-1">
          <button
            v-if="modelValue"
            type="button"
            class="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left rounded-md text-default hover:bg-elevated"
            @click="clear"
          >
            <UIcon
              name="i-lucide-x"
              class="size-4 shrink-0 text-muted"
              aria-hidden="true"
            />
            <span>Clear. Not linked yet</span>
          </button>

          <template
            v-for="g in shown"
            :key="g.key"
          >
            <div class="flex items-center gap-1 px-2 mt-3 mb-1 first:mt-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-dimmed">
                {{ g.label }}
              </p>
              <UTooltip
                :text="g.help"
                :disabled="helpShown === g.key"
                :content="{ side: 'right', align: 'start' }"
                :ui="{ content: 'h-auto max-w-72 px-3 py-2', text: 'whitespace-normal break-words leading-snug' }"
              >
                <button
                  type="button"
                  class="inline-flex items-center justify-center size-5 rounded-full text-dimmed hover:text-default focus-visible:outline-2 focus-visible:outline-primary"
                  :aria-label="`What is in ${g.label}`"
                  :aria-expanded="helpShown === g.key"
                  @click="helpShown = helpShown === g.key ? '' : g.key"
                >
                  <UIcon
                    name="i-lucide-circle-help"
                    class="size-4"
                    aria-hidden="true"
                  />
                </button>
              </UTooltip>
            </div>
            <p
              v-if="helpShown === g.key"
              class="px-2 pb-1.5 text-xs text-muted"
            >
              {{ g.help }}
            </p>

            <div
              v-for="o in g.items"
              :key="o.tag"
              class="flex items-start gap-1 rounded-md hover:bg-elevated"
            >
              <button
                type="button"
                class="flex items-start gap-2 flex-1 min-w-0 px-2 py-1.5 text-sm text-left rounded-md"
                :class="o.tag === modelValue ? 'text-primary font-medium' : 'text-default'"
                @click="choose(o, $event)"
              >
                <span class="flex-1 min-w-0">
                  <span class="block break-words">{{ o.tag }} · {{ o.model }}</span>
                  <span class="block truncate text-xs font-normal text-muted">{{ o.supplier }} · {{ o.po }}</span>
                </span>
                <UIcon
                  v-if="o.tag === modelValue"
                  name="i-lucide-check"
                  class="size-4 shrink-0 text-primary mt-0.5"
                />
              </button>
              <UTooltip :text="`Open ${o.tag} in a new tab`">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  square
                  icon="i-lucide-external-link"
                  :aria-label="`Open ${o.tag} in a new tab`"
                  class="shrink-0 mt-1 text-muted hover:bg-primary/10 hover:text-primary focus-visible:bg-primary/10 focus-visible:text-primary"
                  @click="openUnit(o.tag)"
                />
              </UTooltip>
            </div>
          </template>

          <p
            v-if="!total"
            class="px-2 py-6 text-sm text-center text-muted"
          >
            No Available unit matches this one yet. Units from the same supplier or purchase order, or with the same model, tech pack or client, show up here. The replacement is optional, so you can leave it empty.
          </p>
          <p
            v-else-if="!shown.length"
            class="px-2 py-6 text-sm text-center text-muted"
          >
            No unit matches "{{ query.trim() }}".
          </p>
        </div>

        <p
          v-if="total"
          class="px-3 py-2 border-t border-default text-xs text-muted shrink-0"
        >
          Ctrl+click (Cmd+click on a Mac) an option, or use its icon, to open the unit in a new tab.
        </p>
      </div>
    </template>
  </UPopover>
</template>
