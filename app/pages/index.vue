<script setup lang="ts">
// The root used to be the single Email Templates editor page (drawer-based
// browsing). Email and Forms now live under /templates as list-cards pages,
// so root just forwards there.
await navigateTo('/templates', { replace: true })
</script>

<template>
  <div />
</template>
