// Offboarding checklist templates (A3). FR-003.6 says the checklist is issued
// at notice and that its final review is due no later than 3 business days
// before the Last Working Day, but it does not list the tasks. The Asset Team
// owns that list here: standing templates, edited in Master Data, each marked
// as the default for the reasons and modes it should start from. A new ticket
// is issued the matching template; from then on that ticket's checklist is its
// own copy and nothing links back.
import { reactive } from 'vue'

export interface ChecklistTask {
  text: string
  /** A required task must be done before the final review. An optional one never blocks it. */
  required: boolean
}

export interface ChecklistTemplate {
  id: string
  name: string
  tasks: ChecklistTask[]
  /**
   * The paths this template is issued for, as 'reason:mode' keys ('resignation:remote'),
   * or '*' for every path without a more specific template. A path belongs to one template.
   */
  defaultFor: string[]
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'ams:checklistTemplates:v2'
const LEGACY_KEY = 'ams:checklistTemplates:v1'

/** Where a new ticket's list starts when no template has been saved yet. */
export const DEFAULT_CHECKLIST_TASKS: string[] = [
  'Offboarding notice reviewed and confirmed with People & Culture',
  'Any pending approvals or requests from this team member checked',
  'Handover of ongoing tasks coordinated with their manager',
  'Return instructions explained to the team member'
]

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function seed(): ChecklistTemplate[] {
  return [{
    id: 'tpl-standard-offboarding',
    name: 'Standard offboarding',
    tasks: DEFAULT_CHECKLIST_TASKS.map(text => ({ text, required: true })),
    defaultFor: ['*'],
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01'
  }]
}

const templates = reactive<ChecklistTemplate[]>(seed())
let loaded = false

/** A saved template as read back from storage: any version, so every field is unchecked. */
interface StoredChecklistTemplate {
  id?: unknown
  name?: unknown
  tasks?: unknown
  items?: unknown
  defaultFor?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}
const isTaskLike = (t: unknown): t is { text: string, required?: unknown } => !!t && typeof (t as { text?: unknown }).text === 'string'

function normalize(raw: StoredChecklistTemplate | null | undefined): ChecklistTemplate | null {
  if (!raw || typeof raw.name !== 'string') return null
  // The first version stored plain strings. They become required tasks.
  const tasks: ChecklistTask[] = Array.isArray(raw.tasks)
    ? raw.tasks.filter(isTaskLike).map(t => ({ text: t.text, required: t.required !== false }))
    : Array.isArray(raw.items) ? raw.items.filter((t): t is string => typeof t === 'string').map(text => ({ text, required: true })) : []
  return {
    id: String(raw.id ?? `tpl-${Date.now().toString(36)}`),
    name: raw.name,
    tasks,
    defaultFor: Array.isArray(raw.defaultFor) ? raw.defaultFor.filter((k): k is string => typeof k === 'string') : [],
    createdAt: String(raw.createdAt ?? today()),
    updatedAt: String(raw.updatedAt ?? raw.createdAt ?? today())
  }
}

function load() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    const list = parsed.map(normalize).filter((t): t is ChecklistTemplate => !!t)
    if (!list.length) return
    // A list saved before defaults existed has none: the first one covers every path.
    if (!list.some(t => t.defaultFor.length)) list[0]!.defaultFor = ['*']
    templates.splice(0, templates.length, ...list)
  } catch { /* unreadable saved list: keep the seeded one */ }
}

function persist() {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(templates)) } catch { /* storage unavailable: still works for this session */ }
}

export function useChecklistTemplates() {
  load()
  return templates
}

const cleanTasks = (tasks: ChecklistTask[]) => tasks.map(t => ({ text: t.text.trim(), required: t.required })).filter(t => t.text)

/** Case-insensitive, because templates are picked by name. */
export function checklistTemplateNameTaken(name: string, exceptId?: string): boolean {
  load()
  const n = name.trim().toLowerCase()
  return templates.some(t => t.id !== exceptId && t.name.trim().toLowerCase() === n)
}

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false, error: string }

