// Assets list, asset detail and Move Asset: mock data layer for the Supplier Return and
// Client Pull-Out statuses. Front end only. The real build reads these from the Assets API,
// see DEV_DOC_supplier-return-client-pull-out.md for what each part maps to.
//
// Status names, lanes and colors for the existing statuses are copied from
// api/database/data/asset_statuses.php. Supplier Return and Client Pull-Out are the two new
// rows, both in the existing Terminal lane. Competitor and Direct Hire are the sub status
// options of Client Pull-Out.

import { escapeText } from '~/utils/escapeHtml'
import { DB_ASSETS, DB_ADDRESS, DB_COMPANY } from '~/data/assetsDbSeed'

export type TechPackType = 'Monthly Rental' | 'Outright Purchase' | 'BYOD'

export type StatusLane = 'intake_ready_pool' | 'active_use' | 'return_triage' | 'review_investigation' | 'decommissioning' | 'terminal'
export type StatusColor = 'green' | 'blue' | 'orange' | 'red' | 'yellow' | 'purple' | 'gray' | 'teal' | 'pink'
export type ExitKind = 'supplier' | 'client'

export const LANE_ORDER: StatusLane[] = ['intake_ready_pool', 'active_use', 'return_triage', 'review_investigation', 'decommissioning', 'terminal']
export const LANE_LABELS: Record<StatusLane, string> = {
  intake_ready_pool: 'Intake & Ready Pool',
  active_use: 'Active Use',
  return_triage: 'Return & Triage',
  review_investigation: 'Review & Investigation',
  decommissioning: 'Decommissioning',
  terminal: 'Terminal'
}

export interface StatusDef {
  name: string
  lane: StatusLane
  color: StatusColor
  subStatuses?: string[]
  /** Set on the two new exit statuses. */
  exit?: ExitKind
}

export const STATUSES: StatusDef[] = [
  { name: 'Available', lane: 'intake_ready_pool', color: 'green' },
  { name: 'For IT Configuration', lane: 'intake_ready_pool', color: 'blue' },
  { name: 'In Configuration', lane: 'intake_ready_pool', color: 'blue' },
  { name: 'Pending Deployment', lane: 'intake_ready_pool', color: 'orange' },
  { name: 'In Use', lane: 'active_use', color: 'blue' },
  { name: 'Pending Replacement', lane: 'active_use', color: 'orange' },
  { name: 'Scheduled Replacement', lane: 'active_use', color: 'orange' },
  { name: 'Pending Return', lane: 'return_triage', color: 'orange' },
  { name: 'Overdue Return', lane: 'return_triage', color: 'red' },
  { name: 'Hold Off', lane: 'return_triage', color: 'yellow' },
  { name: 'Returned Device Servicing', lane: 'return_triage', color: 'purple' },
  { name: 'Returned Item Check', lane: 'return_triage', color: 'purple' },
  { name: 'Warranty Processing', lane: 'return_triage', color: 'yellow' },
  { name: 'Forensic Review', lane: 'review_investigation', color: 'red' },
  { name: 'Under Investigation', lane: 'review_investigation', color: 'red' },
  { name: 'Decommissioned', lane: 'decommissioning', color: 'gray' },
  { name: 'Decommission Checking', lane: 'decommissioning', color: 'purple' },
  { name: 'For Disposal', lane: 'decommissioning', color: 'red' },
  { name: 'Pending Sale', lane: 'decommissioning', color: 'yellow' },
  { name: 'Disposed', lane: 'terminal', color: 'gray' },
  { name: 'Sold', lane: 'terminal', color: 'green', subStatuses: ['Buyout', 'Clearance Sale', 'Client-Authorized Sale'] },
  { name: 'Recovery Deduction', lane: 'terminal', color: 'green', subStatuses: ['Non-Return Recovery', 'Damage Recovery'] },
  { name: 'Charged Deduction', lane: 'terminal', color: 'orange' },
  { name: 'Gifted', lane: 'terminal', color: 'green', subStatuses: ['GoTeam-gifted', 'Client-gifted (Waived)'] },
  { name: 'Missing', lane: 'terminal', color: 'red', subStatuses: ['Lost in Inventory', 'Lost in Transit', 'Lost (cause undetermined)', 'Failure to Return', 'Stolen'] },
  // New. Colors are proposed (teal, pink): no existing status uses them. Confirm against the backend color list.
  { name: 'Supplier Return', lane: 'terminal', color: 'teal', exit: 'supplier' },
  { name: 'Client Pull-Out', lane: 'terminal', color: 'pink', subStatuses: ['Competitor', 'Direct Hire'], exit: 'client' }
]

