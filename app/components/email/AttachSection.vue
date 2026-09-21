<script setup lang="ts">
interface FormOption {
  id: string
  name: string
}

interface Props {
  name: string
  subtitle: string
  /** active forms the user can switch to, for the "Replace" quick-picker */
  formOptions?: FormOption[]
  /** the form currently attached, so the Replace submenu can mark it */
  currentFormId?: string
  /** defaults to the form icon - pass e.g. 'i-lucide-mail' when this chip represents an email template instead of a form attachment */
  icon?: string
  /** label for the "Replace" menu action and its submenu, e.g. "Replace form" vs "Replace email" */
  replaceLabel?: string
  /** tooltip on the preview action - differs by what "preview" does (a form opens in a new tab, an email opens in a modal) */
  previewTooltip?: string
  /** icon on the preview action - defaults to the "opens in a new tab" glyph; pass 'i-lucide-eye' when preview opens in a modal instead */
  previewIcon?: string
}

const props = withDefaults(defineProps<Props>(), { formOptions: () => [], icon: 'i-lucide-file-text', replaceLabel: 'Replace form', previewTooltip: 'Preview form in new tab', previewIcon: 'i-lucide-external-link' })

const emit = defineEmits<{
  preview: []
  edit: []
  replace: [formId: string]
  remove: []
}>()

// Reka's menu returns focus to whatever trigger opened it once an item is
// picked - normally invisible, but this trigger sits inside a chip near the
// top of a scrolled page, so that focus-restore was dragging the whole page
// (header, sidebar, everything) back to the top after every replace. The
// menu already finished its job once an item is selected, so there's
// nothing worth focus-restoring back to.
function preventCloseAutoFocus(e: Event) {
  e.preventDefault()
}

// A picker with only a couple of options doesn't need its own search box;
// one long enough to need scrolling does.
const showFormFilter = computed(() => props.formOptions.length > 5)

const overflowMenuItems = computed(() => [[
  {
    label: props.replaceLabel,
    icon: 'i-lucide-repeat',
    children: props.formOptions.map(form => ({
      label: form.name,
      icon: 'i-lucide-file-text',
      type: 'checkbox' as const,
      checked: form.id === props.currentFormId,
      ui: form.id === props.currentFormId ? { itemLabel: 'text-primary font-medium', itemLeadingIcon: 'text-primary', itemTrailingIcon: 'text-primary' } : undefined,
      onSelect: () => emit('replace', form.id)
    })),
    // Truncation belongs to the form-name list above, which can genuinely
    // run long - not to this action's own short, fixed label. The submenu
    // itself (not the 2-item top-level menu) is the one that can get long
    // enough to need its own search box and a capped, scrollable height -
    // and the one whose focus-restore-on-close was dragging the whole page
    // back to the top, so that gets neutralized here too.
    ui: { itemLabel: 'overflow-visible text-clip whitespace-nowrap', content: 'ml-1 w-72 max-h-[220px] overflow-y-auto fade-scroll-y' },
    filter: showFormFilter.value,
    content: { align: 'start', onCloseAutoFocus: preventCloseAutoFocus }
  },
  { label: 'Remove attachment', icon: 'i-lucide-x', color: 'error' as const, onSelect: () => emit('remove') }
]])
</script>

<template>
  <div class="flex items-center w-full">
    <div
      class="flex items-center justify-between gap-2.5 rounded-full py-2.5 pr-2.5 pl-3.5 w-full"
      style="background: rgb(239,246,255); border: 1px solid #D3E6FF;"
    >
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          class="flex items-center justify-center shrink-0 rounded-full bg-white"
          style="width: 34px; height: 34px; color: rgb(56,107,230);"
        >
          <UIcon :name="icon" class="size-[18px]" />
        </div>
        <div class="flex flex-col leading-tight min-w-0">
          <div class="text-sm font-semibold text-default truncate">{{ name }}</div>
          <div class="text-xs text-muted truncate">{{ subtitle }}</div>
        </div>
      </div>
      <div class="flex items-center shrink-0">
        <UTooltip :text="previewTooltip">
          <UButton
            color="primary"
            variant="ghost"
            size="sm"
            square
            :icon="previewIcon"
            :aria-label="previewTooltip"
            class="rounded-md"
            @click="$emit('preview')"
          />
        </UTooltip>
        <UTooltip text="Edit">
          <UButton
            color="primary"
            variant="ghost"
            size="sm"
            square
            icon="i-lucide-pencil"
            aria-label="Edit"
            class="rounded-md"
            @click="$emit('edit')"
          />
        </UTooltip>
        <UDropdownMenu :items="overflowMenuItems" :ui="{ content: 'w-52' }" :content="{ align: 'start' }">
          <UTooltip text="More options">
            <UButton
              color="primary"
              variant="ghost"
              size="sm"
              square
              icon="i-lucide-more-horizontal"
              aria-label="More options"
              class="rounded-md"
            />
          </UTooltip>
        </UDropdownMenu>
      </div>
    </div>
  </div>
</template>
