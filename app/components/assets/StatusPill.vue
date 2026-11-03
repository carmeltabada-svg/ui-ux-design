<script setup lang="ts">
// The status badge from the live Assets app (models/CompanyAsset/StatusBadge.vue): a coloured status
// name on the left, a grey date half on the right. Solid fills, white text, px-1.5 py-0.5 text-xs.
// A sub-status is NOT part of the badge: the live list shows it as a separate neutral chip beside the
// badge (pages/app/assets/index.vue, status-cell), so the same is done here for Client Pull-Out.
import { STATUS_BG, STATUS_LIGHT, statusDef, badgeDate } from '~/data/assets'

const props = defineProps<{
  status: string
  sub?: string
  /** YYYY-MM-DD */
  date?: string
}>()

const color = computed(() => statusDef(props.status)?.color ?? 'gray')
const bg = computed(() => STATUS_BG[color.value])
const light = computed(() => STATUS_LIGHT[color.value])
</script>

<template>
  <div class="inline-flex items-center gap-2">
    <span class="inline-flex items-center text-xs font-medium text-white whitespace-nowrap">
      <span
        class="px-1.5 py-0.5"
        :class="[bg, date ? 'rounded-l-md' : 'rounded-md']"
      >{{ status }}</span>
      <span
        v-if="date"
        class="px-1.5 py-0.5 rounded-r-md font-normal"
        :class="light"
      >{{ badgeDate(date) }}</span>
    </span>
    <span
      v-if="sub"
      class="rounded-md bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200 whitespace-nowrap"
      :title="`Sub-status: ${sub}`"
    >{{ sub }}</span>
  </div>
</template>
