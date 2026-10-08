<script setup lang="ts">
// Ported from the real top navbar/breadcrumb bar in the source production page
// ("Dashboard - GoTeam Assets.html"): hamburger (mobile) + collapse-sidebar
// button, a breadcrumb nav (Home > current page), and a right-side dark-mode
// toggle + "Open Internal Dashboard" external link, verbatim from source
// (https://r24.go.team/).
import { localISO, NOTIFICATIONS, TICKETS, simulateHrisLwdUpdate, simulateBranchReply, scanTicketAlerts, NOTIFICATION_KINDS, type NotificationKind, pushDemoNotification, pushDemoNotificationSet, pendingDigestItems, sendMorningDigest, DIGESTS, type MorningDigest, clearAllTickets, ASSET_TEAM_MEMBERS, currentUserName, setCurrentUser } from '~/data/ticketTrackers'
import { flushTicketsToStorage } from '~/utils/ticketStorage'
import { ensureTemplateRuntime } from '~/data/templateRuntime'
import { RETRIEVAL_FORMS } from '~/data/retrievalForms'

interface Props {
  sidebarOpen?: boolean
}

withDefaults(defineProps<Props>(), {
  sidebarOpen: true
})

defineEmits<{
  'update:sidebarOpen': [value: boolean]
  'toggle-mobile-menu': []
}>()

const route = useRoute()
const NuxtLink = resolveComponent('NuxtLink')
interface Crumb { label: string, icon?: string, to?: string }

// Home > section > the page you are on. Everything but the last crumb links
// back, so the trail always matches the current view.
const breadcrumbItems = computed<Crumb[]>(() => {
  const home: Crumb = { label: 'Home', icon: 'i-lucide-home', to: '/' }
  const path = route.path
  const id = String(route.params.id ?? '')

  if (path.startsWith('/master-data')) {
    const section: Crumb = { label: 'Master Data', icon: 'i-lucide-database', to: '/master-data' }
    if (path.startsWith('/master-data/offboarding-checklists')) return [home, section, { label: 'Offboarding Checklists' }]
    return [home, { label: 'Master Data', icon: 'i-lucide-database' }]
  }
  if (path.startsWith('/ticket-tracker')) {
    const section: Crumb = { label: 'Ticket Tracker', icon: 'i-lucide-ticket-check', to: '/ticket-tracker' }
    if (path === '/ticket-tracker/create') return [home, section, { label: 'Create Retrieval Ticket' }]
    if (id) return [home, section, { label: `Ticket #${id}` }]
    return [home, { label: 'Ticket Tracker', icon: 'i-lucide-ticket-check' }]
  }
  if (path.startsWith('/templates/email/') && id) {
    return [home, { label: 'Templates', icon: 'i-lucide-mail', to: '/templates' }, { label: ensureTemplateRuntime(id).name || 'Untitled' }]
  }
  if (path.startsWith('/templates/forms/') && id) {
    const form = RETRIEVAL_FORMS.find(f => f.id === id)
    return [home, { label: 'Templates', icon: 'i-lucide-mail', to: '/templates?tab=forms' }, { label: form?.name || 'Untitled' }]
  }
  return [home, { label: 'Templates', icon: 'i-lucide-mail' }]
})

const toast = useToast()

