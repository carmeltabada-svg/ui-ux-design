<script setup lang="ts">
// One multi-select filter. It has two looks from the same component:
//  - `compact`: a small outline select for the toolbar ("Status", or "Status" with a count pill once something is
//    picked), which opens a searchable checklist. The toolbar stays on one row however many filters exist.
//  - the default: a labelled full-width field, used inside the Filters panel.
// Every option carries the number of assets it would match, shown in a pill. An item with `type: 'label'` is a heading.
export interface FilterOption { label: string, value?: string, count?: number, type?: 'label' }
const props = defineProps<{ label: string, items: FilterOption[], compact?: boolean, searchable?: boolean, noun?: string, disabled?: boolean }>()
const model = defineModel<string[]>({ required: true })

const textFor = (v: string) => props.items.find(i => i.value === v)?.label ?? v
const summary = computed(() => {
  if (!model.value.length) return `All ${props.noun ?? props.label.toLowerCase()}`
  if (model.value.length === 1) return textFor(model.value[0]!)
  return `${model.value.length} selected`
})
const searchInput = computed(() => props.searchable ? { placeholder: `Search ${props.noun ?? props.label.toLowerCase()}` } : false)
const ui = { content: 'min-w-64', item: 'group', itemLabel: 'group-data-[state=checked]:text-primary group-data-[state=checked]:font-medium' }
</script>

<template>
  <div v-if="compact">
    <USelectMenu
      v-model="model"
      multiple
      :items="items"
      value-key="value"
      :search-input="searchInput"
      :content="{ align: 'start' }"
      :disabled="disabled"
      :ui="ui"
      variant="outline"
      size="sm"
      :aria-label="`Filter by ${label}`"
      class="w-auto"
    >
      <span class="inline-flex items-center gap-2">
        {{ label }}
        <UBadge v-if="model.length" :label="String(model.length)" color="primary" variant="solid" size="sm" class="rounded-full tabular-nums" />
      </span>
      <template #item-label="{ item }">
        <AssetsTruncate :text="(item as FilterOption).label" />
      </template>
      <template #item-trailing="{ item }">
        <UBadge v-if="(item as FilterOption).count !== undefined" color="neutral" variant="subtle" size="sm" class="rounded-full tabular-nums">{{ (item as FilterOption).count }}</UBadge>
      </template>
    </USelectMenu>
  </div>

  <UFormField v-else :label="label" :hint="disabled ? 'Pick an asset type first' : undefined" :ui="{ label: 'text-xs font-normal text-default', hint: 'text-xs text-muted' }">
    <USelectMenu
      v-model="model"
      multiple
      :items="items"
      value-key="value"
      :placeholder="`All ${noun ?? label.toLowerCase()}`"
      :search-input="searchInput"
      :disabled="disabled"
      size="md"
      class="w-full"
      :ui="ui"
    >
      <AssetsTruncate :text="summary" :class="model.length ? 'text-highlighted' : 'text-muted'" />
      <template #item-label="{ item }">
        <AssetsTruncate :text="(item as FilterOption).label" />
      </template>
      <template #item-trailing="{ item }">
        <UBadge v-if="(item as FilterOption).count !== undefined" color="neutral" variant="subtle" size="sm" class="rounded-full tabular-nums">{{ (item as FilterOption).count }}</UBadge>
      </template>
    </USelectMenu>
  </UFormField>
</template>
