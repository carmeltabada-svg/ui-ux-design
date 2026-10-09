<script setup lang="ts">
const sidebarOpen = ref(true)
</script>

<template>
  <div class="flex flex-col min-h-screen bg-default">
    <SharedSkipLink />
    <SharedSimulatorBar />
    <div class="flex flex-1 min-h-0">
      <EmailAmsSidebar v-if="sidebarOpen" />

      <div class="flex flex-col flex-1 min-w-0">
        <EmailTopNavbar v-model:sidebar-open="sidebarOpen" />

        <UMain id="main-content" tabindex="-1" class="flex-1 min-w-0 focus:outline-none">
          <slot />
        </UMain>
      </div>
    </div>
  </div>
</template>
