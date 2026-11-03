<script setup lang="ts">
// The menu behind every "Move asset" button. The kind of move is chosen here, before the form opens, the same way the
// ticket tracker's Create Ticket menu asks for the ticket type first, so the form that opens never changes shape.
// A kind that doesn't apply to the unit (a Client Pull-Out on a Monthly Rental) looks off but can still be pointed at
// and clicked: hovering shows the reason in a tooltip, and clicking it raises a toast with the same reason.
import { moveKindOptions, type Asset, type MoveKind } from '~/data/assets'

const props = defineProps<{ asset?: Pick<Asset, 'techPack'> }>()
const emit = defineEmits<{ select: [kind: MoveKind] }>()
const toast = useToast()

const items = computed(() => [moveKindOptions(props.asset).map(o => o.disabled
  ? {
      label: o.label,
      icon: o.icon,
      description: o.description,
      reason: o.reason,
      slot: 'blocked' as const,
      onSelect: () => toast.add({ title: `${o.label} isn't available for this unit`, description: o.reason, icon: 'i-lucide-info', color: 'info' })
    }
  : {
      label: o.label,
      icon: o.icon,
      description: o.description,
      onSelect: () => emit('select', o.kind)
    })])
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: 'end' }"
    :ui="{ content: 'w-80', itemLabel: 'whitespace-normal', itemDescription: 'whitespace-normal' }"
  >
    <slot />
    <template #blocked="{ item }">
      <UTooltip
        :text="(item as { reason?: string }).reason"
        :content="{ side: 'left' }"
        :ui="{ content: 'h-auto max-w-72 px-3 py-2', text: 'whitespace-normal break-words leading-snug' }"
      >
        <span class="flex items-start gap-1.5 w-full opacity-50 cursor-not-allowed">
          <UIcon
            :name="String(item.icon)"
            class="size-5 shrink-0 text-dimmed"
            aria-hidden="true"
          />
          <span class="flex flex-col text-left min-w-0">
            <span class="text-sm font-medium text-default">{{ item.label }}</span>
            <span class="text-xs text-muted">{{ item.description }}</span>
          </span>
        </span>
      </UTooltip>
    </template>
  </UDropdownMenu>
</template>
