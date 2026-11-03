// Derived views over one asset's history, so a move made on the Move Asset page shows up in the asset
// detail's Activity Feed, Movements and Custody History tabs without a second source of truth. In the
// real system these are separate backend records (activities, asset_movements); here they are computed
// from `Asset.history`, so the dev can replace each function with the API call of the same name.
import { DB_EMP_NO } from '~/data/assetsDbSeed'
import { locationView, memberAddress, memberCompany, assetsSimCustody, assetsSimTransit, type Asset, type HistoryEntry } from '~/data/assets'

export interface AssetMovementRow {
  id: string
  type: 'check_in' | 'check_out'
  /** YYYY-MM-DD */
  date: string
  /** The team member the asset is checked out to, if any */
  member: string
  by: string
  location: string
  locationIcon: string
  locationTip: string
  note: string
  /** The status the movement set, when it came with one */
  status?: string
  sub?: string
  doc?: HistoryEntry['doc']
}

const INTAKE_LOCATION = 'i1 Building 9th Floor · Asset Room'

/** Movements, newest first. An exit carries its own movement; intake is a check in; In Use is a check out. */
export function movementsOf(a: Asset): AssetMovementRow[] {
  const rows: AssetMovementRow[] = []
  a.history.forEach((h, i) => {
    if (h.movement) {
      const out = h.movement === 'Check Out'
      const view = locationView({ status: h.status, custodian: '', client: a.client, supplier: a.supplier, location: h.location ?? '', locationKind: h.locationKind })
      // A move names who it checked the unit out to; an older Client Pull-Out record keeps the custodian.
      const who = out ? (h.member ?? (h.status === 'Client Pull-Out' ? a.custodian : '')) : ''
      rows.push({
        id: h.id, type: out ? 'check_out' : 'check_in', date: h.date, member: who, by: h.by,
        location: h.location ?? view.text, locationIcon: view.icon, locationTip: view.tip, note: h.reason || h.note, status: h.status, sub: h.sub, doc: h.doc
      })
    } else if (h.status === 'In Use' && (h.member ?? a.custodian)) {
      const who = (h.member ?? a.custodian)
      const view = locationView({ status: 'In Use', custodian: who, client: a.client, supplier: a.supplier, location: a.location })
      rows.push({ id: h.id, type: 'check_out', date: h.date, member: who, by: h.by, location: view.text, locationIcon: view.icon, locationTip: view.tip, note: h.note, status: h.status })
    } else if (i === 0) {
      const view = locationView({ status: h.status, custodian: '', client: '', supplier: '', location: a.status === 'Available' || a.status.includes('Config') || a.status === 'Pending Deployment' ? a.location : INTAKE_LOCATION })
      rows.push({ id: h.id, type: 'check_in', date: h.date, member: '', by: h.by, location: view.text, locationIcon: view.icon, locationTip: view.tip, note: h.note, status: h.status })
    }
  })
  // Newest first by date; records on the same day keep the order they were made in.
  return rows.sort((x, y) => x.date.localeCompare(y.date)).reverse()
}

export interface CustodyRow { member: string, from: string, to: string | null, days: number }

/** Every team member the asset was checked out to, in order, with how long each held it. */
export function custodyOf(a: Asset, today: string): CustodyRow[] {
  const asc = [...movementsOf(a)].reverse()
  const rows: CustodyRow[] = []
  asc.forEach((m, i) => {
    if (m.type !== 'check_out' || !m.member || m.status === 'Client Pull-Out') return
    const next = asc.slice(i + 1).find(n => n.type === 'check_in' || n.status === 'Client Pull-Out' || n.status === 'Supplier Return')
    const end = next?.date ?? null
    const days = Math.max(0, Math.round((new Date(`${end ?? today}T00:00:00`).getTime() - new Date(`${m.date}T00:00:00`).getTime()) / 86400000))
    rows.push({ member: m.member, from: m.date, to: end, days })
  })
  return rows.reverse()
}

