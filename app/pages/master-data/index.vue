<script setup lang="ts">
// Real card content ported verbatim from the source Master Data landing page
// (assets-test.go.team/app/master-data). Email templates and retrieval forms
// live under the "Templates" nav entry now (they're functionally twins), so
// this page only holds the other master-data reference tables.
definePageMeta({})

useSeoMeta({
  title: 'AMS · Master Data',
  description: 'Values held once and referenced everywhere, so a change is made in one place instead of hunted across templates.'
})

const cards = [
  {
    icon: 'i-lucide-truck',
    title: 'Courier Providers',
    description: 'Corporate account details and the branch directory, held once and never typed into a template.'
  },
  {
    icon: 'i-lucide-shield',
    title: 'Policy Library',
    description: 'Versioned governing policies, so the accountability form serves the current version without a form change.'
  },
  {
    icon: 'i-lucide-contact',
    title: 'Asset Team Contact Block',
    description: 'One held record referenced by every template, form, and generated document.'
  }
]

const toast = useToast()

function openPlannedCard(title: string) {
  toast.add({
    title: `${title} isn't wired up yet`,
    description: 'This card is a placeholder for a planned next iteration.',
    icon: 'i-lucide-hammer',
    color: 'neutral'
  })
}
</script>

<template>
  <div class="bg-gray-50 min-h-screen">
    <div class="sticky top-16 z-10 bg-white px-6 py-6 border-b border-default">
      <h1 class="text-2xl font-semibold text-highlighted">Master Data Configuration</h1>
      <p class="text-sm text-muted max-w-[640px] pt-1">
        Values held once and referenced everywhere, so a change is made in one place instead of hunted across templates.
      </p>
    </div>

    <div class="px-6 py-6">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <NuxtLink
          to="/master-data/offboarding-checklists"
          class="text-left rounded-lg border border-default bg-white p-4 sm:p-6 transition hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/40"
        >
          <div class="flex items-start gap-3">
            <div class="rounded-lg bg-elevated p-3 shrink-0">
              <UIcon name="i-lucide-list-checks" class="size-5 text-primary" />
            </div>
            <div>
              <h3 class="font-semibold text-highlighted">Offboarding Checklists</h3>
              <p class="text-sm text-muted mt-1">The checklist each retrieval ticket is issued at notice: its tasks, which are required, and which reasons and modes start from it.</p>
            </div>
          </div>
        </NuxtLink>
        <button
          v-for="card in cards"
          :key="card.title"
          type="button"
          class="text-left rounded-lg border border-default bg-white p-4 sm:p-6 transition hover:-translate-y-0.5 hover:ring-2 hover:ring-primary/40"
          @click="openPlannedCard(card.title)"
        >
          <div class="flex items-start gap-3">
            <div class="rounded-lg bg-elevated p-3 shrink-0">
              <UIcon :name="card.icon" class="size-5 text-primary" />
            </div>
            <div>
              <h3 class="font-semibold text-highlighted">{{ card.title }}</h3>
              <p class="text-sm text-muted mt-1">{{ card.description }}</p>
            </div>
          </div>
        </button>
      </div>

      <SharedBanner tone="warning" class="mt-6" title="Some values are awaiting Asset Team confirmation">
        <template #body>
          <ul class="list-disc list-inside space-y-1 text-xs text-muted">
            <li>Authoritative Asset Team mobile and landline numbers (two different sets appear across live documents).</li>
            <li>The office barangay, which currently differs between the accountability form body and its own letterhead.</li>
            <li>Version and effective date of the International Asset Movement Policy.</li>
          </ul>
        </template>
      </SharedBanner>
    </div>
  </div>
</template>
