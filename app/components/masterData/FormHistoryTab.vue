<script setup lang="ts">
// Same anatomy as the email template's HistoryTab.vue - a current-version-
// first list of cards (icon chip, title + badges, a muted byline, hover-
// reveal actions), applied to forms instead of email templates, so the two
// read as the same kind of list rather than two different components.
interface HistoryEntry {
  id: string
  label: string
  actor: string
  date: string
}

interface Props {
  entries: HistoryEntry[]
  retired?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  retired: false
})

defineEmits<{
  view: [HistoryEntry]
  restore: [HistoryEntry]
}>()

const expanded = ref<string>()

function toggle(id: string) {
  expanded.value = expanded.value === id ? undefined : id
}
</script>

<template>
  <div>
    <!-- No title/description here - the host slideover's own #header already
         shows the form's exact name and description (see edit.vue), so this
         body is only ever the version entries themselves. -->
    <div v-if="!entries.length" class="flex flex-col items-center text-center gap-2 py-16 text-muted">
      <UIcon name="i-lucide-history" class="size-6" />
      <div class="text-sm font-medium text-default">No changes saved yet</div>
      <div class="text-xs max-w-[280px]">
        Edit and save this form to start tracking version history. The original version is always kept.
      </div>
    </div>

    <div v-else class="flex flex-col gap-1">
      <div
        v-for="(entry, idx) in entries"
        :key="entry.id"
        class="group rounded-lg border border-default bg-white transition-colors hover:bg-elevated/50"
      >
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="size-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <UIcon name="i-lucide-history" class="size-4 text-primary" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-semibold text-highlighted">{{ entry.label }}</span>
              <UBadge v-if="idx === 0" color="primary" variant="subtle" size="xs" class="rounded-full">Current</UBadge>
              <span class="text-xs font-semibold text-muted bg-elevated px-2 py-0.5 rounded-full">{{ entry.id }}</span>
            </div>
            <p class="text-sm text-muted mt-0.5 truncate">By {{ entry.actor }}</p>
            <p class="text-xs text-dimmed mt-1">{{ entry.date }}</p>
          </div>

          <div v-if="idx !== 0" class="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <UTooltip text="View">
              <UButton
                color="neutral"
                variant="ghost"
                size="sm"
                square
                icon="i-lucide-eye"
                class="text-muted"
                aria-label="View"
                @click="toggle(entry.id); $emit('view', entry)"
              />
            </UTooltip>
            <UTooltip text="Restore">
              <UButton
                color="primary"
                variant="ghost"
                size="sm"
                square
                icon="i-lucide-rotate-ccw"
                :disabled="retired"
                aria-label="Restore"
                @click="$emit('restore', entry)"
              />
            </UTooltip>
          </div>
        </div>

        <div v-if="expanded === entry.id" class="mx-4 mb-3 pt-2.5 border-t border-default text-xs text-muted">
          <slot name="diff" :entry="entry" />
        </div>
      </div>
    </div>
  </div>
</template>