// --- Notification bell/panel - markup and copy match the real product's
// existing panel (source: "Dashboard - GoTeam Assets.html") verbatim: bell +
// unread-count chip, "Mark all as read", a divide-y list of
// title/description/timestamp rows. The only current producer of
// notifications is the HRIS/R24 Last Working Day simulation below.
const notifOpen = ref(false)
// Each notification is addressed to the ticket's assignee, so the bell shows
// the ones for whoever you are acting as. Older saved ones have no recipient
// and show to everyone.
const myNotifications = computed(() => NOTIFICATIONS.filter(n => !n.recipient || n.recipient === currentUserName()))
const unreadCount = computed(() => myNotifications.value.filter(n => !n.read).length)
const unreadLabel = computed(() => unreadCount.value > 9 ? '9+' : String(unreadCount.value))
// Today / This week / This month are cumulative windows (this week includes
// today), with weeks starting on Monday like the Activity Log.
const notifTab = ref('today')
const notifTabs = [
  { label: 'Today', value: 'today' },
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' }
]
function notifTime(n: { at?: string, when: string }) {
  return Date.parse(n.at ?? n.when)
}
function inWindow(n: { at?: string, when: string }, window: string) {
  const t = notifTime(n)
  if (Number.isNaN(t)) return true
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (window === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  if (window === 'month') start.setDate(1)
  return t >= start.getTime()
}
const tabNotifications = computed(() => myNotifications.value.filter(n => inWindow(n, notifTab.value)))
const unreadItems = computed(() => tabNotifications.value.filter(n => !n.read))
const readItems = computed(() => tabNotifications.value.filter(n => n.read))
const notifSections = computed(() => [
  { key: 'unread', label: 'Unread', items: unreadItems.value },
  { key: 'read', label: '', items: readItems.value }
].filter(x => x.items.length))
const emptyTabLabel = computed(() => ({ today: 'Nothing today', week: 'Nothing this week', month: 'Nothing this month' } as Record<string, string>)[notifTab.value])
// One icon per kind, each picked to say what the notification is about: the same
// alarm and clock as the list's deadline badges, a signature for the signed form,
// the shield the P&C Acknowledgement card uses, a calendar for a changed date.
const NOTIFICATION_ICONS: Record<string, string> = {
  overdue: 'i-lucide-alarm-clock',
  'due-soon': 'i-lucide-clock-alert',
  'branch-overdue': 'i-lucide-mail-warning',
  reply: 'i-lucide-mail-check',
  'courier-reply': 'i-lucide-truck',
  'form-signed': 'i-lucide-file-signature',
  acknowledgment: 'i-lucide-shield-check',
  'record-update': 'i-lucide-calendar-clock',
  'it-lock': 'i-lucide-lock',
  checklist: 'i-lucide-clipboard-list',
  'shipment-delayed': 'i-lucide-package-x',
  quotation: 'i-lucide-receipt-text',
  takeover: 'i-lucide-handshake',
  assigned: 'i-lucide-user-round-plus'
}
function notificationIcon(kind?: string) {
  return (kind && NOTIFICATION_ICONS[kind]) || 'i-lucide-bell'
}
// Red for things that have already slipped, orange for what needs doing, grey for news.
const LATE_KINDS = new Set(['overdue', 'branch-overdue', 'shipment-delayed', 'it-lock'])
function notificationTone(n: { kind?: string, action?: boolean }) {
  if (n.kind && LATE_KINDS.has(n.kind)) return 'bg-red-50 text-red-700'
  return n.action ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-muted'
}
// Marks what the current tab shows, so the button always matches what you see.
function markAllRead() {
  unreadItems.value.forEach(n => { n.read = true })
}
// Explicitly closes the popover on click - a headless popover doesn't know
// an internal link navigated the page, so left uncontrolled it just stays
// floating open over whatever the click routed to, which is what looked
// like "clicking a notification doesn't redirect" (the navigation was
// actually firing, the panel just never got out of the way to show it).
function openNotification(id: string) {
  const n = NOTIFICATIONS.find(x => x.id === id)
  if (n) n.read = true
  notifOpen.value = false
}

// --- Simulation Control - this app has no backend and no real R24
// integration, so there's nothing that can push a live HRIS change here.
// This stands in for that event, so the entire downstream experience
// (recalculation, flagging, notification, activity log) can be built and
// demoed against something real, decoupled from the integration itself.
const simOpen = ref(false)
// Demo bypass for the send guardrail (see ~/utils/demoSettings.ts) - a local
// alias so the template can v-model it (an import binding itself can't be
// assigned to).
const demoAllowUnresolved = allowUnresolvedSends
const showSimulatorBar = simulatorBarVisible
// Checklist final-review rule was a four-way demo switch here until 5 Oct 2026.
// Finalised to "anyone can sign off, with per-task Done by always recorded"
// (FR-003.11 applies no segregation of duties; see demoSettings.ts and open
// items #11/#34). The switch, the designated-reviewer list, and the other
// three rule paths are gone.
const actAsOptions = ASSET_TEAM_MEMBERS.map(m => ({ label: m.name, value: m.name }))
function switchUser(name: unknown) {
  if (typeof name !== 'string') return
  setCurrentUser(name)
  toast.add({ title: `Acting as ${name}`, description: 'New tickets, My Tickets and takeovers now use this person.', icon: 'i-lucide-user-round', color: 'info' })
}
// Every simulation here is a general demo: none of them needs a ticket picked,
// and none is ever blocked by a ticket's state. The notification ones are built
// from the employee records and touch no ticket.
// A real ticket is only used when it is the acting user's own, because that is the
// bell the demo is being watched in; otherwise the demo notification stands in.
const latestOpenTicket = () => Object.values(TICKETS).filter(t => t.status === 'open' && t.assignee.name === currentUserName()).sort((x, y) => y.ticketNumber - x.ticketNumber)[0]

// Employee record update. A ticket and date are optional: it defaults to the
// latest open ticket and a Last Working Day a week later, and with no ticket at
// all it still pushes the notification.
const simTicketId = ref('')
const simNewLwd = ref('')
const openTicketOptions = computed(() =>
  Object.values(TICKETS)
    .filter(t => t.status === 'open')
    .sort((x, y) => y.ticketNumber - x.ticketNumber)
    .map(t => ({ label: `#${t.ticketNumber} - ${t.employee.name} (LWD ${t.lwd || 'not set'})`, value: t.id }))
)
function runSimulation() {
  const ticket = TICKETS[simTicketId.value] ?? latestOpenTicket()
  if (!ticket) {
    pushDemoNotification('record-update')
    toast.add({ title: 'Simulated record update pushed', description: `Check the bell as ${currentUserName()}.`, icon: 'i-lucide-refresh-cw', color: 'success' })
    simOpen.value = false
    return
  }
  let newLwd = simNewLwd.value
  if (!newLwd) {
    const d = new Date(`${ticket.lwd || localISO(new Date())}T00:00:00`)
    d.setDate(d.getDate() + 7)
    newLwd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  simulateHrisLwdUpdate(ticket, newLwd)
  toast.add({
    title: 'Simulated record update pushed',
    description: `${ticket.employee.name}'s Last Working Day is now ${new Date(`${newLwd}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
    icon: 'i-lucide-refresh-cw',
    color: 'success'
  })
  simOpen.value = false
  simTicketId.value = ''
  simNewLwd.value = ''
}

// Team member reply to the branch request. If a ticket really is waiting for one
// it is flagged (so the banner and Mark Reply as Received can be shown); with none
// waiting it still pushes the notification.
function runReplySimulation() {
  const waiting = Object.values(TICKETS)
    .filter(t => t.status === 'open' && t.assignee.name === currentUserName() && t.branchRequestSentAt && !t.branchRequestReplyReceived && !t.branchReplyDetectedAt)
    .sort((x, y) => y.ticketNumber - x.ticketNumber)[0]
  if (waiting && simulateBranchReply(waiting)) {
    toast.add({ title: 'Simulated reply arrived', description: `${waiting.employee.name} replied. ${waiting.assignee.name} was notified in the bell and by email.`, icon: 'i-lucide-mail', color: 'success' })
    return
  }
  pushDemoNotification('reply')
  toast.add({ title: 'Simulated reply arrived', description: `Check the bell as ${currentUserName()}.`, icon: 'i-lucide-mail', color: 'success' })
}

// Overdue, due soon, IT lock, checklist and similar alerts are worked out from
// the tickets themselves. Checked shortly after load and then every minute; each
// alert is only ever raised once (see scanTicketAlerts).
let alertTimer: ReturnType<typeof setInterval> | undefined
let alertFirstRun: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  alertFirstRun = setTimeout(() => scanTicketAlerts(), 2500)
  alertTimer = setInterval(() => scanTicketAlerts(), 60000)
})
onBeforeUnmount(() => {
  clearTimeout(alertFirstRun)
  clearInterval(alertTimer)
})
function runAlertCheck() {
  const n = scanTicketAlerts()
  toast.add({ title: n ? `${n} new alert${n === 1 ? '' : 's'} raised` : 'No new alerts', description: n ? 'Each went to its assignee in the bell and by email.' : 'Nothing new needs attention right now.', icon: 'i-lucide-bell-ring', color: n ? 'success' : 'neutral' })
}