/** A path can belong to only one template, so claiming it takes it from any other. */
function claimPaths(keys: string[], forId: string) {
  for (const t of templates) {
    if (t.id !== forId) t.defaultFor = t.defaultFor.filter(k => !keys.includes(k))
  }
}

export function saveChecklistTemplate(name: string, tasks: ChecklistTask[], defaultFor: string[] = []): Result<{ template: ChecklistTemplate }> {
  load()
  const clean = cleanTasks(tasks)
  if (!clean.length) return { ok: false, error: 'Add at least one task before saving a template.' }
  const trimmed = name.trim()
  if (!trimmed) return { ok: false, error: 'Give the template a name.' }
  if (checklistTemplateNameTaken(trimmed)) return { ok: false, error: 'A template with this name already exists. Choose a different name.' }
  const template: ChecklistTemplate = {
    id: `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: trimmed,
    tasks: clean,
    defaultFor: [...defaultFor],
    createdAt: today(),
    updatedAt: today()
  }
  claimPaths(template.defaultFor, template.id)
  templates.push(template)
  persist()
  return { ok: true, template }
}

/** Saves edits made in Master Data: name, tasks and the paths it is the default for. */
export function updateChecklistTemplate(id: string, patch: { name: string, tasks: ChecklistTask[], defaultFor: string[] }): Result {
  load()
  const t = templates.find(x => x.id === id)
  if (!t) return { ok: false, error: 'That template no longer exists.' }
  const clean = cleanTasks(patch.tasks)
  if (!clean.length) return { ok: false, error: 'A template needs at least one task.' }
  const name = patch.name.trim()
  if (!name) return { ok: false, error: 'Give the template a name.' }
  if (checklistTemplateNameTaken(name, id)) return { ok: false, error: 'A template with this name already exists. Choose a different name.' }
  t.name = name
  t.tasks = clean
  t.defaultFor = [...patch.defaultFor]
  t.updatedAt = today()
  claimPaths(t.defaultFor, id)
  persist()
  return { ok: true }
}

export function duplicateChecklistTemplate(id: string): string | null {
  load()
  const t = templates.find(x => x.id === id)
  if (!t) return null
  let name = `${t.name} (copy)`
  let n = 2
  while (checklistTemplateNameTaken(name)) name = `${t.name} (copy ${n++})`
  const res = saveChecklistTemplate(name, t.tasks, [])
  return res.ok ? res.template.id : null
}

/** The last template cannot be deleted: every ticket needs something to be issued from. */
export function deleteChecklistTemplate(id: string): Result {
  load()
  if (templates.length <= 1) return { ok: false, error: 'Keep at least one template. New tickets are issued from it.' }
  const i = templates.findIndex(t => t.id === id)
  if (i === -1) return { ok: true }
  const [removed] = templates.splice(i, 1)
  // Whatever paths it covered fall back to the first remaining template, so none is left without one.
  if (removed!.defaultFor.length) {
    const next = templates[0]!
    next.defaultFor = [...new Set([...next.defaultFor, ...removed!.defaultFor])]
  }
  persist()
  return { ok: true }
}

/** The template a new ticket for this reason and mode is issued: its own path first, then the catch-all, then the first one. */
export function checklistTemplateFor(reason: string, mode: string): ChecklistTemplate {
  load()
  return templates.find(t => t.defaultFor.includes(`${reason}:${mode}`))
    ?? templates.find(t => t.defaultFor.includes('*'))
    ?? templates[0]!
}

/** True when these tasks (text and required flag) already exist as a saved template. */
export function checklistMatchesATemplate(tasks: ChecklistTask[]): boolean {
  load()
  const key = (list: ChecklistTask[]) => list.map(t => `${t.text.trim()}|${t.required ? 1 : 0}`).join('\u0000')
  return templates.some(t => key(t.tasks) === key(tasks))
}
