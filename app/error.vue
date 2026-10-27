<script setup lang="ts">
// Shown by Nuxt when a page fails to render or a route cannot be resolved.
// A 404 gets plain wording; anything else offers "Try again" (clears the
// error and reloads the same route) next to a way back to the Ticket Tracker.
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const notFound = computed(() => props.error.statusCode === 404)
const title = computed(() => notFound.value ? 'We can\'t find that page' : 'Something went wrong')
const body = computed(() => notFound.value
  ? 'The link may be wrong or the page may have moved.'
  : 'This page could not be shown. Try again, or go back to the Ticket Tracker. Your saved tickets are not affected.')

useSeoMeta({ title: () => `AMS · ${title.value}` })

function retry() {
  clearError({ redirect: useRoute().fullPath })
}
function goBack() {
  clearError({ redirect: '/ticket-tracker' })
}
</script>

<template>
  <UApp>
    <main class="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div class="max-w-sm w-full text-center flex flex-col items-center gap-3" role="alert">
        <UIcon :name="notFound ? 'i-lucide-file-question' : 'i-lucide-triangle-alert'" class="size-8 text-muted" aria-hidden="true" />
        <h1 class="text-base font-semibold text-highlighted">{{ title }}</h1>
        <p class="text-sm text-muted">{{ body }}</p>
        <div class="flex flex-wrap justify-center gap-2 mt-2">
          <UButton v-if="!notFound" color="primary" icon="i-lucide-rotate-ccw" @click="retry">Try again</UButton>
          <UButton :color="notFound ? 'primary' : 'neutral'" :variant="notFound ? 'solid' : 'outline'" @click="goBack">Back to Ticket Tracker</UButton>
        </div>
      </div>
    </main>
  </UApp>
</template>
