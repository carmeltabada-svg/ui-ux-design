<script setup lang="ts">
const sidebarOpen = ref(true)
</script>

<template>
  <div class="flex min-h-screen bg-default">
    <EmailAmsSidebar v-if="sidebarOpen" />

    <div class="flex flex-col flex-1 min-w-0">
      <EmailTopNavbar v-model:sidebar-open="sidebarOpen" />

      <UMain class="flex-1 min-w-0">
        <slot />
      </UMain>
    </div>
  </div>
</template>
