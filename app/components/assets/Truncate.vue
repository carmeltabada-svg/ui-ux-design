<script setup lang="ts">
// Text that cuts itself with an ellipsis when it does not fit, and shows the full text in a tooltip, but only while it
// is actually cut: a value that fits gets no tooltip. Used for filter values, placeholders and applied filter chips.
defineOptions({ inheritAttrs: false })
const props = defineProps<{ text: string }>()

const el = ref<HTMLElement>()
const clipped = ref(false)
function measure() {
  const e = el.value
  clipped.value = !!e && e.scrollWidth > e.clientWidth + 1
}
onMounted(measure)
watch(() => props.text, () => nextTick(measure))
let observer: ResizeObserver | undefined
onMounted(() => { if (el.value && typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(measure); observer.observe(el.value) } })
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <UTooltip :text="text" :disabled="!clipped" :delay-duration="150">
    <span ref="el" v-bind="$attrs" class="block min-w-0 truncate"><slot>{{ text }}</slot></span>
  </UTooltip>
</template>
