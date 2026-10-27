<script setup lang="ts">
// Placeholder for a route that is slow to load. One layout per kind of page, each with the same header,
// spacing and blocks as the real page, so nothing jumps when the page arrives. It only shows when a
// route takes longer than the delay set in layouts/default.vue; a fast route never shows it.
export type PageSkeletonKind = 'list' | 'create' | 'workspace' | 'editor' | 'doc' | 'hub' | 'checklists'
withDefaults(defineProps<{ kind?: PageSkeletonKind }>(), { kind: 'list' })
</script>

<template>
  <!-- Ticket Tracker and Templates lists: title, description, tabs, one panel with filters and rows -->
  <div v-if="kind === 'list'" class="bg-gray-50 min-h-full" role="status" aria-live="polite" aria-label="Loading page">
    <div class="bg-card px-6 pt-4 pb-3 border-b border-default">
      <div class="flex items-start justify-between gap-5 mb-4">
        <div class="flex flex-col gap-2">
          <SharedSkeleton width="w-56" height="h-8" />
          <SharedSkeleton width="w-80 max-w-full" height="h-4" />
        </div>
        <SharedSkeleton width="w-36" height="h-10" rounded="rounded-md" />
      </div>
      <div class="flex gap-6">
        <SharedSkeleton width="w-24" height="h-5" />
        <SharedSkeleton width="w-24" height="h-5" />
      </div>
    </div>
    <div class="px-6 pt-3 pb-4">
      <div class="rounded-xl border border-default bg-card overflow-hidden">
        <div class="px-6 py-4 flex flex-wrap items-center gap-3">
          <SharedSkeleton width="w-full sm:w-72" height="h-10" />
          <SharedSkeleton width="w-20" height="h-8" rounded="rounded-full" />
          <SharedSkeleton width="w-16" height="h-8" rounded="rounded-full" />
          <SharedSkeleton width="w-16" height="h-8" rounded="rounded-full" />
        </div>
        <div v-for="i in 6" :key="i" class="px-6 py-3.5 border-t border-default flex items-center gap-4">
          <SharedSkeleton width="w-5" height="h-5" />
          <SharedSkeleton width="w-14" height="h-4" />
          <SharedSkeleton width="w-20" height="h-5" rounded="rounded-full" />
          <SharedSkeleton circle width="w-8" height="h-8" />
          <div class="flex flex-col gap-1.5 flex-1">
            <SharedSkeleton width="w-40" height="h-4" />
            <SharedSkeleton width="w-52 max-w-full" height="h-3" />
          </div>
          <SharedSkeleton width="w-24" height="h-4" class="hidden md:block" />
        </div>
      </div>
    </div>
  </div>

  <!-- Create ticket: back button and title, then section cards in a narrow column -->
  <div v-else-if="kind === 'create'" class="bg-gray-50 min-h-full" role="status" aria-live="polite" aria-label="Loading page">
    <div class="bg-card px-6 pt-4 pb-3 border-b border-default flex items-center gap-2">
      <SharedSkeleton width="w-8" height="h-8" />
      <SharedSkeleton width="w-64" height="h-6" />
    </div>
    <div class="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-6">
      <div v-for="i in 4" :key="i" class="rounded-lg border border-default bg-card px-5 py-5 flex flex-col gap-4">
        <SharedSkeleton width="w-32" height="h-5" />
        <SharedSkeleton width="w-28" height="h-3" />
        <SharedSkeleton height="h-10" />
        <SharedSkeleton v-if="i === 2" width="w-28" height="h-3" />
        <SharedSkeleton v-if="i === 2" height="h-10" />
      </div>
    </div>
  </div>

  <!-- Ticket workspace: header, stepper, step card and the right rail -->
  <div v-else-if="kind === 'workspace'" class="bg-gray-50 min-h-full" role="status" aria-live="polite" aria-label="Loading ticket">
    <div class="bg-card border-b border-default px-4 sm:px-8 py-5 flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <SharedSkeleton width="w-8" height="h-8" circle />
        <SharedSkeleton width="w-24" height="h-7" />
        <SharedSkeleton width="w-14" height="h-5" />
        <SharedSkeleton width="w-28" height="h-9" class="ml-auto" />
      </div>
      <SharedSkeleton width="w-2/3 max-w-md" height="h-4" />
      <div class="flex items-start justify-between gap-2">
        <div v-for="i in 6" :key="i" class="flex flex-col items-center gap-2 flex-1">
          <SharedSkeleton circle width="w-8" height="h-8" />
          <SharedSkeleton width="w-14" height="h-3" />
        </div>
      </div>
    </div>
    <div class="px-4 sm:px-8 py-5 flex flex-col lg:flex-row gap-5 items-start">
      <div class="w-full flex-1 min-w-0 rounded-lg border border-default bg-card p-6 flex flex-col gap-4">
        <SharedSkeleton width="w-1/3" height="h-5" />
        <SharedSkeleton :lines="3" />
        <SharedSkeleton width="w-40" height="h-9" />
      </div>
      <div class="w-full lg:w-[300px] rounded-lg border border-default bg-card p-4 flex flex-col gap-3">
        <SharedSkeleton width="w-1/2" height="h-4" />
        <SharedSkeleton :lines="4" />
      </div>
    </div>
  </div>

  <!-- Email template editor: back button, name, tabs, then the editor card and the sample preview -->
  <div v-else-if="kind === 'editor'" class="bg-gray-50 min-h-full" role="status" aria-live="polite" aria-label="Loading template">
    <div class="bg-card px-6 pt-4 pb-3 border-b border-default flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <SharedSkeleton width="w-8" height="h-8" />
        <SharedSkeleton width="w-48" height="h-6" />
        <SharedSkeleton width="w-14" height="h-5" rounded="rounded-full" class="ml-auto" />
        <SharedSkeleton width="w-20" height="h-9" />
      </div>
      <SharedSkeleton width="w-80 max-w-full" height="h-4" />
      <div class="flex gap-6">
        <SharedSkeleton width="w-16" height="h-5" />
        <SharedSkeleton width="w-16" height="h-5" />
      </div>
    </div>
    <div class="px-6 py-6 flex flex-col lg:flex-row gap-[10px]">
      <div class="flex-1 rounded-lg border border-default bg-card px-6 pt-4 pb-6 flex flex-col gap-4">
        <SharedSkeleton width="w-24" height="h-3" />
        <SharedSkeleton height="h-11" />
        <SharedSkeleton width="w-16" height="h-3" />
        <SharedSkeleton height="h-10" />
        <SharedSkeleton :lines="6" />
      </div>
      <div class="lg:w-[min(460px,40%)] rounded-lg border border-default bg-card p-5 flex flex-col gap-3">
        <SharedSkeleton width="w-28" height="h-3" />
        <SharedSkeleton :lines="5" />
      </div>
    </div>
  </div>

  <!-- Form editor: header, toolbar and a page on the canvas -->
  <div v-else-if="kind === 'doc'" class="bg-gray-50 min-h-full" role="status" aria-live="polite" aria-label="Loading form">
    <div class="bg-card px-6 pt-4 pb-3 border-b border-default flex items-center gap-2">
      <SharedSkeleton width="w-8" height="h-8" />
      <SharedSkeleton width="w-64" height="h-6" />
      <SharedSkeleton width="w-20" height="h-9" class="ml-auto" />
    </div>
    <div class="bg-card px-6 py-2 border-b border-default flex gap-2">
      <SharedSkeleton v-for="i in 8" :key="i" width="w-7" height="h-7" />
    </div>
    <div class="flex justify-center py-8 px-4" style="background: var(--ams-canvas)">
      <div class="ams-doc-skeleton w-full max-w-[816px] flex flex-col gap-4 px-[72px] py-[72px] min-h-[520px]">
        <SharedSkeleton width="w-20" height="h-6" />
        <SharedSkeleton width="w-2/3" height="h-3" />
        <SharedSkeleton width="w-1/2" height="h-6" class="mt-8" />
        <SharedSkeleton :lines="3" height="h-4" />
        <SharedSkeleton height="h-8" />
        <SharedSkeleton height="h-8" />
      </div>
    </div>
  </div>

  <!-- Master data hub: title, description and three cards -->
  <div v-else-if="kind === 'hub'" class="bg-gray-50 min-h-full" role="status" aria-live="polite" aria-label="Loading page">
    <div class="bg-card px-6 py-6 border-b border-default flex flex-col gap-2">
      <SharedSkeleton width="w-72" height="h-8" />
      <SharedSkeleton width="w-[28rem] max-w-full" height="h-4" />
    </div>
    <div class="px-6 py-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <div v-for="i in 3" :key="i" class="rounded-lg border border-default bg-card p-4 sm:p-6 flex items-start gap-3">
        <SharedSkeleton width="w-11" height="h-11" rounded="rounded-lg" />
        <div class="flex flex-col gap-2 flex-1">
          <SharedSkeleton width="w-40" height="h-4" />
          <SharedSkeleton :lines="2" height="h-3" />
        </div>
      </div>
    </div>
  </div>

  <!-- Offboarding checklists: back button and title, template list and the editor -->
  <div v-else class="bg-gray-50 min-h-full" role="status" aria-live="polite" aria-label="Loading page">
    <div class="bg-card px-6 pt-4 pb-3 border-b border-default flex flex-col gap-2">
      <div class="flex items-center gap-2">
        <SharedSkeleton width="w-8" height="h-8" />
        <SharedSkeleton width="w-56" height="h-6" />
      </div>
      <SharedSkeleton width="w-[32rem] max-w-full" height="h-4" class="ml-[34px]" />
    </div>
    <div class="px-6 py-6 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
      <div class="rounded-lg border border-default bg-card">
        <div class="px-4 py-3 border-b border-default flex items-center justify-between">
          <SharedSkeleton width="w-24" height="h-4" />
          <SharedSkeleton width="w-14" height="h-6" />
        </div>
        <div class="p-4 flex flex-col gap-2">
          <SharedSkeleton width="w-40" height="h-4" />
          <SharedSkeleton width="w-20" height="h-3" />
        </div>
      </div>
      <div class="rounded-lg border border-default bg-card">
        <div class="px-4 py-3 border-b border-default flex items-center justify-between">
          <SharedSkeleton width="w-28" height="h-4" />
          <SharedSkeleton width="w-40" height="h-7" />
        </div>
        <div class="p-5 flex flex-col gap-4">
          <SharedSkeleton width="w-12" height="h-3" />
          <SharedSkeleton width="w-72 max-w-full" height="h-10" />
          <SharedSkeleton v-for="i in 4" :key="i" height="h-10" />
        </div>
      </div>
    </div>
  </div>
</template>
