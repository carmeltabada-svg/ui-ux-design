<script setup lang="ts">
const sidebarOpen = ref(true)
</script>

<template>
  <div class="flex flex-col min-h-screen bg-default">
    <!-- Prototype simulator bar: a real top row that pushes the app down. Scaffolding, not product. -->
    <SharedSimulatorBar />
    <div class="flex flex-1 min-h-0">
      <EmailAmsSidebar v-if="sidebarOpen" />

      <div class="flex flex-col flex-1 min-w-0">
        <EmailTopNavbar v-model:sidebar-open="sidebarOpen" />

        <UMain class="flex-1 min-w-0">
          <slot />
        </UMain>
      </div>
    </div>
  </div>
</template>
