<script setup lang="ts">
// Light, Dark or System. System is the default. The choice is remembered by
// Nuxt UI's color mode (localStorage key `ams:color-mode`, see nuxt.config.ts).
const colorMode = useColorMode()

const OPTIONS = [
  { value: 'system', label: 'System', icon: 'i-lucide-monitor' },
  { value: 'light', label: 'Light', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon' }
] as const

const items = computed(() => [OPTIONS.map(o => ({
  label: o.label,
  icon: o.icon,
  type: 'checkbox' as const,
  checked: colorMode.preference === o.value,
  onSelect: (e: Event) => {
    e.preventDefault()
    colorMode.preference = o.value
  }
}))])

const current = computed(() => OPTIONS.find(o => o.value === colorMode.preference) ?? OPTIONS[0])
const triggerIcon = computed(() => (colorMode.value === 'dark' ? 'i-lucide-moon' : 'i-lucide-sun'))
</script>

<template>
  <ClientOnly>
    <UDropdownMenu
      :items="items"
      :content="{ align: 'end' }"
      :ui="{ content: 'w-40' }"
    >
      <UTooltip :text="`Theme: ${current.label}`">
        <UButton
          :icon="triggerIcon"
          color="neutral"
          variant="ghost"
          size="sm"
          square
          :aria-label="`Color theme, currently ${current.label}`"
        />
      </UTooltip>
    </UDropdownMenu>
    <template #fallback>
      <UButton
        icon="i-lucide-sun"
        color="neutral"
        variant="ghost"
        size="sm"
        square
        aria-label="Color theme"
      />
    </template>
  </ClientOnly>
</template>
