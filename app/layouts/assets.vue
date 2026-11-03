<script setup lang="ts">
// Shell for the Assets exit-status screens. Reuses the system components the rest of the
// prototype uses (EmailAmsSidebar, EmailTopNavbar), the same shell the ticket tracker and
// templates pages run on, so the Assets pages read as one app with them. The only
// feature-specific piece is the AssetsSimulatorBar (state, role, scenario), which sits at the
// very top as a real layout row the same way SharedSimulatorBar does in the retrieval layout.
const sidebarOpen = ref(true)
</script>

<template>
  <div class="assets-shell antialiased flex flex-col h-dvh overflow-hidden bg-default">
    <SharedSkipLink />
    <AssetsSimulatorBar />
    <div class="flex flex-1 min-h-0">
      <EmailAmsSidebar
        v-if="sidebarOpen"
        class="!h-full"
      />
      <div class="flex flex-col flex-1 min-w-0 min-h-0">
        <EmailTopNavbar v-model:sidebar-open="sidebarOpen" />
        <UMain
          id="main-content"
          tabindex="-1"
          class="flex-1 min-w-0 min-h-0 !min-h-0 focus:outline-none"
        >
          <slot />
        </UMain>
      </div>
    </div>
  </div>
</template>

<style>
/* Tailwind 4 leaves buttons on the default cursor. Everything clickable in the Assets screens shows a pointer,
   and links are never underlined. */
.assets-shell #main-content :is(a, button, [role='button'], summary, label[for], select):not(:disabled):not([aria-disabled='true']) { cursor: pointer; }
.assets-shell #main-content a, .assets-shell #main-content a:hover, .assets-shell #main-content button { text-decoration: none; }
</style>
