<script setup lang="ts">
// Ported from the real top navbar/breadcrumb bar in the source production page
// ("Dashboard - GoTeam Assets.html"): hamburger (mobile) + collapse-sidebar
// button, a breadcrumb nav (Home > current page), and a right-side dark-mode
// toggle + "Open Internal Dashboard" external link, verbatim from source
// (https://r24.go.team/).
interface Props {
  sidebarOpen?: boolean
}

withDefaults(defineProps<Props>(), {
  sidebarOpen: true
})

defineEmits<{
  'update:sidebarOpen': [value: boolean]
  'toggle-mobile-menu': []
}>()

const route = useRoute()
const breadcrumbItems = computed(() => [
  { label: 'Home', icon: 'i-lucide-home', to: '/' },
  route.path.startsWith('/master-data')
    ? { label: 'Master Data', icon: 'i-lucide-database' }
    : { label: 'Templates', icon: 'i-lucide-mail' }
])

const toast = useToast()

function notifyDarkModeUnavailable() {
  toast.add({
    title: 'Dark mode isn\'t available',
    description: 'This app is light-mode only.',
    icon: 'i-lucide-moon',
    color: 'neutral'
  })
}
</script>

<template>
  <div class="sticky top-0 z-20 h-16 flex items-center justify-between px-4 border-b border-default bg-white shrink-0">
    <div class="flex items-center gap-3 overflow-hidden flex-1">
      <UButton
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        size="sm"
        class="lg:hidden shrink-0"
        aria-label="Toggle Menu"
        @click="$emit('toggle-mobile-menu')"
      />
      <UButton
        :icon="sidebarOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
        color="neutral"
        variant="ghost"
        size="sm"
        class="hidden lg:flex shrink-0"
        :aria-label="sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'"
        @click="$emit('update:sidebarOpen', !sidebarOpen)"
      />
      <UBreadcrumb
        :items="breadcrumbItems"
        class="hidden sm:flex min-w-0"
        :ui="{
          link: 'text-sm font-medium text-muted hover:text-default transition-colors',
          linkLeadingIcon: 'text-muted',
        }"
      >
        <template #item="{ item, index }">
          <span
            class="flex items-center gap-1.5 text-sm min-w-0"
            :class="index === breadcrumbItems.length - 1 ? 'text-primary font-semibold' : 'text-muted font-medium hover:text-default transition-colors'"
          >
            <UIcon :name="item.icon" class="size-4 shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </span>
        </template>
      </UBreadcrumb>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <UButton
        icon="i-lucide-sun"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="Switch to Dark Mode"
        @click="notifyDarkModeUnavailable"
      />
      <UButton
        icon="i-lucide-external-link"
        color="neutral"
        variant="ghost"
        size="sm"
        to="https://r24.go.team/"
        target="_blank"
        aria-label="Open Internal Dashboard"
      />
    </div>
  </div>
</template>
