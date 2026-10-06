<script setup lang="ts">
// Faithful port of the real DS.Sidebar component (components/Sidebar/Sidebar.jsx)
// found inside the compiled design-system bundle referenced by
// "Assets Sidebar (standalone).html" — NAV_ITEMS, icons, footer user card, and
// the --sidebar-* tokens are copied verbatim from that source.
import { ticketsNeedingAttention } from '~/data/ticketTrackers'

interface NavItem {
  id: string
  label: string
  icon: string
  to?: string
  children?: NavItem[]
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'i-lucide-layout-dashboard' },
  { id: 'assets', label: 'Assets', icon: 'i-lucide-box' },
  { id: 'move-asset', label: 'Move Asset', icon: 'i-lucide-truck' },
  { id: 'asset-removal', label: 'Asset Removal', icon: 'i-lucide-trash-2' },
  { id: 'locations', label: 'Locations', icon: 'i-lucide-map-pin' },
  { id: 'suppliers', label: 'Suppliers', icon: 'i-lucide-building-2' },
  { id: 'asset-models', label: 'Asset Models', icon: 'i-lucide-cpu' },
  { id: 'tech-packs', label: 'Tech Packs', icon: 'i-lucide-package' },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: 'i-lucide-file-text' },
  { id: 'it-workspace', label: 'IT Workspace', icon: 'i-lucide-wrench' },
  { id: 'ticket-tracker', label: 'Ticket Tracker', icon: 'i-lucide-ticket-check', to: '/ticket-tracker' },
  { id: 'master-data', label: 'Master Data', icon: 'i-lucide-database', to: '/master-data' },
  { id: 'templates', label: 'Templates', icon: 'i-lucide-mail', to: '/templates' },
  {
    id: 'forms',
    label: 'Forms',
    icon: 'i-lucide-file-stack',
    children: [{ id: 'gate-pass', label: 'Gate Pass', icon: 'i-lucide-key-round' }]
  },
  { id: 'clients', label: 'Clients', icon: 'i-lucide-briefcase' },
  { id: 'team-members', label: 'Team Members', icon: 'i-lucide-users' },
  { id: 'audits', label: 'Audits', icon: 'i-lucide-clipboard-check' }
]

interface Props {
  active?: string
  offboardingCount?: number
  clientRequestCount?: number
  userInitials?: string
  userName?: string
  userRole?: string
}

const props = withDefaults(defineProps<Props>(), {
  active: undefined,
  offboardingCount: 0,
  clientRequestCount: 0,
  userInitials: 'MT',
  userName: 'Maria Carmel A. Tabada',
  userRole: 'UI UX Designer'
})

// falls back to the route path when no explicit `active` prop is passed, so
// the highlighted nav item stays correct as new routed pages are added
const route = useRoute()
const active = computed(() => props.active ?? (
  route.path.startsWith('/master-data')
    ? 'master-data'
    : route.path.startsWith('/ticket-tracker') ? 'ticket-tracker' : 'templates'
))

const formsOpen = ref(active.value === 'forms' || active.value === 'gate-pass')

// Tickets with an unacknowledged HRIS/R24-driven change - a live count, not
// a prop, since TICKETS is a shared reactive store already imported
// directly wherever it's needed elsewhere in this app.
const ticketUpdateCount = computed(() => ticketsNeedingAttention().length)

const NuxtLinkComp = resolveComponent('NuxtLink')
</script>

