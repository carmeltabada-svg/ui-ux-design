<script setup lang="ts">
// "This step already happened" banner, shown when a completed stage is
// revisited (via Back) so it reads as done instead of offering the original
// action again. Title + short description on the left, the recorded date and
// time on the far right of the title row. Built on the app's one banner, so it
// matches every other banner in size, colour and stroke.
//
// variant='closed' hands the SharedBanner's stamp-like close animation,
// used specifically for the "Ticket closed" banner at the top of a finished
// ticket (open items #4 and #8).
interface Props {
  title: string
  description?: string
  /** A stored time (UTC ISO). Shown in the viewer's own time zone, e.g. "Oct 1, 2026 · 8:40 AM". */
  when?: string | null
  icon?: string
  variant?: 'default' | 'closed'
  /** Defaults to success. A closed ticket with open items passes 'neutral' so a green check never sits above unresolved gaps. */
  tone?: 'success' | 'neutral'
}
const props = withDefaults(defineProps<Props>(), { icon: 'i-lucide-mail-check', description: '', when: null, variant: 'default', tone: 'success' })

const whenParts = computed(() => {
  if (!props.when) return null
  const when = formatDateTime(props.when)
  const m = when.match(/^(.*?)(?:,| at)?\s+(\d{1,2}:\d{2}\s?[AP]M)$/i)
  return m ? { date: m[1], time: m[2] } : { date: when, time: '' }
})
</script>

<template>
  <SharedBanner data-sent-banner :tone="tone" :title="title" :icon="icon" role="status" :variant="variant">
    <template v-if="whenParts" #aside>
      {{ whenParts.date }}<template v-if="whenParts.time"> &middot; {{ whenParts.time }}</template>
    </template>
    <template v-if="description || $slots.default" #default>
      <slot>{{ description }}</slot>
    </template>
  </SharedBanner>
</template>
