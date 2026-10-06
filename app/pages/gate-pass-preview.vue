<script setup lang="ts">
// Standalone page for "Open in Forms" on the Gate Pass drawer - opens in its
// own tab (target="_blank" from the trigger) specifically so the ticket
// workspace tab/context is never lost, per the explicit ask: the real
// system's own "Forms > Gate Pass" reload happens in the *same* tab, which
// loses the ticket the operator was just looking at. No AMS app chrome
// (sidebar/navbar), same reasoning as /form-preview - this is a printable
// document, not another app screen.
import { TICKETS, type GatePassKind, GATE_PASS_KIND_LABEL } from '~/data/ticketTrackers'
import { hydrateTicketsFromStorage } from '~/utils/ticketStorage'

definePageMeta({ layout: 'blank', ssr: false })

hydrateTicketsFromStorage()

const route = useRoute()
const ticketNumber = computed(() => Number(route.query.t))
const kind = computed(() => (route.query.kind as GatePassKind) === 'building' ? 'building' : 'goteam')

const ticket = computed(() => Object.values(TICKETS).find(t => t.ticketNumber === ticketNumber.value))
const gatePass = computed(() => ticket.value ? (kind.value === 'building' ? ticket.value.buildingGatePass : ticket.value.gatePass) : null)

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

// "View / Print" (the drawer's own left-hand button) links here with
// ?autoprint=1 so it behaves as a direct print shortcut, distinct from
// "Open in Forms" opening the same page to just look at/leave open - one
// real page serving both buttons' actual destinations rather than two
// buttons pointing at content that doesn't really exist twice.
onMounted(() => {
  if (route.query.autoprint === '1') setTimeout(() => window.print(), 150)
})
</script>

<template>
  <div class="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0">
    <div v-if="!ticket || !gatePass" class="max-w-lg mx-auto bg-white rounded-lg p-8 text-center text-gray-500">
      Gate pass not found. This link only works for a gate pass that's already been issued.
    </div>
    <div v-else class="max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-8 print:shadow-none print:rounded-none" style="font-family:'Inter',sans-serif">
      <div class="flex items-start justify-between border-b border-gray-200 pb-4 mb-5 print:hidden">
        <div class="text-lg font-bold text-[#161642]">GoTeam AMS</div>
        <button type="button" class="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50" onclick="window.print()">Print</button>
      </div>

      <div class="flex items-center gap-2 mb-1">
        <h1 class="text-xl font-bold text-gray-900">{{ GATE_PASS_KIND_LABEL[kind] }}</h1>
        <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm bg-green-100 text-green-700">Issued</span>
      </div>
      <p class="text-sm text-gray-500 mb-6">{{ gatePass.ref }} &middot; Valid until {{ fmtDate(gatePass.validUntil) }}</p>

      <div class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Gate Pass Information</div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mb-6">
        <div><span class="text-xs text-gray-500 block">Gate Pass No.</span><span class="font-medium">{{ gatePass.ref }}</span></div>
        <div><span class="text-xs text-gray-500 block">Ticket Ref.</span><span class="font-medium">{{ ticket.reference }}</span></div>
        <div><span class="text-xs text-gray-500 block">Issue Date</span><span class="font-medium">{{ fmtDate(gatePass.issueDate) }}</span></div>
        <div><span class="text-xs text-gray-500 block">Valid Until</span><span class="font-medium">{{ fmtDate(gatePass.validUntil) }}</span></div>
        <div><span class="text-xs text-gray-500 block">Team Member</span><span class="font-medium">{{ ticket.employee.name }}</span></div>
        <div><span class="text-xs text-gray-500 block">Employee ID</span><span class="font-medium">{{ ticket.employee.id }}</span></div>
        <div><span class="text-xs text-gray-500 block">Dept. / Role</span><span class="font-medium">{{ ticket.employee.dept }}</span></div>
        <div><span class="text-xs text-gray-500 block">Requested By</span><span class="font-medium">{{ gatePass.requestedBy }}</span></div>
      </div>

      <div class="rounded-md border border-gray-200 bg-gray-50 p-3 flex items-center justify-between mb-6">
        <div><span class="text-xs text-gray-500 block">Movement</span><span class="font-semibold">{{ gatePass.movement === 'checkin' ? 'Check In' : 'Check Out' }}</span></div>
        <div v-if="gatePass.time"><span class="text-xs text-gray-500 block">Time</span><span class="font-semibold">{{ gatePass.time }}</span></div>
        <div><span class="text-xs text-gray-500 block">Purpose</span><span class="font-medium">{{ gatePass.purpose || 'Not stated' }}</span></div>
      </div>

      <div class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Asset Items</div>
      <table class="w-full text-sm mb-8">
        <thead><tr class="text-left text-gray-500 text-xs"><th class="pb-1">Type</th><th class="pb-1">Tag / Serial</th><th class="pb-1">Remarks</th></tr></thead>
        <tbody>
          <tr v-for="a in gatePass.assets" :key="a.serial" class="border-t border-gray-200">
            <td class="py-1.5 pr-2">{{ a.type }}</td>
            <td class="py-1.5 pr-2 text-gray-500">{{ a.serial }}</td>
            <td class="py-1.5" :class="a.remarks ? '' : 'text-gray-400 italic'">{{ a.remarks || 'No remarks provided' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="grid grid-cols-3 gap-3 pt-3 border-t border-dashed border-gray-200 text-xs text-center">
        <div><div class="border-t border-gray-400 mt-8 pt-1">Team Member</div><div class="text-gray-400">Signature over Printed Name</div></div>
        <div><div class="border-t border-gray-400 mt-8 pt-1">Asset Team</div><div class="text-gray-400">Signature over Printed Name</div></div>
        <div><div class="border-t border-gray-400 mt-8 pt-1">Security</div><div class="text-gray-400">Signature over Printed Name</div></div>
      </div>
      <p class="text-center text-xs text-gray-400 mt-6">System generated &middot; GoTeam AMS</p>
    </div>
  </div>
</template>