<template>
  <aside
    class="hidden lg:flex flex-col shrink-0 h-screen sticky top-0 border-r border-default bg-white"
    style="width: 240px; min-width: 240px;"
  >
    <div class="h-(--ui-header-height) shrink-0 flex items-center gap-1.5 px-4">
      <img src="/img/logofull-default.svg" alt="GoTeam Assets Logo" class="h-8 w-auto mx-auto">
    </div>

    <nav class="flex-1 overflow-y-auto flex flex-col gap-px fade-scroll-y" style="padding: 8px 16px;">
      <template v-for="item in NAV_ITEMS" :key="item.id">
        <template v-if="item.children">
          <button
            type="button"
            class="flex items-center gap-1.5 w-full rounded-md text-left transition-colors"
            style="height: 32px; padding: 6px 10px;"
            :class="active === item.id ? 'bg-[rgb(239,246,255)] text-blue-700' : 'text-muted hover:bg-elevated hover:text-default'"
            @click="formsOpen = !formsOpen"
          >
            <UIcon :name="item.icon" class="size-[18px] shrink-0" />
            <span class="flex-1 min-w-0 truncate text-sm font-medium">{{ item.label }}</span>
            <UIcon
              name="i-lucide-chevron-down"
              class="size-4 shrink-0 transition-transform duration-200"
              :class="formsOpen && 'rotate-180'"
            />
          </button>
          <div
            v-if="formsOpen"
            class="flex flex-col gap-px ml-5 pl-2.5 border-l border-default"
          >
            <button
              v-for="child in item.children"
              :key="child.id"
              type="button"
              class="flex items-center gap-1.5 w-full rounded-md text-left transition-colors"
              style="height: 32px; padding: 6px 10px;"
              :class="active === child.id ? 'bg-[rgb(239,246,255)] text-blue-700' : 'text-muted hover:bg-elevated hover:text-default'"
            >
              <UIcon :name="child.icon" class="size-[18px] shrink-0" />
              <span class="flex-1 min-w-0 truncate text-sm font-medium">{{ child.label }}</span>
            </button>
          </div>
        </template>

        <component
          :is="item.to ? NuxtLinkComp : 'button'"
          v-else
          :to="item.to"
          :type="item.to ? undefined : 'button'"
          class="flex items-center gap-1.5 w-full rounded-md text-left transition-colors"
          style="height: 32px; padding: 6px 10px;"
          :class="active === item.id ? 'bg-[rgb(239,246,255)] text-blue-700' : 'text-muted hover:bg-elevated hover:text-default'"
        >
          <UIcon :name="item.icon" class="size-[18px] shrink-0" />
          <span class="flex-1 min-w-0 truncate text-sm font-medium">{{ item.label }}</span>
          <span
            v-if="item.id === 'ticket-tracker' && ticketUpdateCount"
            class="shrink-0 text-xs font-bold rounded-full px-1.5 py-0.5 text-center bg-error/10 text-error"
            style="min-width: 18px;"
          >
            {{ ticketUpdateCount }}
          </span>
        </component>
      </template>

      <button
        type="button"
        class="flex items-center gap-1.5 w-full rounded-md text-left transition-colors"
        style="height: 32px; padding: 6px 10px;"
        :class="active === 'offboarding' ? 'bg-[rgb(239,246,255)] text-blue-700' : 'text-muted hover:bg-elevated hover:text-default'"
      >
        <UIcon name="i-lucide-package-check" class="size-[18px] shrink-0" />
        <span class="flex-1 min-w-0 truncate text-sm font-medium">Offboarding Retrievals</span>
        <span
          v-if="offboardingCount"
          class="shrink-0 text-xs font-bold rounded-full px-1.5 py-0.5 text-center bg-[rgb(239,246,255)] text-blue-700"
          style="min-width: 18px;"
        >
          {{ offboardingCount }}
        </span>
      </button>

      <button
        type="button"
        class="flex items-center gap-1.5 w-full rounded-md text-left transition-colors"
        style="height: 32px; padding: 6px 10px;"
        :class="active === 'role-access-control' ? 'bg-[rgb(239,246,255)] text-blue-700' : 'text-muted hover:bg-elevated hover:text-default'"
      >
        <UIcon name="i-lucide-shield-check" class="size-[18px] shrink-0" />
        <span class="flex-1 min-w-0 truncate text-sm font-medium">Role Access Control</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-1.5 w-full rounded-md text-left transition-colors"
        style="height: 32px; padding: 6px 10px;"
        :class="active === 'client-request-releases' ? 'bg-[rgb(239,246,255)] text-blue-700' : 'text-muted hover:bg-elevated hover:text-default'"
      >
        <UIcon name="i-lucide-hand-coins" class="size-[18px] shrink-0" />
        <span class="flex-1 min-w-0 truncate text-sm font-medium">Client Request Releases</span>
        <span
          v-if="clientRequestCount"
          class="shrink-0 text-xs font-bold rounded-full px-1.5 py-0.5 text-center bg-[rgb(239,246,255)] text-blue-700"
          style="min-width: 18px;"
        >
          {{ clientRequestCount }}
        </span>
      </button>
    </nav>

    <div
      class="flex items-center gap-2.5 border-t shrink-0"
      style="height: 55px; padding: 10px 12px 12px; border-color: rgb(241,245,249);"
    >
      <div class="flex items-center justify-center size-8 rounded-full bg-elevated shrink-0">
        <span class="text-xs font-bold text-slate-600">{{ userInitials }}</span>
      </div>
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-sm font-semibold text-highlighted truncate">{{ userName }}</span>
        <span class="text-xs text-muted truncate">{{ userRole }}</span>
      </div>
    </div>
  </aside>
</template>
