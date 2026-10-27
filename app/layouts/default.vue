<script setup lang="ts">
import type { PageSkeletonKind } from '~/components/shared/PageSkeleton.vue'

const sidebarOpen = ref(true)

// A route that takes longer than 150 ms to load shows a page skeleton over the content area, so the
// old page does not just sit there. Faster routes never flash it.
const { isLoading } = useLoadingIndicator()
const showSkeleton = ref(false)
let skeletonTimer: ReturnType<typeof setTimeout> | undefined
watch(isLoading, (loading) => {
  clearTimeout(skeletonTimer)
  if (loading) skeletonTimer = setTimeout(() => { showSkeleton.value = true }, 150)
  else showSkeleton.value = false
})
// The skeleton matches the page being opened, so it is chosen from the target route.
const router = useRouter()
const targetPath = ref('')
const removeGuard = router.beforeEach((to) => { targetPath.value = to.path })
onBeforeUnmount(() => { clearTimeout(skeletonTimer); removeGuard() })
const skeletonKind = computed<PageSkeletonKind>(() => {
  const p = targetPath.value
  if (p === '/ticket-tracker/create') return 'create'
  if (p.startsWith('/ticket-tracker/')) return 'workspace'
  if (p.startsWith('/templates/email/')) return 'editor'
  if (p.startsWith('/templates/forms/')) return 'doc'
  if (p === '/master-data') return 'hub'
  if (p.startsWith('/master-data/')) return 'checklists'
  return 'list'
})
</script>

<template>
  <div class="flex flex-col min-h-screen bg-default">
    <SharedSkipLink />
    <SharedSimulatorBar />
    <div class="flex flex-1 min-h-0">
      <EmailAmsSidebar v-if="sidebarOpen" />

      <div class="flex flex-col flex-1 min-w-0">
        <EmailTopNavbar v-model:sidebar-open="sidebarOpen" />

        <!-- Positioned, so the loading skeleton fills exactly the content area under the navbar -->
        <div class="relative flex-1 min-w-0 flex flex-col">
          <UMain id="main-content" tabindex="-1" class="flex-1 min-w-0 focus:outline-none">
            <slot />
          </UMain>
          <div v-if="showSkeleton" class="absolute inset-0 z-10 overflow-hidden bg-default">
            <SharedPageSkeleton :kind="skeletonKind" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
