<script setup lang="ts">
// Google Forms, Typeform, JotForm, and Notion's block editor all keep a
// field/block's controls inside its own content area rather than the page
// margin, but they don't hide the ones people reach for constantly (drag to
// reorder, duplicate, delete) behind an extra menu tap - only the rarer
// stuff goes into an overflow. Reordering itself is drag-and-drop via a
// handle in all of them, not a pair of up/down buttons.
//
// This follows that split: a grip on the left (native HTML5 drag-and-drop
// for a mouse/trackpad - dragging just this small handle, not the whole
// row, so clicking into the row's own text still just clicks it) that also
// opens a tiny Move up/down menu on tap, since HTML5 drag doesn't fire from
// touch input at all - a mobile user needs a real alternative, not a
// desktop-only affordance with nothing standing in for it. Duplicate and
// remove sit as their own buttons on the right. All of it is hover-revealed
// (a field row you're not touching should read clean), and the grip sits
// flush at the row's true left edge, not inset into the label's own text.
interface Props {
  canMoveUp?: boolean
  canMoveDown?: boolean
  /** omit to render both groups (rows whose content is one full-width
   * cell) - the two-column Q&A row instead splits them: the grip goes in
   * the label cell (the row's true left edge), duplicate/remove in the
   * value cell's own corner. */
  only?: 'grip' | 'actions'
}

defineProps<Props>()
const emit = defineEmits<{
  'move-up': []
  'move-down': []
  duplicate: []
  remove: []
}>()
</script>

<template>
  <div v-if="only !== 'actions'" class="absolute left-0 top-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity" @click.stop>
    <UDropdownMenu
      :items="[[
        { label: 'Move up', icon: 'i-lucide-arrow-up', disabled: !canMoveUp, onSelect: () => emit('move-up') },
        { label: 'Move down', icon: 'i-lucide-arrow-down', disabled: !canMoveDown, onSelect: () => emit('move-down') }
      ]]"
      :content="{ align: 'start' }"
      :ui="{ content: 'w-40' }"
    >
      <UTooltip text="Drag to reorder, or tap for move up/down">
        <button
          type="button"
          draggable="true"
          aria-label="Reorder field"
          class="flex items-center justify-center size-6 rounded-md text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F3F4F6] cursor-grab active:cursor-grabbing"
        >
          <UIcon name="i-lucide-grip-vertical" class="size-4" />
        </button>
      </UTooltip>
    </UDropdownMenu>
  </div>
  <div v-if="only !== 'grip'" class="absolute right-1 top-1 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
    <UTooltip text="Duplicate field">
      <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-copy" aria-label="Duplicate field" class="text-muted hover:text-default size-6 p-0" @click.stop="emit('duplicate')" />
    </UTooltip>
    <UTooltip text="Remove field">
      <UButton color="neutral" variant="ghost" size="xs" square icon="i-lucide-trash-2" aria-label="Remove field" class="text-muted hover:text-error size-6 p-0" @click.stop="emit('remove')" />
    </UTooltip>
  </div>
</template>