// Every notification type on demand, so the panel can be shown empty, with one,
// or packed full. Pushed to whoever is being acted as, spread across recent days.
const simKind = ref<NotificationKind>('overdue')
function runDemoNotification() {
  pushDemoNotification(simKind.value)
  toast.add({ title: 'Notification pushed', description: `Check the bell as ${currentUserName()}.`, icon: 'i-lucide-bell-ring', color: 'success' })
}
function runDemoSet() {
  const n = pushDemoNotificationSet()
  toast.add({ title: `${n} notifications pushed`, description: 'One of every type, spread over the last few days, some already read.', icon: 'i-lucide-bell-ring', color: 'success' })
}

// Morning digest: slow-building alerts are emailed once at 8:00 AM instead of
// one email each. This sends it now and shows the email.
const digestOpen = ref(false)
const digestShown = ref<MorningDigest | null>(null)
const waitingDigestCount = computed(() => pendingDigestItems(currentUserName()).length)
const lastDigest = computed(() => DIGESTS.find(d => d.to.name === currentUserName()) ?? null)
function runSendDigest() {
  const d = sendMorningDigest(currentUserName())
  if (!d) {
    toast.add({ title: 'Nothing waiting', description: 'Push a notification type first, or one of every type, to fill the digest.', icon: 'i-lucide-mail', color: 'neutral' })
    return
  }
  showDigest(d)
}
function showDigest(d: MorningDigest) {
  digestShown.value = d
  digestOpen.value = true
  simOpen.value = false
}

