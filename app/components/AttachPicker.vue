<script setup lang="ts">
// The empty-state counterpart to EmailAttachSection's chip - a dashed-border
// dropdown button (matching the Templates email editor's own "Attach a
// form" pattern) so there's always a way to attach something, including
// after an operator uses that chip's own "Remove attachment" action.
interface Option {
  id: string
  name: string
}

interface Props {
  label: string
  options: Option[]
  icon?: string
}

const props = withDefaults(defineProps<Props>(), { icon: 'i-lucide-paperclip' })

const emit = defineEmits<{
  select: [id: string]
}>()

function preventCloseAutoFocus(e: Event) {
  e.preventDefault()
}
</script>

<template>
  <UDropdownMenu
    :items="[options.map(o => ({ label: o.name, icon: 'i-lucide-file-text', onSelect: () => emit('select', o.id) }))]"
    :filter="options.length > 5"
    :ui="{ content: 'w-72 max-h-[220px] overflow-y-auto fade-scroll-y' }"
    :content="{ align: 'start', onCloseAutoFocus: preventCloseAutoFocus }"
  >
    <button
      type="button"
      class="flex items-center gap-2 rounded-lg border border-dashed border-accented px-4 py-2.5 text-sm font-medium text-muted hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors w-full"
    >
      <UIcon :name="icon" class="size-4" />
      {{ label }}
      <UIcon name="i-lucide-chevron-down" class="size-4 ml-auto" />
    </button>
  </UDropdownMenu>
</template>
