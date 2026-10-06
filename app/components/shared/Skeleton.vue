<script setup lang="ts">
// A single skeleton block for a loading placeholder. Props:
//   width   Tailwind width class or '100%' (default 'full')
//   height  Tailwind height class (default 'h-4')
//   rounded Tailwind rounded- (default 'rounded-md')
//   circle  shortcut: square + rounded-full
//   lines   when > 1, render N stacked lines of the given height with 8px gap
// The shimmer is a slow left-to-right gradient (keyframes `skeleton-shimmer`
// in main.css); reduced-motion drops the animation and keeps the quiet
// gray fill.
interface Props {
  width?: string
  height?: string
  rounded?: string
  circle?: boolean
  lines?: number
}
const props = withDefaults(defineProps<Props>(), {
  width: 'w-full',
  height: 'h-4',
  rounded: 'rounded-md',
  circle: false,
  lines: 1
})
const lineClass = computed(() => [
  props.width,
  props.height,
  props.circle ? 'rounded-full' : props.rounded,
  'skeleton'
])
</script>

<template>
  <div v-if="lines <= 1" :class="lineClass" aria-hidden="true" />
  <div v-else class="flex flex-col gap-2" aria-hidden="true">
    <div v-for="i in lines" :key="i" :class="[lineClass, i === lines ? 'w-3/4' : 'w-full']" />
  </div>
</template>

<style scoped>
.skeleton {
  background: linear-gradient(100deg, rgba(226, 232, 240, 0.6) 20%, rgba(226, 232, 240, 1) 50%, rgba(226, 232, 240, 0.6) 80%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.4s ease-in-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .skeleton {
    background: rgb(226, 232, 240);
    animation: none;
  }
}
</style>