/** The three asset types of the system, and the asset names under each (the Asset Name filter lists them once a type is picked). */
export const ASSET_TYPES = [
  { code: 'CE', label: 'Computer Equipment' },
  { code: 'FF', label: 'Furniture and Fixtures' },
  { code: 'OE', label: 'Office Equipment' }
]
export const ASSET_NAMES: Record<string, string[]> = {
  CE: ['Desktop', 'Display Adapter', 'Display Cable', 'Docking Station', 'Headset', 'Keyboard', 'Keyboard & Mouse', 'Laptop', 'Laptop Charger', 'Monitor', 'Mouse', 'Other Peripherals', 'USB Hub', 'Webcam'],
  FF: ['Cabinet / Pedestal', 'Chair / Sofa / Couch', 'Emergency Light', 'Foot Stool', 'Light / Fixture', 'Other Furniture and Fixtures', 'Rack', 'Table'],
  OE: ['Air conditioner (AC)', 'CCTV', 'Computer Table', 'Computer Workstation', 'Extension Wire', 'Microphone', 'Modem / Router / Access Point (AP)', 'Other Office Equipment', 'Printer', 'Professional Camera', 'Professional Camera Accessories', 'Projector', 'Shredder', 'Smoke alarm', 'Speakers', 'TV', 'TV accessories']
}

// Solid badge fills, copied verbatim from the live Assets app
// (models/CompanyAsset/StatusBadge.vue) so the table status reads identically.
export const STATUS_BG: Record<StatusColor, string> = {
  red: 'bg-red-700',
  green: 'bg-green-700',
  blue: 'bg-blue-700',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  purple: 'bg-purple-700',
  gray: 'bg-gray-600',
  // New, for the two exit statuses only. No existing status uses teal or pink, so neither exit can be
  // mistaken for another status (purple and gray were already taken).
  teal: 'bg-teal-700',
  pink: 'bg-pink-700'
}

// The date half of the badge: the status colour, much lighter (the asset detail design's light fill and text).
export const STATUS_LIGHT: Record<StatusColor, string> = {
  red: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  teal: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300'
}

export function statusDef(name: string): StatusDef | undefined {
  return STATUSES.find(s => s.name === name)
}
export function exitKindOf(statusName: string): ExitKind | undefined {
  return statusDef(statusName)?.exit
}
export function isExited(a: Pick<Asset, 'status'>): boolean {
  return !!exitKindOf(a.status)
}

export interface AssetDoc { name: string, type: string, size: number }

export interface HistoryEntry {
  id: string
  status: string
  sub?: string
  /** YYYY-MM-DD */
  date: string
  by: string
  note: string
  reason?: string
  doc?: AssetDoc
  /** Tag of the replacement unit (Supplier Return) or of the unit this one replaces. */
  replacement?: string
  replacementFor?: string
  /** The team member an In Use record was with, kept when the unit later leaves (the custodian field is cleared) */
  member?: string
  movement?: 'Check In' | 'Check Out'
  location?: string
}

export interface Asset {
  tag: string
  serial: string
  model: string
  name: string
  type: string
  status: string
  sub?: string
  statusDate: string
  techPack: TechPackType
  tier?: TechPackTier
  currency: string
  movementStatus: 'Checked In' | 'Checked Out'
  custodian: string
  client: string
  owner: string
  location: string
  po: string
  supplier: string
  cost: number
  warranty: 'Active Warranty' | 'Already Expired' | 'No Warranty'
  /** Purchase order date and the model's warranty length, when the database holds them; the warranty ends that many months after the order date */
  orderDate?: string
  warrantyMonths?: number
  history: HistoryEntry[]
}

// Registered addresses the exit movement records as the new location (a real address, not a label).
const SUPPLIER_ADDRESS: Record<string, string> = {
  'Northline IT Supply': 'Northline IT Supply, 88 Ayala Avenue, Makati City 1226',
  'Metro Peripherals': 'Metro Peripherals, 21 Shaw Boulevard, Mandaluyong City 1552'
}
const CLIENT_ADDRESS: Record<string, string> = {
  'Fabrikam Logistics': 'Fabrikam Logistics, Unit 12, 3rd Avenue corner 30th Street, Bonifacio Global City, Taguig 1634',
  'Northwind Health': 'Northwind Health, 6750 Ayala Avenue, Makati City 1226',
  'Contoso Realty': 'Contoso Realty, 5th Avenue corner 26th Street, Bonifacio Global City, Taguig 1634'
}

export type TechPackTier = 'Standard' | 'High Performance' | 'Ultra Performance'
export const TIER_SHORT: Record<TechPackTier, string> = { 'Standard': 'Standard', 'High Performance': 'High', 'Ultra Performance': 'Ultra' }

