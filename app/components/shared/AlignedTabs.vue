<script setup lang="ts">
// Outlined-underline tabs whose active-tab stroke is aligned to sit flush
// with the bottom border of the page's sticky header (the nearest ancestor
// carrying `data-tabs-header`), rather than floating at its own baseline a
// few pixels off from that line. Ported from the email editor's old
// per-page underline-measuring trick, generalized so every tab switcher in
// the app (the Email/Forms list switcher, the Email/History and
// Form/History editor switchers) can share it.
interface TabItem {
  label: string
  value: string
  icon?: string
}

interface Props {
  items: TabItem[]
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

withDefaults(defineProps<Props>(), { size: 'md' })

const model = defineModel<string>({ required: true })

const tabsRoot = ref<HTMLElement>()
// Every header this renders inside uses `pb-3` (12px) plus a 1px border -
// defaulting to that instead of 0 means the very first paint (before the
// ResizeObserver below gets a chance to measure the real value on mount)
// already lands in the right place, instead of visibly snapping into
// position a frame later.
const underlineOffset = ref(13)

function measureUnderlineOffset() {
  const root = tabsRoot.value
  if (!root) return
  const header = root.closest('[data-tabs-header]') as HTMLElement | null
  if (!header) return
  // Tie the offset to the header's own bottom padding plus its border width,
  // rather than the raw pixel distance to its border - measuring the raw
  // distance let it drift into a large gap whenever anything else in the
  // header (rows below the tabs, differently-sized neighboring buttons)
  // changed height. Padding alone used to land the stroke a border-width
  // short of the line itself (the border sits just outside the padding
  // box), so the border width is added back in to land exactly on it.
  const style = getComputedStyle(header)
  const paddingBottom = parseFloat(style.paddingBottom) || 0
  const borderBottomWidth = parseFloat(style.borderBottomWidth) || 0
  underlineOffset.value = paddingBottom + borderBottomWidth
}

onMounted(() => {
  measureUnderlineOffset()
  const ro = new ResizeObserver(() => measureUnderlineOffset())
  if (tabsRoot.value) ro.observe(tabsRoot.value)
  const header = tabsRoot.value?.closest('[data-tabs-header]')
  if (header) ro.observe(header)
  onBeforeUnmount(() => ro.disconnect())
})

watch(() => model.value, () => nextTick(measureUnderlineOffset))
</script>

<template>
  <div ref="tabsRoot" class="inline-block" :style="{ '--tab-underline-offset': `${underlineOffset}px` }">
    <UTabs
      v-model="model"
      :items="items"
      color="primary"
      variant="link"
      :size="size"
      class="w-auto"
      :ui="{
        root: 'items-start gap-0',
        list: 'border-none pb-0 w-auto',
        indicator: 'bottom-[calc(-1*var(--tab-underline-offset))]',
        trigger: 'in-[[data-slot=list]:not(:has([data-slot=indicator]))]:data-[state=active]:after:bottom-[calc(-1*var(--tab-underline-offset))]',
        leadingIcon: 'size-3.5',
        content: 'hidden'
      }"
    />
  </div>
</template>
