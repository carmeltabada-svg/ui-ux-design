<script setup lang="ts">
// Photos tab (live: assets/[assetId]/photos.vue). Unchanged by this task; the design shows its empty state.
</script>

<template>
  <div class="stage-enter">
    <div class="mb-4">
      <h2 class="text-lg font-semibold text-highlighted">
        Photos
      </h2>
      <p class="text-sm text-muted mt-1">
        Photos taken of this asset.
      </p>
    </div>
    <div class="flex flex-col items-center text-center gap-2 py-16 text-muted rounded-lg border border-dashed border-default bg-card">
      <UIcon
        name="i-lucide-camera"
        class="size-6"
        aria-hidden="true"
      />
      <p class="text-sm font-medium text-default">
        No photos uploaded yet.
      </p>
    </div>
  </div>
</template>