// Badge styles for the tech pack cell, copied from the dashboard's badge system (soft plan, outline tier).
export const TECH_PACK_STYLE: Record<string, { cls: string, icon: string, short: string }> = {
  'Monthly Rental': { cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900', icon: 'i-lucide-repeat', short: 'Rental' },
  'Outright Purchase': { cls: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900', icon: 'i-lucide-badge-check', short: 'Purchase' },
  'BYOD': { cls: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-900', icon: 'i-lucide-laptop', short: 'BYOD' }
}
export const TIER_STYLE: Record<TechPackTier, string> = {
  'Standard': 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
  'High Performance': 'border-green-300 text-green-700 dark:border-green-800 dark:text-green-300',
  'Ultra Performance': 'border-violet-300 text-violet-700 dark:border-violet-800 dark:text-violet-300'
}
const TIER_BY_TAG: Record<string, TechPackTier> = {
  'GT-CE-LTP-1233-0926-0013': 'High Performance',
  'GT-CE-LTP-1180-0326-0042': 'Standard',
  'GT-CE-LTP-1240-1026-0001': 'High Performance',
  'GT-CE-LTP-1240-1026-0002': 'Standard',
  'GT-CE-LTP-1240-1026-0003': 'Standard',
  'GT-CE-LTP-1240-1026-0004': 'Standard',
  'GT-CE-LTP-1126-0008': 'Standard',
  'GT-CE-LTP-1226-0009': 'Ultra Performance',
  'GT-CE-MNT-1026-0011': 'Standard',
  'GT-CE-LTP-0826-0005': 'High Performance'
}

// Asset type icons, from the backend asset types (fontawesome_icon). Computer Equipment is
// fa-computer-speaker; the closest Lucide glyph is used because this prototype ships Lucide, not Font Awesome.
export const TYPE_ICON: Record<string, string> = {
  'Computer Equipment': 'i-lucide-monitor-speaker'
}

// A team member's current address. The live list shows it as the location of any asset in use by them.
const MEMBER_ADDRESS: Record<string, string> = {
  ...DB_ADDRESS,
  'Mara Lim': '14 Kamias Road, Barangay Kamuning, Quezon City 1103',
  'Bea Ramos': '28 Maginhawa Street, Teachers Village East, Quezon City 1101',
  'Carlo Diaz': '9 Mabini Street, Barangay Poblacion, Makati City 1210',
  'Ines Valdez': '52 Aguinaldo Highway, Barangay Anabu, Imus, Cavite 4103',
  'Kimberly M. Tolentino': 'Blk 5 Lot 12, Camella Homes, Talisay City, 6045 Cebu',
  'Marco B. Santos': '12 Escario Street, Capitol Site, Cebu City, 6000 Cebu',
  'Jasmine R. Ilagan': 'Unit 3, One Mabolo Place, Mabolo, Cebu City, 6000 Cebu',
  'Franklin L. Lumapas': '88 F. Cabahug Street, Kasambagan, Cebu City, 6000 Cebu',
  'Elena V. Cruz': '45 Punta Princesa Road, Punta Princesa, Cebu City, 6000 Cebu',
  'Lesther L. Montermoso': 'Blk 3 Lot 8, Vista Grande Subdivision, Talisay City, 6045 Cebu',
  'Princess Z. Fabrero': 'Blk 7 Lot 3, Vera Estate, Mandaue City, 6014 Cebu',
  'Ramon Jay F. Canizares': '18 M.J. Cuenco Avenue, Sto. Nino, Cebu City, 6000 Cebu'
}

/** The client company a team member works for, shown beside their name in the Checked Out To filter. */
export function memberCompany(name: string): string {
  return DB_COMPANY[name] ?? ''
}

/** A team member's current address; the custody history shows it as where the unit was kept. */
export function memberAddress(name: string): string {
  return MEMBER_ADDRESS[name] ?? `${name}, address on file`
}

export type LocationKind = 'member' | 'location' | 'supplier' | 'client'
export interface LocationView { kind: LocationKind, text: string, icon: string, tip: string }

/** The live list's location rule: with the team member (their address), at a supplier, with the client, else at a GoTeam location. */
export function locationView(a: { status: string, custodian: string, client: string, supplier: string, location: string }): LocationView {
  if (a.status === 'Supplier Return') return { kind: 'supplier', text: a.supplier, icon: 'i-lucide-truck', tip: 'Asset is located at the supplier facility' }
  if (a.status === 'Client Pull-Out') return { kind: 'client', text: a.client, icon: 'i-lucide-building-2', tip: 'Asset was pulled out by the client' }
  if (a.status === 'In Use' && a.custodian) {
    return { kind: 'member', text: MEMBER_ADDRESS[a.custodian] ?? a.location, icon: 'i-lucide-house', tip: 'Asset is based on the team member\'s current address' }
  }
  return { kind: 'location', text: a.location, icon: 'i-lucide-building', tip: 'Asset is based on the asset location' }
}

const OWNER = 'GoTeam'
const intake = (by: string, po: string): HistoryEntry => ({ id: `h-${po}`, status: 'Available', date: '2026-10-14', by, note: `Received on ${po}` })

function withTiers(list: Asset[]): Asset[] {
  return list.map(a => ({ ...a, tier: TIER_BY_TAG[a.tag] }))
}

function seed(): Asset[] {
  return withTiers([
    {
      tag: 'GT-CE-LTP-1233-0926-0013', serial: '5CG4SIM2HQ', model: 'HP ProBook 440 G10', name: 'Laptop', type: 'Computer Equipment',
      status: 'In Use', statusDate: '2026-10-14', techPack: 'Monthly Rental', currency: 'PHP', movementStatus: 'Checked Out',
      custodian: 'Mara Lim', client: 'Northwind Health', owner: OWNER, location: 'Northwind Health · Makati office', po: 'PO-4178401',
      supplier: 'Northline IT Supply', cost: 8032.18, warranty: 'Active Warranty',
      history: [intake('Jerrell Pardo', 'PO-4178401'), { id: 'h-1233-2', status: 'In Use', date: '2026-10-14', by: 'Jerrell Pardo', note: 'Checked out on ticket 811' }]
    },
    {
      tag: 'GT-CE-LTP-1180-0326-0042', serial: 'PF4SIM0R7', model: 'Lenovo ThinkPad E14', name: 'Laptop', type: 'Computer Equipment',
      status: 'In Use', statusDate: '2026-10-14', techPack: 'Outright Purchase', currency: 'PHP', movementStatus: 'Checked Out',
      custodian: 'Bea Ramos', client: 'Contoso Realty', owner: OWNER, location: 'Contoso Realty · BGC office', po: 'PO-6895557',
      supplier: 'Northline IT Supply', cost: 6696.11, warranty: 'Active Warranty',
      history: [intake('Jerrell Pardo', 'PO-6895557'), { id: 'h-1180-2', status: 'In Use', date: '2026-10-14', by: 'Jerrell Pardo', note: 'Checked out on ticket 790' }]
    },
    {
      tag: 'GT-CE-MNT-1151-0426-0037', serial: 'UK0260SIM62', model: 'Philips 22E1N1100', name: 'Monitor', type: 'Computer Equipment',
      status: 'In Use', statusDate: '2026-10-14', techPack: 'BYOD', currency: 'PHP', movementStatus: 'Checked Out',
      custodian: 'Carlo Diaz', client: 'Contoso Realty', owner: 'Contoso Realty', location: 'Contoso Realty · BGC office', po: 'PO-2230112',
      supplier: 'Metro Peripherals', cost: 0, warranty: 'No Warranty',
      history: [intake('Jerrell Pardo', 'PO-2230112'), { id: 'h-1151-2', status: 'In Use', date: '2026-10-14', by: 'Jerrell Pardo', note: 'Checked out on ticket 802' }]
    },
    {
      tag: 'GT-CE-LTP-1240-1026-0001', serial: '5CD5SIM140', model: 'HP ProBook 440 G11', name: 'Laptop', type: 'Computer Equipment',
      status: 'For IT Configuration', statusDate: '2026-10-14', techPack: 'Outright Purchase', currency: 'PHP', movementStatus: 'Checked In',
      custodian: '', client: '', owner: OWNER, location: 'i1 Building 9th Floor · Asset Room', po: 'PO-1240',
      supplier: 'Northline IT Supply', cost: 7421.5, warranty: 'Active Warranty',
      history: [{ id: 'h-1240-1', status: 'For IT Configuration', date: '2026-10-14', by: 'Jerrell Pardo', note: 'Received on PO-1240' }]
    },
    {
      tag: 'GT-CE-LTP-1240-1026-0002', serial: '8CC6SIM221', model: 'Dell Latitude 5440', name: 'Laptop', type: 'Computer Equipment',
      status: 'In Configuration', statusDate: '2026-10-15', techPack: 'Monthly Rental', currency: 'PHP', movementStatus: 'Checked In',
      custodian: '', client: '', owner: OWNER, location: 'i1 Building 9th Floor · IT Bench', po: 'PO-1240',
      supplier: 'Northline IT Supply', cost: 8221.63, warranty: 'Active Warranty',
      history: [{ id: 'h-1240b-1', status: 'In Configuration', date: '2026-10-15', by: 'Jerrell Pardo', note: 'Moved to the IT bench' }]
    },
    {
      tag: 'GT-CE-LTP-1240-1026-0003', serial: 'LNV3SIM907', model: 'Lenovo ThinkPad E14 Gen 5', name: 'Laptop', type: 'Computer Equipment',
      status: 'Available', statusDate: '2026-10-16', techPack: 'Outright Purchase', currency: 'PHP', movementStatus: 'Checked In',
      custodian: '', client: '', owner: OWNER, location: 'i1 Building 9th Floor · Asset Room', po: 'PO-1240',
      supplier: 'Northline IT Supply', cost: 7678.03, warranty: 'Active Warranty',
      history: [{ id: 'h-1240c-1', status: 'Available', date: '2026-10-16', by: 'Jerrell Pardo', note: 'Ready for deployment' }]
    },
    {
      tag: 'GT-CE-LTP-1240-1026-0004', serial: 'LNV3SIM908', model: 'Lenovo ThinkPad E14 Gen 5', name: 'Laptop', type: 'Computer Equipment',
      status: 'Available', statusDate: '2026-10-16', techPack: 'Outright Purchase', currency: 'PHP', movementStatus: 'Checked In',
      custodian: '', client: '', owner: OWNER, location: 'i1 Building 9th Floor · Asset Room', po: 'PO-1240',
      supplier: 'Northline IT Supply', cost: 7678.03, warranty: 'Active Warranty',
      history: [{ id: 'h-1240d-1', status: 'Available', date: '2026-10-16', by: 'Jerrell Pardo', note: 'Ready for deployment' }]
    },
    {
      tag: 'GT-CE-LTP-1126-0008', serial: 'VGYNFI3Z26', model: 'Asus Vivobook 14', name: 'Laptop', type: 'Computer Equipment',
      status: 'Decommission Checking', statusDate: '2026-10-23', techPack: 'Monthly Rental', currency: 'PHP', movementStatus: 'Checked In',
      custodian: '', client: '', owner: OWNER, location: 'i1 Building 9th Floor · Asset Room', po: 'PO-2235188',
      supplier: 'Brown, Steuber and Koepp', cost: 8477.08, warranty: 'Already Expired',
      history: [{ id: 'h-1126-8', status: 'Decommission Checking', date: '2026-10-23', by: 'Jerrell Pardo', note: 'Unit retired by IT, checking before decommission' }]
    },
    {
      tag: 'GT-CE-LTP-1226-0009', serial: 'BKVJMC28Q2', model: 'Lenovo Swift 968Pro', name: 'Laptop', type: 'Computer Equipment',
      status: 'Returned Device Servicing', statusDate: '2026-10-23', techPack: 'Outright Purchase', currency: 'PHP', movementStatus: 'Checked In',
      custodian: '', client: '', owner: OWNER, location: 'i1 Building 9th Floor · IT Bench', po: 'PO-4178402',
      supplier: 'Brown, Steuber and Koepp', cost: 8032.18, warranty: 'Active Warranty',
      history: [{ id: 'h-1226-9', status: 'Returned Device Servicing', date: '2026-10-23', by: 'Jerrell Pardo', note: 'Returned by the team member, sent for servicing' }]
    },
    {
      tag: 'GT-CE-MNT-1026-0011', serial: 'DLP24SIM11', model: 'Dell P2422H', name: 'Monitor', type: 'Computer Equipment',
      status: 'Pending Deployment', statusDate: '2026-10-22', techPack: 'Outright Purchase', currency: 'PHP', movementStatus: 'Checked In',
      custodian: '', client: '', owner: OWNER, location: 'i1 Building 9th Floor · Asset Room', po: 'PO-7330336',
      supplier: 'Metro Peripherals', cost: 1624.34, warranty: 'Active Warranty',
      history: [{ id: 'h-1026-11', status: 'Pending Deployment', date: '2026-10-22', by: 'Jerrell Pardo', note: 'Reserved for the Contoso Realty rollout' }]
    },
    {
      tag: 'GT-CE-LTP-0826-0005', serial: 'HPZ8SIM555', model: 'HP EliteBook 840 G9', name: 'Laptop', type: 'Computer Equipment',
      status: 'Supplier Return', statusDate: '2026-10-09', techPack: 'Outright Purchase', currency: 'PHP', movementStatus: 'Checked In',
      custodian: '', client: '', owner: OWNER, location: SUPPLIER_ADDRESS['Northline IT Supply']!, po: 'PO-3380127',
      supplier: 'Northline IT Supply', cost: 9120.4, warranty: 'Active Warranty',
      history: [
        { id: 'h-0826-5a', status: 'Available', date: '2026-08-26', by: 'Jerrell Pardo', note: 'Received on PO-3380127' },
        {
          id: 'h-0826-5b', status: 'Supplier Return', date: '2026-10-09', by: 'Karl Bustillo', note: 'Battery swelling on arrival',
          reason: 'Battery swelling on arrival. The supplier agreed to take the unit back and send a replacement.',
          doc: { name: 'northline-return-agreement.pdf', type: 'application/pdf', size: 184320 }, movement: 'Check In', location: SUPPLIER_ADDRESS['Northline IT Supply']!
        }
      ]
    },
    {
      tag: 'GT-CE-LTP-0726-0002', serial: 'LNV9SIM402', model: 'Lenovo ThinkPad T14', name: 'Laptop', type: 'Computer Equipment',
      status: 'Client Pull-Out', sub: 'Direct Hire', statusDate: '2026-10-20', techPack: 'BYOD', currency: 'PHP', movementStatus: 'Checked Out',
      custodian: 'Ines Valdez', client: 'Fabrikam Logistics', owner: 'Fabrikam Logistics', location: CLIENT_ADDRESS['Fabrikam Logistics']!, po: 'PO-2290031',
      supplier: 'Metro Peripherals', cost: 0, warranty: 'No Warranty',
      history: [
        { id: 'h-0726-2a', status: 'In Use', date: '2026-07-26', by: 'Jerrell Pardo', note: 'Checked out on ticket 641' },
        {
          id: 'h-0726-2b', status: 'Client Pull-Out', sub: 'Direct Hire', date: '2026-10-20', by: 'Karl Bustillo', note: '',
          reason: 'Fabrikam Logistics moved this team member to their own payroll on 20 Oct.',
          doc: { name: 'client-instruction-email.pdf', type: 'application/pdf', size: 96256 }, movement: 'Check Out', location: CLIENT_ADDRESS['Fabrikam Logistics']!
        }
      ]
    }
  ]).concat(DB_ASSETS.map(a => structuredClone(a))).map(withWarrantyDemo)
}

// Four units carry a warranty that ends soon or has ended, so the "Warranty ending in 90 days" card and the Warranty
// Status filter have something to show; the database units all run past a year. Days are counted from today.
const WARRANTY_DEMO: Record<string, number> = { 'GT-CE-LTP-1180-0326-0042': 20, 'GT-CE-LTP-1240-1026-0001': 55, 'GT-CE-LTP-1240-1026-0002': 85, 'GT-CE-LTP-1240-1026-0003': -40 }
function withWarrantyDemo(a: Asset): Asset {
  const left = WARRANTY_DEMO[a.tag]
  if (left === undefined) return a
  const end = new Date(`${localToday()}T00:00:00`)
  end.setDate(end.getDate() + left)
  return { ...a, warranty: left < 0 ? 'Already Expired' : 'Active Warranty', warrantyMonths: 12, orderDate: isoOf(addMonths(end, -12)) }
}

// ---------------------------------------------------------------------------
// Store. Persisted per browser so a review survives a reload. "Reset sample data" in the
// prototype controls clears it. Attached files are never stored, only their name, type and
// size, so a document opens only in the session that attached it.
// ---------------------------------------------------------------------------
const STORAGE_KEY = 'ams:assets:v4'

export const ASSETS = reactive<Record<string, Asset>>(Object.fromEntries(seed().map(a => [a.tag, a])))
/** Object URLs for files attached in this session, by history entry id. Not persisted. */
export const DOC_URLS = reactive<Record<string, string>>({})

const SAMPLE_URLS: Record<string, string> = {}
function sampleDocBlob(doc: { name: string, type: string }): Blob {
  // The name is user text: escaped for the SVG (XML), and for the PDF string (backslash and parentheses).
  const label = escapeText(doc.name)
  const pdfLabel = doc.name.replace(/[^\x20-\x7E]/g, '?').replace(/([\\()])/g, '\\$1')
  if (doc.type.startsWith('image/')) {
    return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"><rect width="640" height="420" fill="#f8fafc"/><text x="320" y="200" text-anchor="middle" font-family="Inter,sans-serif" font-size="22" fill="#0f172a">${label}</text><text x="320" y="236" text-anchor="middle" font-family="Inter,sans-serif" font-size="14" fill="#64748b">Sample image for the prototype</text></svg>`], { type: 'image/svg+xml' })
  }
  const body = `BT /F1 20 Tf 72 700 Td (${pdfLabel}) Tj 0 -30 Td /F1 12 Tf (Sample document for the prototype. The real file opens here in the full system.) Tj ET`
  const pdf = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${body.length}>>stream\n${body}\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF`
  return new Blob([pdf], { type: 'application/pdf' })
}
/** Opens an attached document in a new tab. */
export function openDoc(id: string, doc: { name: string, type: string }): void {
  let url = DOC_URLS[id]
  if (!url) url = SAMPLE_URLS[id] ?? (SAMPLE_URLS[id] = URL.createObjectURL(sampleDocBlob(doc)))
  window.open(url, '_blank', 'noopener')
}

const isStr = (v: unknown): v is string => typeof v === 'string'
function validHistory(h: unknown): h is HistoryEntry[] {
  return Array.isArray(h) && h.every(e => e && typeof e === 'object' && isStr(e.id) && isStr(e.status) && !!statusDef(e.status) && /^[\w-]+$/.test(e.id) && e.id !== '__proto__' && isStr(e.date) && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && isStr(e.by) && isStr(e.note)
    && [e.reason, e.sub, e.member, e.location, e.replacement, e.replacementFor].every(v => v === undefined || isStr(v)) && (e.movement === undefined || e.movement === 'Check In' || e.movement === 'Check Out')
    && (e.doc === undefined || (e.doc && isStr(e.doc.name) && isStr(e.doc.type) && typeof e.doc.size === 'number')))
}
/** Only these fields are read back from storage, and only when they have the right shape. */
const SAVED_TEXT: (keyof Asset)[] = ['serial', 'model', 'statusDate', 'currency', 'custodian', 'client', 'owner', 'location', 'po', 'supplier']
export function hydrateAssetsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as Record<string, Partial<Asset>>
    if (!saved || typeof saved !== 'object') return
    for (const tag of Object.keys(saved)) {
      const a = saved[tag]
      if (!Object.hasOwn(ASSETS, tag) || !a || typeof a !== 'object') continue
      if (!isStr(a.status) || !statusDef(a.status) || !validHistory(a.history) || typeof a.cost !== 'number') continue
      const target = ASSETS[tag]!
      for (const k of SAVED_TEXT) if (isStr(a[k])) (target as unknown as Record<string, unknown>)[k] = a[k]
      target.status = a.status
      target.sub = isStr(a.sub) ? a.sub : undefined
      target.cost = a.cost
      if (isStr(a.techPack) && Object.hasOwn(TECH_PACK_STYLE, a.techPack)) target.techPack = a.techPack as Asset['techPack']
      if (a.movementStatus === 'Checked In' || a.movementStatus === 'Checked Out') target.movementStatus = a.movementStatus
      target.history = a.history
    }
  } catch { /* unreadable snapshot: keep the sample data */ }
}
export function watchAssetsToStorage() {
  watch(ASSETS, (v) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)) } catch { /* storage unavailable: lasts for this session */ }
  }, { deep: true })
}
export function resetAssets() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* nothing to clear */ }
  for (const a of seed()) ASSETS[a.tag] = a
  for (const k of Object.keys(DOC_URLS)) { URL.revokeObjectURL(DOC_URLS[k]!); delete DOC_URLS[k] }
  for (const k of Object.keys(SAMPLE_URLS)) { URL.revokeObjectURL(SAMPLE_URLS[k]!); delete SAMPLE_URLS[k] }
}

export function findAsset(tag: string): Asset | undefined {
  // hasOwn: a tag such as 'constructor' or '__proto__' must not resolve to something on the prototype chain.
  return Object.hasOwn(ASSETS, tag) ? ASSETS[tag] : undefined
}
export function allAssets(): Asset[] {
  return Object.values(ASSETS)
}

// ---------------------------------------------------------------------------
// Exit rules
// ---------------------------------------------------------------------------
export const MAX_DOC_BYTES = 10 * 1024 * 1024
export const DOC_ACCEPT = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'

/** Client Pull-Out applies to Outright Purchase and BYOD units only. */
export function canPullOut(a: Pick<Asset, 'techPack'>): boolean {
  return a.techPack !== 'Monthly Rental'
}

// Why Client Pull-Out is blocked on a given unit, or '' when it is allowed.
export function pullOutReason(a: Pick<Asset, 'techPack'>): string {
  return canPullOut(a) ? '' : `Only Outright Purchase and BYOD units can be pulled out by the client. This unit is ${a.techPack}.`
}

// Options for the New Status picker. This prototype implements the two new exit statuses, so the
// other lifecycle statuses are shown disabled (plainly, no info affordance). Only Client Pull-Out
// carries the info button and the eligibility explanation, and only when the unit isn't eligible.
export interface StatusOption { name: string, lane: StatusLane, disabled: boolean, info?: boolean, reason?: string }
export function statusPickerOptions(a: Pick<Asset, 'techPack'>): StatusOption[] {
  return STATUSES.map((s): StatusOption => {
    if (s.exit === 'supplier') return { name: s.name, lane: s.lane, disabled: false }
    if (s.exit === 'client') {
      const reason = pullOutReason(a)
      return { name: s.name, lane: s.lane, disabled: !!reason, info: !!reason, reason: reason || undefined }
    }
    return { name: s.name, lane: s.lane, disabled: true }
  })
}

/** The refusal message for a file that can't be attached, or '' when it is fine. */
export function docProblem(file: { name: string, type: string, size: number }): string {
  const okType = file.type === 'application/pdf' || file.type === 'image/jpeg' || file.type === 'image/png'
  if (!okType) return `${file.name} can't be attached. Use a PDF or an image (JPG or PNG), for example a printed email or a photo of it.`
  if (file.size > MAX_DOC_BYTES) return `${file.name} is over 10 MB. Attach a smaller PDF or image.`
  return ''
}

export interface ExitForm {
  date: string
  reason: string
  note: string
  sub: string
  replacement: string
  file: File | null
}

export function emptyExitForm(): ExitForm {
  return { date: localToday(), reason: '', note: '', sub: '', replacement: '', file: null }
}

/** What is still missing before the move can be saved, named for the officer. */
export type MissingKey = 'date' | 'sub' | 'file' | 'reason'
/** The same checks as missingForExit, as field keys, so the form can mark each missing field. */
export function missingKeys(kind: ExitKind, f: ExitForm): MissingKey[] {
  const out: MissingKey[] = []
  if (!f.date) out.push('date')
  if (kind === 'client' && !f.sub) out.push('sub')
  if (!f.file) out.push('file')
  if (!f.reason.trim()) out.push('reason')
  return out
}

export function missingForExit(kind: ExitKind, f: ExitForm): string[] {
  const out: string[] = []
  if (!f.date) out.push('the date')
  if (kind === 'client' && !f.sub) out.push('why the client pulled it out')
  if (!f.file) out.push(kind === 'supplier' ? 'the supplier return agreement' : 'the client instruction')
  if (!f.reason.trim()) out.push('the reason')
  return out
}

/** Movement and location follow the status: back to the supplier, or out to the client. */
export function exitMovement(kind: ExitKind, a: Asset): { movement: 'Check In' | 'Check Out', location: string } {
  return kind === 'supplier'
    ? { movement: 'Check In', location: SUPPLIER_ADDRESS[a.supplier] ?? a.supplier }
    : { movement: 'Check Out', location: CLIENT_ADDRESS[a.client] ?? a.client }
}

/** Units a Supplier Return can be linked to: in stock, not already a replacement. */
export function replacementCandidates(forTag: string): Asset[] {
  return allAssets().filter(a => a.tag !== forTag && a.status === 'Available' && !a.history.some(h => h.replacementFor))
}

let seq = 0
function newId() { return `h-${Date.now().toString(36)}-${seq++}` }

/**
 * Days until the warranty ends, negative once it has ended, or null for a unit with no manufacturer warranty.
 * The order date plus the model's warranty months, or a year from the first record when the unit has no order date.
 */
/** Add whole months, keeping the day inside the target month (31 Jan plus one month is 28 Feb, not 3 Mar). */
export function addMonths(d: Date, n: number): Date {
  const out = new Date(d)
  const day = out.getDate()
  out.setDate(1)
  out.setMonth(out.getMonth() + n)
  out.setDate(Math.min(day, new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate()))
  return out
}
export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function warrantyDaysLeft(a: Asset, today: string): number | null {
  if (a.warranty === 'No Warranty') return null
  let end = new Date(`${a.orderDate ?? a.history[0]?.date ?? a.statusDate}T00:00:00`)
  if (a.orderDate && a.warrantyMonths) end = addMonths(end, a.warrantyMonths)
  else end = addMonths(end, a.warranty === 'Already Expired' ? -12 : 12)
  return Math.round((end.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000)
}

export function localToday(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export interface ExitPayload { kind: ExitKind, form: ExitForm, by: string }

export function exitAsset(tag: string, p: ExitPayload): Asset | undefined {
  const a = ASSETS[tag]
  // A unit that has already left cannot exit again, so a double click on Confirm adds one record, not two.
  if (!a || !p.form.file || isExited(a)) return undefined
  const def = STATUSES.find(s => s.exit === p.kind)!
  const { movement, location } = exitMovement(p.kind, a)
  const id = newId()
  const doc: AssetDoc = { name: p.form.file.name, type: p.form.file.type, size: p.form.file.size }
  DOC_URLS[id] = URL.createObjectURL(p.form.file)
  const sub = p.kind === 'client' ? p.form.sub : undefined
  const replacement = p.kind === 'supplier' && p.form.replacement ? p.form.replacement : undefined
  a.history.push({
    id, status: def.name, sub, date: p.form.date, by: p.by, note: p.form.note.trim(), reason: p.form.reason.trim(),
    doc, replacement, movement, location
  })
  // Keep who held the unit before it left, so Movements and Custody History still know.
  for (const h of a.history) if (h.status === 'In Use' && !h.member) h.member = a.custodian
  a.status = def.name
  a.sub = sub
  a.statusDate = p.form.date
  a.location = location
  a.movementStatus = movement === 'Check In' ? 'Checked In' : 'Checked Out'
  if (p.kind === 'supplier') { a.custodian = ''; a.client = '' }
  const rep = replacement ? ASSETS[replacement] : undefined
  if (rep) {
    rep.history.push({ id: newId(), status: rep.status, date: p.form.date, by: p.by, note: `Linked as the replacement for ${a.tag}`, replacementFor: a.tag })
  }
  return a
}

/** "2026, Oct 23", the date format of the live status badge. */
export function badgeDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).replace(/^(\w+) (\d+), (\d+)$/, '$3, $1 $2')
}

export function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// ---------------------------------------------------------------------------
// Prototype controls (verification scaffolding, not part of the product)
// ---------------------------------------------------------------------------
export type AssetsSimState = 'populated' | 'loading' | 'notfound'
export type AssetsSimRole = 'officer' | 'viewer'
export type AssetsSimScenario = 'standard' | 'empty'

export const assetsSimState = ref<AssetsSimState>('populated')
export const assetsSimRole = ref<AssetsSimRole>('officer')
export const assetsSimScenario = ref<AssetsSimScenario>('standard')

// Asset detail only: what the Custody History, Warranty and Current Movement cards show. 'data' is the
// real, derived behaviour; the others force a state so each can be reviewed.
export type AssetsSimCustody = 'data' | 'empty' | 'single-open' | 'single-closed' | 'long'
export type AssetsSimWarranty = 'data' | 'needs-po' | 'active' | 'expiring' | 'expired'
export type AssetsSimTransit = 'data' | 'transit' | 'inuse'
export const assetsSimCustody = ref<AssetsSimCustody>('data')
export const assetsSimWarranty = ref<AssetsSimWarranty>('data')
export const assetsSimTransit = ref<AssetsSimTransit>('data')

export const CURRENT_OFFICER = 'Karl Bustillo'