const SIM_MEMBERS = [
  'Kimberly M. Tolentino', 'Marco B. Santos', 'Jasmine R. Ilagan', 'Franklin L. Lumapas',
  'Elena V. Cruz', 'Lesther L. Montermoso', 'Princess Z. Fabrero', 'Ramon Jay F. Canizares'
]
function span(from: string, to: string | null, today: string): number {
  return Math.max(0, Math.round((new Date(`${to ?? today}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000))
}

/** Custody rows for the detail page: the real ones, unless a prototype control forces a state to review. */
export function custodyRowsFor(a: Asset, today: string): CustodyRow[] {
  const mode = assetsSimCustody.value
  if (mode === 'data') return custodyOf(a, today)
  if (mode === 'empty') return []
  if (mode === 'single-open') return [{ member: SIM_MEMBERS[0]!, from: '2026-05-18', to: null, days: span('2026-05-18', null, today) }]
  if (mode === 'single-closed') return [{ member: SIM_MEMBERS[0]!, from: '2026-05-18', to: '2026-07-15', days: span('2026-05-18', '2026-07-15', today) }]
  const starts = ['2023-05-18', '2024-02-15', '2024-08-25', '2025-02-10', '2025-08-01', '2025-11-25', '2026-02-20', '2026-05-10']
  return starts.map((from, i) => {
    const to = i === starts.length - 1 ? null : starts[i + 1]!
    return { member: SIM_MEMBERS[i]!, from, to, days: span(from, to, today) }
  }).reverse()
}

// --- Custody history, in the shape of the live page (assignment-history) -----------------------------
// Rows are chronological here, with Seq counting up from 1; the page shows them newest first. The summary has
// the same fields the live endpoint returns.
const EMP_NO: Record<string, string> = {
  ...DB_EMP_NO,
  'Mara Lim': '4127', 'Bea Ramos': '4210', 'Carlo Diaz': '3988', 'Ines Valdez': '4056',
  'Kimberly M. Tolentino': '3796', 'Marco B. Santos': '3812', 'Jasmine R. Ilagan': '3901', 'Franklin L. Lumapas': '3643',
  'Elena V. Cruz': '4021', 'Lesther L. Montermoso': '2891', 'Princess Z. Fabrero': '4128', 'Ramon Jay F. Canizares': '3502'
}
export interface TeamMemberOption { name: string, empNo: string, email: string, company: string, address: string }

/** The GoTeam address: first name, a dot, last name, as on the retrieval team members ("geraldene.delatorre@go.team"). */
function emailOf(name: string): string {
  const parts = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z\s-]/g, ' ').split(/\s+/).filter(Boolean)
  const first = parts[0] ?? 'team'
  const last = parts.length > 1 ? parts[parts.length - 1]! : 'member'
  return `${first}.${last}@go.team`.toLowerCase()
}

/** The team members a unit can be checked out to: everyone the prototype knows, with employee number and client. */
export function teamMemberOptions(): TeamMemberOption[] {
  return Object.keys(EMP_NO).sort().map(name => ({ name, empNo: EMP_NO[name]!, email: emailOf(name), company: memberCompany(name), address: memberAddress(name) }))
}

export interface CustodyLine {
  seq: number
  member: string
  empNo: string
  condition: 'Brand New' | 'Refurbished'
  deployed: string
  /** The day the custodian confirmed receipt, or null while the receipt is still open */
  received: string | null
  inTransit: boolean
  location: string
  usedMonths: number
  isCurrent: boolean
  isMaiden: boolean
  /** Id of the record behind the row, for its time of day */
  recordId: string
}
export interface CustodySummary {
  /** Months since the asset became Available, and the record that says so */
  actualMonths: number
  actualSince: { date: string, id: string } | null
  totalUsedMonths: number
  firstUsed: { date: string, id: string } | null
  count: number
  current: { name: string, empNo: string } | null
  maiden: { name: string, empNo: string } | null
}

/** Whole months in a span of days: the live system counts 30 day months (days / 30, rounded down), per row and for the age. */
const monthsOfDays = (days: number) => Math.floor(days / 30)
const monthsBetween = (from: string, to: string) => monthsOfDays(span(from, to, to))

export function custodyViewFor(a: Asset, today: string): { lines: CustodyLine[], summary: CustodySummary } {
  const asc = [...custodyRowsFor(a, today)].reverse()
  const lines: CustodyLine[] = asc.map((r, i) => {
    const isCurrent = r.to === null
    const inTransit = isCurrent && assetsSimTransit.value === 'transit'
    return {
      seq: i + 1, member: r.member, empNo: EMP_NO[r.member] ?? String(3000 + (r.member.length * 37) % 1000),
      condition: i === 0 ? 'Brand New' : 'Refurbished', deployed: r.from, received: inTransit ? null : (r.to ?? r.from), inTransit,
      location: memberAddress(r.member), usedMonths: monthsBetween(r.from, r.to ?? today), isCurrent, isMaiden: i === 0,
      recordId: a.history.find(h => h.date === r.from && (h.member ?? a.custodian) === r.member)?.id ?? a.tag
    }
  })
  // The Age summary counts from the first "Available" record, not from whatever the first record is.
  const first = a.history.find(h => h.status === 'Available')
  const cur = lines.find(l => l.isCurrent)
  const mai = lines[0]
  return {
    lines,
    summary: {
      actualMonths: first ? monthsBetween(first.date, today) : 0,
      actualSince: first ? { date: first.date, id: first.id } : null,
      // The live system adds up the rows' months, so the total can be a month more than the whole span would give.
      totalUsedMonths: lines.reduce((s, l) => s + l.usedMonths, 0),
      firstUsed: mai ? { date: mai.deployed, id: mai.recordId } : null,
      count: lines.length,
      current: cur ? { name: cur.member, empNo: cur.empNo } : null,
      maiden: mai ? { name: mai.member, empNo: mai.empNo } : null
    }
  }
}
