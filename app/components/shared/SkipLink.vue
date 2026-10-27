<script setup lang="ts">
// First tab stop on every shell page. Jumps past the sidebar and header to the
// page content (the <main> carries id="main-content" in each layout).
function skipToContent() {
  const main = document.getElementById('main-content')
  main?.focus()
  main?.scrollIntoView()
}
</script>

<template>
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-blue-700 focus:shadow-lg focus:ring-2 focus:ring-primary"
    @click.prevent="skipToContent"
  >
    Skip to content
  </a>
</template>
