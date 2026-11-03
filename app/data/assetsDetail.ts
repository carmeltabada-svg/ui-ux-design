// Everything the asset detail page needs beyond the status history: the activity feed items, the movement
// cards with their numbers and comments, the legacy tags, and the options and save for Edit details. Like
// assetsActivity.ts, each export stands in for a backend call, so the dev replaces the body, not the callers.
import { ASSETS, badgeDate, localToday, type Asset } from '~/data/assets'
import { movementsOf, type AssetMovementRow } from '~/data/assetsActivity'

/** The signed-in user. Comments and edits are theirs. */
export const CURRENT_USER = 'Maria Carmel A. Tabada'

export function initialsOf(name: string): string {
  return name.split(' ').map(p => p[0]).filter(c => c && /[A-Z]/.test(c)).slice(0, 2).join('')
}

const AVATAR_TINTS = ['bg-blue-100 text-blue-700', 'bg-orange-100 text-orange-700', 'bg-purple-100 text-purple-700', 'bg-emerald-100 text-emerald-700', 'bg-pink-100 text-pink-700']
/** The same person always gets the same tint, as in the ticket tracker and the assets list. */
export function avatarTint(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_TINTS[h % AVATAR_TINTS.length]!
}

export function agoLabel(iso: string): string {
  const days = Math.round((new Date(`${localToday()}T00:00:00`).getTime() - new Date(`${iso}T00:00:00`).getTime()) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
  const years = Math.round(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
/** A stable movement number for a record, e.g. #4618. */
export function movementNum(id: string): string {
  return `#${1000 + (hash(id) % 9000)}`
}

// --- Activity feed ---------------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The sample records only carry a date, so a stable working-hours time is derived from the record id. */
export function timeLabel(id: string): string {
  const h24 = 8 + (hash(id) % 10)
  const m = (hash(id + 'm') % 60)
  const h12 = h24 > 12 ? h24 - 12 : h24
  return `${h12}:${String(m).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`
}
/** "17 Mar 2026, 1:49 PM", the timestamp format of the asset detail design. */
export function stampLabel(iso: string, id: string): string {
  const [y, mo, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[(mo ?? 1) - 1]} ${y}, ${timeLabel(id)}`
}

export type FeedKind = 'created' | 'status' | 'movement' | 'link'
export interface FeedItem {
  id: string
  kind: FeedKind
  actor: string
  initials: string
  date: string
  time: string
  ago: string
  /** Status change: what it was and what it became */
  from?: { status: string, sub?: string }
  to?: { status: string, sub?: string }
  /** Replacement link: the unit this one replaces */
  link?: { tag: string }
  /** Movement: what happened and with whom or where */
  movement?: { type: 'check_in' | 'check_out', num: string, member: string, location: string }
  /** The reason or note that came with the change */
  note?: string
  doc?: string
  /** The document behind `doc`, for opening it */
  docRef?: { id: string, doc: { name: string, type: string } }
  detail: [string, string][]
}

/** Newest first. Each status change and each movement it caused is its own event. */
export function feedOf(a: Asset): FeedItem[] {
  const items: FeedItem[] = []
  const movements = movementsOf(a)
  const base = (h: Asset['history'][number]) => ({ actor: h.by, initials: initialsOf(h.by), date: h.date, time: timeLabel(h.id), ago: agoLabel(h.date) })
  a.history.forEach((h, i) => {
    const prev = a.history[i - 1]
    const label = h.sub ? `${h.status} (${h.sub})` : h.status
    if (h.replacementFor) {
      // Linking a replacement is not a status change: it gets its own event.
      items.push({ ...base(h), id: `${h.id}-link`, kind: 'link', link: { tag: h.replacementFor }, note: h.note || undefined, detail: [['Replaces', h.replacementFor], ['Linked on', badgeDate(h.date)]] })
      return
    }
    if (!prev) {
      items.push({ ...base(h), id: `${h.id}-created`, kind: 'created', to: { status: h.status, sub: h.sub }, detail: [['Tag', a.tag], ['Serial', a.serial], ['Model', a.model]] })
    } else {
      const from = prev.sub ? `${prev.status} (${prev.sub})` : prev.status
      const detail: [string, string][] = [['Asset Status', `${from} → ${label}`], ['Status Date', badgeDate(h.date)]]
      if (h.reason) detail.push(['Reason', h.reason])
      else if (h.note) detail.push(['Note', h.note])
      if (h.doc) detail.push(['Document', h.doc.name])
      if (h.replacement) detail.push(['Replacement Unit', h.replacement])
      items.push({
        ...base(h), id: `${h.id}-status`, kind: 'status', from: { status: prev.status, sub: prev.sub }, to: { status: h.status, sub: h.sub },
        note: h.reason || h.note || undefined, doc: h.doc?.name, docRef: h.doc ? { id: h.id, doc: h.doc } : undefined, detail
      })
    }
    const m = movements.find(x => x.id === h.id)
    if (m) {
      const kind = m.type === 'check_in' ? 'Check In' : 'Check Out'
      const detail: [string, string][] = [['Movement Type', kind], ['Movement Number', movementNum(m.id)], ['Location', m.location]]
      if (m.member) detail.push(['Checked Out To', m.member])
      if (m.status) detail.push(['Resulting Status', m.sub ? `${m.status} (${m.sub})` : m.status])
      items.push({
        ...base(h), id: `${h.id}-movement`, kind: 'movement',
        movement: { type: m.type, num: movementNum(m.id), member: m.member, location: m.location }, detail
      })
    }
  })
  return items.sort((x, y) => x.date.localeCompare(y.date)).reverse()
}

// --- Movements and their comments ------------------------------------------------------------------

export interface CommentAttachment { name: string, size: number, isImage: boolean, url: string }
export interface MovementComment {
  id: string
  author: string
  initials: string
  mine: boolean
  /** Shown as typed, e.g. "Oct 30, 2026 2:14 PM" */
  ts: string
  text: string
  attachments: CommentAttachment[]
}

/** Comments by movement id. Held for the session only: attached files can't be stored, as with the exit documents. */
export const MOVEMENT_COMMENTS = reactive<Record<string, MovementComment[]>>({})

let commentSeq = 0
/** File types a comment may carry. HTML and SVG are left out: they would run as pages when opened. */
export const COMMENT_FILE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv', 'application/zip', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']

export function addMovementComment(movementId: string, text: string, files: File[]): void {
  const now = new Date()
  const ts = `${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
  const attachments = files.map(f => ({ name: f.name, size: f.size, isImage: f.type.startsWith('image/'), url: URL.createObjectURL(f) }))
  const list = MOVEMENT_COMMENTS[movementId] ?? (MOVEMENT_COMMENTS[movementId] = [])
  list.push({ id: `c-${Date.now().toString(36)}-${commentSeq++}`, author: CURRENT_USER, initials: initialsOf(CURRENT_USER), mine: true, ts, text, attachments })
}
export function deleteMovementComment(movementId: string, commentId: string): void {
  const list = MOVEMENT_COMMENTS[movementId]
  if (!list) return
  for (const att of list.find(c => c.id === commentId)?.attachments ?? []) URL.revokeObjectURL(att.url)
  MOVEMENT_COMMENTS[movementId] = list.filter(c => c.id !== commentId)
}

export interface MovementCard extends AssetMovementRow {
  num: string
  time: string
  ago: string
  /** Movements recorded before the system tracked them are marked Historical */
  historical: boolean
  created: string
}

export function movementCardsOf(a: Asset): MovementCard[] {
  return movementsOf(a).map(m => ({ ...m, num: movementNum(m.id), time: timeLabel(m.id), ago: agoLabel(m.date), historical: false, created: badgeDate(m.date) }))
}

// --- Legacy tags -----------------------------------------------------------------------------------

export interface LegacyTag { id: string, code: string, added: string }
const legacySeed = (): Record<string, LegacyTag[]> => ({
  'GT-CE-LTP-1233-0926-0013': [
    { id: 'lt-1', code: 'HP-LTP-0098', added: '2026, Mar 17' },
    { id: 'lt-2', code: 'GT-LAP-2024-0411', added: '2026, Mar 17' }
  ]
})
export const LEGACY_TAGS = reactive<Record<string, LegacyTag[]>>(legacySeed())

/** Puts the session-only parts of the detail page (comments, legacy tags) back to the starting data. */
export function resetDetail(): void {
  for (const k of Object.keys(MOVEMENT_COMMENTS)) {
    for (const c of MOVEMENT_COMMENTS[k]!) for (const att of c.attachments) URL.revokeObjectURL(att.url)
    delete MOVEMENT_COMMENTS[k]
  }
  for (const k of Object.keys(LEGACY_TAGS)) delete LEGACY_TAGS[k]
  Object.assign(LEGACY_TAGS, legacySeed())
}
let legacySeq = 0
export function addLegacyTag(tag: string, code: string): void {
  const list = LEGACY_TAGS[tag] ?? (LEGACY_TAGS[tag] = [])
  list.unshift({ id: `lt-${Date.now().toString(36)}-${legacySeq++}`, code, added: badgeDate(localToday()) })
}
export function renameLegacyTag(tag: string, id: string, code: string): void {
  const t = LEGACY_TAGS[tag]?.find(x => x.id === id)
  if (t) t.code = code
}
export function removeLegacyTag(tag: string, id: string): void {
  if (LEGACY_TAGS[tag]) LEGACY_TAGS[tag] = LEGACY_TAGS[tag]!.filter(x => x.id !== id)
}

// --- Edit details ----------------------------------------------------------------------------------

export const MODEL_OPTIONS = [
  'HP ProBook 440 G10', 'HP ProBook 440 G11', 'HP EliteBook 840 G9', 'Dell Latitude 5440', 'Lenovo ThinkPad E14',
  'Lenovo ThinkPad E14 Gen 5', 'Lenovo ThinkPad T14', 'Lenovo Swift 968Pro', 'Asus Vivobook 14', 'Philips 22E1N1100', 'Dell P2422H'
]
export const LOCATION_OPTIONS = [
  'i1 Building 9th Floor · Asset Room', 'i1 Building 9th Floor · IT Bench', 'i1 Building 9th Floor · Exceed Room',
  'i1 Building · Asset Room', 'HM Tower · 14th Floor', 'HM Tower · 18th Floor',
  'Northwind Health · Makati office', 'Contoso Realty · BGC office'
]
export const OWNER_OPTIONS = ['GoTeam', 'Northwind Health', 'Contoso Realty', 'Fabrikam Logistics']
export const PO_OPTIONS = ['PO-1240', 'PO-2235188', 'PO-2230112', 'PO-4178401', 'PO-4178402', 'PO-6895557', 'PO-7330336', 'PO-3380127', 'PO-2290031']
export const TECH_PACK_OPTIONS = ['Monthly Rental', 'Outright Purchase', 'BYOD']
export const CURRENCY_OPTIONS = ['PHP', 'USD']

export interface DetailsDraft {
  serial: string
  model: string
  location: string
  owner: string
  cost: string
  po: string
  techPack: string
  currency: string
}

export function draftOf(a: Asset): DetailsDraft {
  return { serial: a.serial, model: a.model, location: a.location, owner: a.owner, cost: String(a.cost), po: a.po, techPack: a.techPack, currency: a.currency }
}

/** What is still missing or wrong, by field. Empty when the draft can be saved. */
export function draftProblems(d: DetailsDraft): Partial<Record<keyof DetailsDraft, string>> {
  const out: Partial<Record<keyof DetailsDraft, string>> = {}
  if (!d.serial.trim()) out.serial = 'Enter the serial number'
  if (!d.model) out.model = 'Pick the model'
  if (!d.location) out.location = 'Pick where the asset lives'
  if (!d.owner) out.owner = 'Pick the owner'
  if (d.cost.trim() === '' || !Number.isFinite(Number(d.cost)) || Number(d.cost) < 0) out.cost = 'Enter the cost, 0 if there is none'
  return out
}

export function saveAssetDetails(tag: string, d: DetailsDraft): void {
  const a = ASSETS[tag]
  if (!a) return
  a.serial = d.serial.trim()
  a.model = d.model
  a.location = d.location
  a.owner = d.owner
  a.cost = Number(d.cost)
  a.po = d.po
  a.techPack = d.techPack as Asset['techPack']
  a.currency = d.currency
}
