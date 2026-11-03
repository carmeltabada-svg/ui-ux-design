<script setup lang="ts">
// Prototype simulator bar for the Assets exit-status screens. A real layout row at the very
// top (not an overlay, not sticky), so it pushes the design down. Verification scaffolding for
// reviewers: the design beneath it ships, this bar does not. Deleting it means deleting this
// file and the line in layouts/assets.vue.
import {
  assetsSimState, assetsSimRole, assetsSimScenario, assetsSimCustody, assetsSimWarranty, assetsSimTransit, resetAssets,
  type AssetsSimState, type AssetsSimRole, type AssetsSimScenario, type AssetsSimCustody, type AssetsSimWarranty, type AssetsSimTransit
} from '~/data/assets'

import { resetDetail } from '~/data/assetsDetail'

// The asset detail controls only mean something on that page, so they show only there.
const route = useRoute()
const onDetail = computed(() => /^\/assets\/[^/]+/.test(route.path))

const visible = ref(true)
const toast = useToast()

const stateOptions: { label: string, value: AssetsSimState }[] = [
  { label: 'Populated', value: 'populated' },
  { label: 'Loading', value: 'loading' },
  { label: 'Not found', value: 'notfound' }
]
const roleOptions: { label: string, value: AssetsSimRole }[] = [
  { label: 'Asset officer', value: 'officer' },
  { label: 'Read only', value: 'viewer' }
]
const scenarioOptions: { label: string, value: AssetsSimScenario }[] = [
  { label: 'Standard data', value: 'standard' },
  { label: 'Empty list', value: 'empty' }
]

const custodyOptions: { label: string, value: AssetsSimCustody }[] = [
  { label: 'From the data', value: 'data' },
  { label: 'No custody history', value: 'empty' },
  { label: 'Single, checked out', value: 'single-open' },
  { label: 'Single, returned', value: 'single-closed' },
  { label: 'Long history', value: 'long' }
]
const warrantyOptions: { label: string, value: AssetsSimWarranty }[] = [
  { label: 'From the data', value: 'data' },
  { label: 'Needs PO', value: 'needs-po' },
  { label: 'Active', value: 'active' },
  { label: 'Expiring soon', value: 'expiring' },
  { label: 'Expired', value: 'expired' }
]
const transitOptions: { label: string, value: AssetsSimTransit }[] = [
  { label: 'From the data', value: 'data' },
  { label: 'In transit, receipt open', value: 'transit' },
  { label: 'In use, receipt confirmed', value: 'inuse' }
]

function reset() {
  assetsSimCustody.value = 'data'
  assetsSimWarranty.value = 'data'
  assetsSimTransit.value = 'data'
  resetAssets()
  resetDetail()
  toast.add({ title: 'Sample data reset', description: 'The asset list and its history are back to the starting data.', icon: 'i-lucide-rotate-ccw', color: 'info' })
}

const selectClass = 'rounded border border-slate-600 bg-slate-800 text-slate-100 text-xs px-2 py-1 min-h-7 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white'
</script>

<template>
  <div
    v-if="visible"
    role="region"
    aria-label="Prototype simulator controls"
    class="bg-slate-900 text-xs text-slate-100"
  >
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2">
      <span class="shrink-0 inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide text-slate-300">
        <UIcon
          name="i-lucide-flask-conical"
          class="size-3.5"
          aria-hidden="true"
        />
        Prototype controls
      </span>
      <label class="shrink-0 inline-flex items-center gap-2">
        <span class="text-slate-300">State</span>
        <select
          v-model="assetsSimState"
          :class="selectClass"
        >
          <option
            v-for="o in stateOptions"
            :key="o.value"
            :value="o.value"
          >{{ o.label }}</option>
        </select>
      </label>
      <label class="shrink-0 inline-flex items-center gap-2">
        <span class="text-slate-300">Viewing as</span>
        <select
          v-model="assetsSimRole"
          :class="selectClass"
        >
          <option
            v-for="o in roleOptions"
            :key="o.value"
            :value="o.value"
          >{{ o.label }}</option>
        </select>
      </label>
      <label class="shrink-0 inline-flex items-center gap-2">
        <span class="text-slate-300">Scenario</span>
        <select
          v-model="assetsSimScenario"
          :class="selectClass"
        >
          <option
            v-for="o in scenarioOptions"
            :key="o.value"
            :value="o.value"
          >{{ o.label }}</option>
        </select>
      </label>
      <template v-if="onDetail">
        <label class="shrink-0 inline-flex items-center gap-2">
          <span class="text-slate-300">Custody history</span>
          <select
            v-model="assetsSimCustody"
            :class="selectClass"
          >
            <option
              v-for="o in custodyOptions"
              :key="o.value"
              :value="o.value"
            >{{ o.label }}</option>
          </select>
        </label>
        <label class="shrink-0 inline-flex items-center gap-2">
          <span class="text-slate-300">Warranty</span>
          <select
            v-model="assetsSimWarranty"
            :class="selectClass"
          >
            <option
              v-for="o in warrantyOptions"
              :key="o.value"
              :value="o.value"
            >{{ o.label }}</option>
          </select>
        </label>
        <label class="shrink-0 inline-flex items-center gap-2">
          <span class="text-slate-300">Transit</span>
          <select
            v-model="assetsSimTransit"
            :class="selectClass"
          >
            <option
              v-for="o in transitOptions"
              :key="o.value"
              :value="o.value"
            >{{ o.label }}</option>
          </select>
        </label>
      </template>
      <button
        type="button"
        class="shrink-0 inline-flex items-center gap-1 rounded px-2 py-1 min-h-7 text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-white"
        @click="reset"
      >
        <UIcon
          name="i-lucide-rotate-ccw"
          class="size-3.5"
          aria-hidden="true"
        />
        Reset sample data
      </button>
      <span class="ml-auto shrink-0 hidden xl:inline text-slate-400">Review tool, not part of the product</span>
      <button
        type="button"
        class="shrink-0 inline-flex items-center gap-1 rounded px-2 py-1 min-h-7 text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-white"
        @click="visible = false"
      >
        <UIcon
          name="i-lucide-x"
          class="size-3.5"
          aria-hidden="true"
        />
        Hide
      </button>
    </div>
  </div>
</template>
