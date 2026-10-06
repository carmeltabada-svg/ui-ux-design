<script setup lang="ts">
// Prototype simulator bar. A real layout row at the very top of the app (not
// an overlay, not sticky), so it pushes the design down and never covers or
// shifts any sticky header below it. Four controls: State, Role, Scenario,
// Situation. Verification scaffolding for reviewers and developers: the design
// beneath it ships, this bar does not.
import { ASSET_TEAM_MEMBERS, currentUserName, setCurrentUser } from '~/data/ticketTrackers'

const toast = useToast()
// Local aliases: templates cannot assign to auto-imported refs directly.
const scenario = simScenario
const situation = simSituation
const barVisible = simulatorBarVisible
const state = simState

const stateOptions: { label: string, value: SimState }[] = [
  { label: 'Populated', value: 'populated' },
  { label: 'Loading', value: 'loading' },
  { label: 'Not found', value: 'notfound' },
  { label: 'Error', value: 'error' }
]
const scenarioOptions: { label: string, value: SimScenario }[] = [
  { label: 'Standard data', value: 'standard' },
  { label: 'First-timer, no tickets', value: 'first-timer' }
]
const situationOptions: { label: string, value: SimSituation }[] = [
  { label: 'Normal', value: 'normal' },
  { label: 'No contact number', value: 'no-contact' }
]

function onState(e: Event) {
  const v = (e.target as HTMLSelectElement).value as SimState
  if (v === 'error') {
    // Hands the app a real render failure so app/error.vue is what gets reviewed.
    simState.value = 'populated'
    showError({ statusCode: 500, statusMessage: 'Simulated error' })
    return
  }
  simState.value = v
}
function onRole(e: Event) {
  const name = (e.target as HTMLSelectElement).value
  setCurrentUser(name)
  toast.add({ title: `Acting as ${name}`, description: 'New tickets, My Tickets and takeovers now use this person.', icon: 'i-lucide-user-round', color: 'info' })
}

const selectClass = 'rounded border border-slate-600 bg-slate-800 text-slate-100 text-xs px-2 py-1 min-h-7 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white'
</script>

<template>
  <div v-if="barVisible" role="region" aria-label="Prototype simulator controls" class="bg-slate-900 text-xs text-slate-100">
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2">
      <span class="shrink-0 inline-flex items-center gap-1.5 font-semibold uppercase tracking-wide text-slate-300">
        <UIcon name="i-lucide-flask-conical" class="size-3.5" aria-hidden="true" />
        Prototype controls
      </span>
      <label class="shrink-0 inline-flex items-center gap-2">
        <span class="text-slate-300">State</span>
        <select :class="selectClass" :value="state" @change="onState">
          <option v-for="o in stateOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <label class="shrink-0 inline-flex items-center gap-2">
        <span class="text-slate-300">Viewing as</span>
        <select :class="selectClass" :value="currentUserName()" @change="onRole">
          <option v-for="m in ASSET_TEAM_MEMBERS" :key="m.name" :value="m.name">{{ m.name }}</option>
        </select>
      </label>
      <label class="shrink-0 inline-flex items-center gap-2">
        <span class="text-slate-300">Scenario</span>
        <select v-model="scenario" :class="selectClass">
          <option v-for="o in scenarioOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <label class="shrink-0 inline-flex items-center gap-2">
        <span class="text-slate-300">Situation</span>
        <select v-model="situation" :class="selectClass">
          <option v-for="o in situationOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <span class="ml-auto shrink-0 hidden xl:inline text-slate-400">Review tool, not part of the product</span>
      <button type="button" class="shrink-0 inline-flex items-center gap-1 rounded px-2 py-1 min-h-7 text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-white" @click="barVisible = false">
        <UIcon name="i-lucide-x" class="size-3.5" aria-hidden="true" />
        Hide
      </button>
    </div>
  </div>
</template>
