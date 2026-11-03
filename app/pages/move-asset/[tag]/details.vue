<script setup lang="ts">
// Move details moved into a drawer over the asset page. An old link to this page forwards there.
definePageMeta({ layout: 'assets' })
const route = useRoute()
await navigateTo(`/assets/${encodeURIComponent(String(route.params.tag ?? ''))}?moveDetails=1`, { replace: true })
</script>

<template>
  <div />
</template>
