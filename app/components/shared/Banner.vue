<script setup lang="ts">
// The one banner for the whole app. White surface so all text sits on white at
// WCAG 2.2 AA contrast, a soft tinted stroke around it, a stronger accent bar on
// the left, and an icon, so the tone is never carried by colour alone.
//
// Type scale (the same as the rest of the design): the title is 14px semibold,
// the description and any helper text are 12px, in the muted text colour.
//
// Slots:
//   default  the description, under the title
//   aside    small meta on the far right of the title row (a date and time, or Undo)
//   body     anything richer under the description: a field, a list, a detail grid
//   actions  buttons, at the bottom
//
// variant='closed' swaps the ordinary pop-in for the stamp-like close animation
// defined in main.css (banner-closed-stamp / banner-closed-icon / banner-closed-seal),
// used by the "Ticket closed" banner so a closed ticket reads as genuinely
// final rather than just another success.
type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral'
type Variant = 'default' | 'closed'

interface Props {
  tone?: Tone
  title: string
  /** Overrides the icon the tone gives. */
  icon?: string
  /** Tighter padding and a smaller icon, for notes that sit inside a form field's group. */
  compact?: boolean
  /** 'alert' for something that just went wrong, 'status' for a polite update. */
  role?: 'alert' | 'status'
  /** 'closed' uses the dedicated ticket-closed animation. */
  variant?: Variant
}
const props = withDefaults(defineProps<Props>(), { tone: 'neutral', icon: undefined, compact: false, role: undefined, variant: 'default' })

// Each tone carries three parts: `box` (outer border + accent + a very light
// tinted fill) `icon` (icon colour) and `glyph` (default icon). The light
// fill replaced the previous white surface after user feedback that a
// white box with only a pale stroke read as missing a background; the
// surrounding border was also darkened one step so the stroke itself reads
// as present at a glance (not a halo).
const TONES: Record<Tone, { box: string, icon: string, glyph: string }> = {
  info: { box: 'border-blue-300 border-l-blue-600 bg-blue-50/60', icon: 'text-blue-700', glyph: 'i-lucide-info' },
  success: { box: 'border-green-300 border-l-green-600 bg-green-50/60', icon: 'text-green-700', glyph: 'i-lucide-circle-check' },
  warning: { box: 'border-orange-300 border-l-orange-600 bg-orange-50/70', icon: 'text-orange-700', glyph: 'i-lucide-triangle-alert' },
  danger: { box: 'border-red-300 border-l-red-600 bg-red-50/70', icon: 'text-red-700', glyph: 'i-lucide-octagon-alert' },
  neutral: { box: 'border-gray-300 border-l-gray-500 bg-gray-50/60', icon: 'text-gray-600', glyph: 'i-lucide-info' }
}
const tone = computed(() => TONES[props.tone])
const enterClass = computed(() => props.variant === 'closed' ? 'banner-closed-enter' : 'banner-enter')
const iconAnimClass = computed(() => props.variant === 'closed' ? 'banner-closed-icon' : 'banner-icon-pop')
</script>

<template>
  <div
    :role="role"
    class="rounded-lg rounded-l-none border border-l-4 flex items-start gap-3"
    :class="[enterClass, tone.box, compact ? 'p-3' : 'p-4']"
  >
    <UIcon :name="icon ?? tone.glyph" class="shrink-0 mt-0.5" :class="[iconAnimClass, tone.icon, compact ? 'size-4' : 'size-5']" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-4">
        <h3 class="text-sm font-semibold text-default">{{ title }}</h3>
        <div v-if="$slots.aside" class="shrink-0 text-xs text-muted whitespace-nowrap mt-0.5"><slot name="aside" /></div>
      </div>
      <div v-if="$slots.default" class="text-xs text-muted mt-0.5"><slot /></div>
      <div v-if="$slots.body" class="mt-3"><slot name="body" /></div>
      <div v-if="$slots.actions" class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"><slot name="actions" /></div>
    </div>
  </div>
</template>