// The duplicate-open-ticket guardrail (see findOpenDuplicate) makes it
// impossible to re-test ticket creation for the same HRIS record without
// this - this app has no backend to reset data from elsewhere. Confirmed
// via a native confirm() since it's destructive to whatever's currently on
// the Overview list.
function onClearAllTickets() {
  if (!window.confirm('Clear every ticket and notification? This can\'t be undone.')) return
  clearAllTickets()
  flushTicketsToStorage()
  simOpen.value = false
  toast.add({ title: 'All tickets cleared', description: 'Ticket Tracker is now empty - create a new ticket to test against.', icon: 'i-lucide-trash-2', color: 'success' })
}
</script>

<template>
  <header class="sticky top-0 z-20 h-16 flex items-center justify-between px-4 border-b border-default bg-white shrink-0">
    <div class="flex items-center gap-3 overflow-hidden flex-1">
      <UButton
        icon="i-lucide-menu"
        color="neutral"
        variant="ghost"
        size="sm"
        class="lg:hidden shrink-0"
        aria-label="Toggle Menu"
        @click="$emit('toggle-mobile-menu')"
      />
      <UButton
        :icon="sidebarOpen ? 'i-lucide-panel-left-close' : 'i-lucide-panel-left-open'"
        color="neutral"
        variant="ghost"
        size="sm"
        class="hidden lg:flex shrink-0"
        :aria-label="sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'"
        @click="$emit('update:sidebarOpen', !sidebarOpen)"
      />
      <UBreadcrumb
        :items="breadcrumbItems"
        class="hidden sm:flex min-w-0"
        :ui="{
          link: 'text-sm font-medium text-muted hover:text-default transition-colors',
          linkLeadingIcon: 'text-muted',
        }"
      >
        <template #item="{ item, index }">
          <component
            :is="item.to ? NuxtLink : 'span'"
            :to="item.to"
            class="flex items-center gap-1.5 text-sm min-w-0"
            :class="index === breadcrumbItems.length - 1 ? 'text-blue-700 font-semibold' : 'text-muted font-medium hover:text-default transition-colors'"
          >
            <UIcon v-if="item.icon" :name="item.icon" class="size-4 shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </component>
        </template>
      </UBreadcrumb>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <!-- Simulation Control - dev/demo-only affordance, clearly separated
           from the real notification bell next to it (title makes the
           distinction explicit), for pushing a fake HRIS/R24 change to see
           the resulting notification/badge/banner chain fire. -->
      <UPopover v-model:open="simOpen">
        <UButton
          icon="i-lucide-flask-conical"
          color="neutral"
          variant="ghost"
          size="sm"
          title="Simulate an employee record update (dev tool)"
          aria-label="Simulate an employee record update"
        />
        <template #content>
          <div class="p-4 flex flex-col gap-3 overflow-y-auto overscroll-contain fade-scroll-y" style="width: 20rem; max-height: calc(100vh - 6rem);">
            <div>
              <p class="text-sm font-semibold text-highlighted">Simulate Employee Record Update</p>
              <p class="text-xs text-muted mt-0.5">There is no live connection to employee records here. This pushes a fake Last Working Day change. Pick a ticket and date if you want a specific one, otherwise it uses your latest open ticket and a week later, or just shows the notification if you have none.</p>
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-700 block mb-1">Ticket <span class="font-normal text-muted">(optional)</span></label>
              <SharedSelect v-model="simTicketId" :items="openTicketOptions" placeholder="Latest open ticket" size="sm" class="w-full" />
            </div>
            <div>
              <label class="text-xs font-semibold text-gray-700 block mb-1">New Last Working Day <span class="font-normal text-muted">(optional)</span></label>
              <SharedDatePicker v-model="simNewLwd" size="sm" />
            </div>
            <UButton color="primary" size="sm" block @click="runSimulation">Push Simulated Update</UButton>
            <div class="pt-3 mt-1 border-t border-dashed border-default">
              <p class="text-xs font-semibold text-gray-700">Simulate a team member reply</p>
              <p class="text-xs text-muted mt-0.5 mb-2">Stands in for an Outlook connector. Always available. If a ticket is waiting on a branch reply it is flagged too.</p>
              <UButton color="primary" variant="outline" size="sm" icon="i-lucide-mail" block @click="runReplySimulation">Push Simulated Reply</UButton>
            </div>
            <div class="pt-3 mt-1 border-t border-dashed border-default">
              <p class="text-xs font-semibold text-gray-700">Notification types</p>
              <p class="text-xs text-muted mt-0.5 mb-2">Push any notification type to the bell, including signed form, acknowledgment and courier reply, or fill the panel with one of every type to see it full. No ticket needed.</p>
              <USelect v-model="simKind" :items="NOTIFICATION_KINDS" size="sm" class="w-full mb-2" />
              <UButton color="primary" variant="outline" size="sm" icon="i-lucide-bell-plus" block class="mb-2" @click="runDemoNotification">Push Notification</UButton>
              <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-layers" block @click="runDemoSet">Push One of Every Type</UButton>
            </div>
            <div class="pt-3 mt-1 border-t border-dashed border-default">
              <p class="text-xs font-semibold text-gray-700">Morning digest</p>
              <p class="text-xs text-muted mt-0.5 mb-2">Overdue, due soon, checklist, shipment and quotation alerts are emailed once at 8:00 AM, not one email each. Everything else emails straight away.</p>
              <p class="text-xs text-default mb-2">{{ waitingDigestCount }} {{ waitingDigestCount === 1 ? 'alert' : 'alerts' }} waiting for {{ currentUserName() }}'s digest.</p>
              <UButton color="primary" variant="outline" size="sm" icon="i-lucide-mail" block class="mb-2" @click="runSendDigest">Send Digest Now</UButton>
              <UButton v-if="lastDigest" color="neutral" variant="ghost" size="xs" block @click="showDigest(lastDigest)">View last digest</UButton>
            </div>
            <div class="pt-3 mt-1 border-t border-dashed border-default">
              <p class="text-xs font-semibold text-gray-700">Check for alerts now</p>
              <p class="text-xs text-muted mt-0.5 mb-2">Overdue, due soon, IT lock, checklist and similar alerts are checked every minute. Run it now to see them straight away.</p>
              <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-bell-ring" block @click="runAlertCheck">Run Alert Check</UButton>
            </div>
            <div class="pt-3 mt-1 border-t border-dashed border-default">
              <label class="text-xs font-semibold text-gray-700 block mb-1">Act as</label>
              <USelect :model-value="currentUserName()" :items="actAsOptions" size="sm" class="w-full" @update:model-value="switchUser" />
              <p class="text-xs text-muted mt-1.5">Demo only. Switch the Asset Team member to try assignments, My Tickets and taking a ticket over.</p>
            </div>
            <div class="pt-3 mt-1 border-t border-dashed border-default">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-gray-700">Allow sending with unresolved placeholders</p>
                  <p class="text-xs text-muted mt-0.5">Demo only. Lets a send go through so the next stages can be shown.</p>
                </div>
                <USwitch v-model="demoAllowUnresolved" size="sm" class="shrink-0 mt-0.5" aria-label="Allow sending with unresolved placeholders" />
              </div>
            </div>
            <div class="pt-3 mt-1 border-t border-dashed border-default">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-gray-700">Show the prototype controls bar</p>
                  <p class="text-xs text-muted mt-0.5">The dark strip above the app with State, Viewing as, Scenario and Situation.</p>
                </div>
                <USwitch v-model="showSimulatorBar" size="sm" class="shrink-0 mt-0.5" aria-label="Show the prototype controls bar" />
              </div>
            </div>
            <div class="pt-3 mt-1 border-t border-dashed border-default">
              <p class="text-xs text-muted mb-2">Blocked by the duplicate-open-ticket guardrail while testing? Reset everything below.</p>
              <UButton color="error" variant="outline" size="sm" icon="i-lucide-trash-2" block @click="onClearAllTickets">Clear All Tickets</UButton>
            </div>
          </div>
        </template>
      </UPopover>

      <UPopover v-model:open="notifOpen">
        <div class="relative inline-flex items-center justify-center shrink-0">
          <UButton icon="i-lucide-bell" color="neutral" variant="ghost" size="sm" title="Notifications" :aria-label="unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'" />
          <!-- Keyed on the count so it pops once whenever the number changes. -->
          <span
            v-if="unreadCount > 0"
            :key="unreadCount"
            class="notif-badge pointer-events-none absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[11px] font-semibold leading-none ring-2 ring-white"
            aria-hidden="true"
          >{{ unreadLabel }}</span>
        </div>
        <template #content>
          <div style="width: 30rem; max-width: calc(-2rem + 100vw);">
            <div class="flex items-center justify-between px-4 py-3">
              <p class="text-sm font-semibold text-highlighted">Notifications</p>
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-check-check"
                :class="unreadItems.length ? 'text-primary' : 'text-dimmed'"
                @click="markAllRead"
              >{{ unreadItems.length ? 'Mark all as read' : 'No unread' }}</UButton>
            </div>
            <UTabs v-model="notifTab" :items="notifTabs" :content="false" size="sm" variant="link" class="px-2 border-b border-default" />
            <div class="max-h-96 overflow-y-auto fade-scroll-y">
              <!-- Unread first, labelled; read below a separator, unlabelled. -->
              <template v-if="tabNotifications.length">
                <template v-for="(sec, si) in notifSections" :key="sec.key">
                  <div v-if="si > 0" class="h-2 bg-gray-50 border-y border-default" />
                  <h3 v-if="sec.label" class="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">{{ sec.label }}</h3>
                  <ul>
                    <li v-for="n in sec.items" :key="n.id">
                      <NuxtLink :to="n.ticketId ? `/ticket-tracker/${TICKETS[n.ticketId]?.ticketNumber ?? n.ticketId}` : '/ticket-tracker'" class="flex gap-3 items-center px-4 pt-3 pb-4 cursor-pointer transition-colors hover:bg-elevated" @click="openNotification(n.id)">
                        <span class="relative inline-flex items-center justify-center shrink-0 size-8 rounded-full" :class="notificationTone(n)">
                          <UIcon :name="notificationIcon(n.kind)" class="size-4" aria-hidden="true" />
                          <span v-if="!n.read" class="absolute -top-px -right-px size-2 rounded-full bg-primary ring-2 ring-white" aria-label="Unread" />
                        </span>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm truncate text-highlighted" :class="n.read ? 'font-normal' : 'font-semibold'">{{ n.title }}</p>
                          <p class="mt-0.5 text-[11px] text-dimmed">{{ n.when }}</p>
                        </div>
                      </NuxtLink>
                    </li>
                  </ul>
                </template>
              </template>
              <div v-else-if="myNotifications.length" class="flex flex-col items-center text-center gap-2 py-10 text-muted">
                <UIcon name="i-lucide-bell-off" class="size-5" />
                <span class="text-sm">{{ emptyTabLabel }}</span>
              </div>
              <div v-else class="flex flex-col items-center text-center gap-2 py-10 text-muted">
                <UIcon name="i-lucide-bell-off" class="size-5" />
                <span class="text-sm">No notifications yet</span>
              </div>
            </div>
          </div>
        </template>
      </UPopover>

      <!-- The morning digest email, as the assignee would receive it. -->
      <UModal v-model:open="digestOpen" title="Morning digest" description="This is the email the assignee receives, simulated here." :ui="{ content: 'max-w-lg' }">
        <template #body>
          <div v-if="digestShown" class="flex flex-col gap-4 text-sm">
            <div class="flex flex-col gap-1">
              <p class="text-xs text-muted">To</p>
              <p class="font-medium text-default">{{ digestShown.to.name }} &lt;{{ digestShown.to.email }}&gt;</p>
            </div>
            <div class="flex flex-col gap-1">
              <p class="text-xs text-muted">Subject</p>
              <p class="font-medium text-default">Asset Team digest: {{ digestShown.items.length }} {{ digestShown.items.length === 1 ? 'item needs' : 'items need' }} you today</p>
            </div>
            <ul class="divide-y divide-default border border-default rounded-lg">
              <li v-for="(it, i) in digestShown.items" :key="i" class="flex items-center gap-3 px-3 py-3">
                <span class="inline-flex items-center justify-center shrink-0 size-8 rounded-full" :class="notificationTone({ kind: it.kind, action: true })">
                  <UIcon :name="notificationIcon(it.kind)" class="size-4" aria-hidden="true" />
                </span>
                <div class="min-w-0">
                  <p class="font-medium text-default truncate">{{ it.title }}</p>
                  <p class="text-xs text-muted truncate">{{ it.description }}</p>
                </div>
              </li>
            </ul>
            <p class="text-xs text-muted">Sent at {{ new Date(digestShown.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) }}. Replies, signed forms and the IT lock never wait for the digest.</p>
          </div>
        </template>
      </UModal>

      <UButton
        icon="i-lucide-external-link"
        color="neutral"
        variant="ghost"
        size="sm"
        to="https://r24.go.team/"
        target="_blank"
        aria-label="Open Internal Dashboard"
      />
    </div>
  </header>
</template>
