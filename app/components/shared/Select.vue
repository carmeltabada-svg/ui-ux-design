<script setup lang="ts">
// A select that grows a search box once its list is long enough to scroll.
// USelect has no search; USelectMenu does. A short list stays a plain
// USelect (a search box on three options is noise), a long one switches to
// USelectMenu. 7 rows is what the 15rem menu shows before it scrolls.
defineOptions({ inheritAttrs: false })

const SEARCH_THRESHOLD = 7

const props = defineProps<{ items: readonly unknown[] }>()
const model = defineModel<unknown>()

const searchable = computed(() => props.items.length > SEARCH_THRESHOLD)
</script>

<template>
  <USelectMenu v-if="searchable" v-bind="$attrs" v-model="model" :items="(items as any[])" value-key="value" />
  <USelect v-else v-bind="$attrs" v-model="model" :items="(items as any[])" value-key="value" />
</template>
