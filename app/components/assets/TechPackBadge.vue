<script setup lang="ts">
// Tech pack cell, built from the dashboard's badge system (dashboard/TechPackChip.vue +
// data/techPacks.ts): the plan is a soft, icon-led badge (Monthly Rental blue + repeat, Outright
// Purchase orange + badge-check) and the tier is a lighter outline badge one step down (Standard
// slate, High green, Ultra violet). BYOD is not one of the dashboard's two plans, so it takes its own
// soft teal with a laptop icon and has no tier (the team member owns the device).
import { TECH_PACK_STYLE, TIER_STYLE, TIER_SHORT, type TechPackTier } from '~/data/assets'

defineProps<{ type: string, tier?: TechPackTier }>()
</script>

<template>
  <span class="inline-flex items-center gap-1 whitespace-nowrap">
    <span
      v-if="TECH_PACK_STYLE[type]"
      class="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium"
      :class="TECH_PACK_STYLE[type]!.cls"
    >
      <UIcon
        :name="TECH_PACK_STYLE[type]!.icon"
        class="size-3"
        aria-hidden="true"
      />
      {{ TECH_PACK_STYLE[type]!.short }}
    </span>
    <span
      v-if="tier"
      class="inline-flex items-center rounded-md border px-1.5 py-px text-xs font-medium"
      :class="TIER_STYLE[tier]"
    >{{ TIER_SHORT[tier] }}</span>
  </span>
</template>
