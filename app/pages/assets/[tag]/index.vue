<script setup lang="ts">
// The live asset page opens on its first tab, so the bare detail URL lands on the Activity Feed.
definePageMeta({ layout: 'assets', redirect: to => `/assets/${String(to.params.tag)}/activity-feed` })
</script>

<template>
  <div />
</template>
