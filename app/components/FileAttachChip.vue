<script setup lang="ts">
// Same pill shape/colors as the Templates email editor's own AttachSection
// chip (email/AttachSection.vue) - reused here for a raw uploaded file
// (gate evidence, A10 proof/condition) rather than an attached form/template
// reference. AttachSection's own "Replace" lives inside an overflow menu
// because it picks from a list of other existing forms - there's no such
// list for a freshly uploaded file, so Replace/Remove are plain, always-
// visible icon buttons here instead of being buried in a "..." menu.
interface Props {
  name: string
  subtitle?: string
  icon?: string
  previewTooltip?: string
  /** Hides Replace/Remove, leaving only Preview - see AttachSection.vue's own readOnly prop for why. */
  readOnly?: boolean
}
withDefaults(defineProps<Props>(), { subtitle: '', icon: 'i-lucide-file-text', previewTooltip: 'Open file', readOnly: false })

defineEmits<{
  preview: []
  replace: []
  remove: []
}>()
</script>

<template>
  <div class="flex items-center w-full">
    <div
      class="flex items-center justify-between gap-2.5 rounded-full py-2.5 pr-2.5 pl-3.5 w-full"
      style="background: var(--ams-attach-bg); border: 1px solid var(--ams-attach-border);"
    >
      <div class="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          class="flex items-center justify-center shrink-0 rounded-full bg-card"
          style="width: 34px; height: 34px; color: var(--ams-attach-icon);"
        >
          <UIcon :name="icon" class="size-[18px]" />
        </div>
        <div class="flex flex-col leading-tight min-w-0">
          <div class="text-sm font-semibold text-default truncate">{{ name }}</div>
          <div v-if="subtitle" class="text-xs text-muted truncate">{{ subtitle }}</div>
        </div>
      </div>
      <div class="flex items-center shrink-0">
        <UTooltip :text="previewTooltip">
          <UButton color="primary" variant="ghost" size="sm" square icon="i-lucide-eye" :aria-label="previewTooltip" class="rounded-md" @click="$emit('preview')" />
        </UTooltip>
        <template v-if="!readOnly">
          <UTooltip text="Replace">
            <UButton color="primary" variant="ghost" size="sm" square icon="i-lucide-repeat" aria-label="Replace" class="rounded-md" @click="$emit('replace')" />
          </UTooltip>
          <UTooltip text="Remove">
            <UButton color="error" variant="ghost" size="sm" square icon="i-lucide-x" aria-label="Remove" class="rounded-md" @click="$emit('remove')" />
          </UTooltip>
        </template>
      </div>
    </div>
  </div>
</template>
