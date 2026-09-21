<script setup lang="ts">
// Same swatch-popover pattern as the Tiptap body editor's text-color picker
// (BlockToolbar.vue) - applied here to a form's (or a single section's) accent
// color instead of a text selection, so created forms read as themed/branded
// rather than generic, the way real form builders (Google Forms, Typeform) do.
import { THEME_COLOR_SWATCHES } from '~/data/retrievalForms'

interface Props {
  /** icon-only trigger for inline use (e.g. inside a colored section header bar) */
  compact?: boolean
  label?: string
}

withDefaults(defineProps<Props>(), {
  compact: false,
  label: 'Color'
})

const color = defineModel<string>({ default: '#386BE6' })
</script>

<template>
  <UPopover>
    <UTooltip :text="compact ? 'Section color' : 'Form color'">
      <UButton
        v-if="compact"
        color="neutral"
        variant="ghost"
        size="xs"
        square
        class="text-white/80 hover:text-white hover:bg-white/15"
      >
        <span class="size-3.5 rounded-full ring-1 ring-white/60" :style="{ background: color }" />
      </UButton>
      <UButton v-else color="neutral" variant="outline" size="md">
        <span class="size-4 rounded-full ring-1 ring-default shrink-0" :style="{ background: color }" />
        <span class="text-sm">{{ label }}</span>
      </UButton>
    </UTooltip>
    <template #content>
      <div class="p-3 w-56">
        <div class="grid grid-cols-8 gap-1.5 mb-3">
          <button
            v-for="c in THEME_COLOR_SWATCHES"
            :key="c"
            type="button"
            class="size-6 rounded-full ring-1 ring-default transition-transform hover:scale-110"
            :class="c === color && 'ring-2 ring-offset-1 ring-primary'"
            :style="{ background: c }"
            :aria-label="`Set color ${c}`"
            @click="color = c"
          />
        </div>
        <UColorPicker v-model="color" format="hex" class="w-full" />
      </div>
    </template>
  </UPopover>
</template>
