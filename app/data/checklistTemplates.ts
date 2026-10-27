// Offboarding checklist templates (A3). FR-003.6 says the checklist is issued
// at notice and that its final review is due no later than 3 business days
// before the Last Working Day, but it does not list the tasks. The Asset Team
// owns that list here: standing templates, edited in Master Data, each marked
// as the default for the reasons and modes it should start from. A new ticket
// is issued the matching template; from then on that ticket's checklist is its
// own copy and nothing links back.
//
// The list itself lives on the server. This module is the client cache: it is
// filled at startup (setChecklistTemplates), read synchronously by pages, and
// every change goes through the api layer and then refreshes the cache. The
// rules (unique names, one template per path) are the server's.
import { reactive } from 'vue'
import { api } from '~/api'

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

/** Where an older saved ticket's list starts when it has no checklist of its own. */
export const DEFAULT_CHECKLIST_TASKS: string[] = [
  'Offboarding notice reviewed and confirmed with People & Culture',
  'Any pending approvals or requests from this team member checked',
  'Handover of ongoing tasks coordinated with their manager',
  'Return instructions explained to the team member'
]

const templates = reactive<ChecklistTemplate[]>([])

export function setChecklistTemplates(list: ChecklistTemplate[]) {
  templates.splice(0, templates.length, ...list)
}

export function useChecklistTemplates() {
  return templates
}

async function refresh() {
  setChecklistTemplates(await api().checklistTemplates.list())
}

/** Case-insensitive, because templates are picked by name. Only a hint for naming copies: the server decides. */
export function checklistTemplateNameTaken(name: string, exceptId?: string): boolean {
  const n = name.trim().toLowerCase()
  return templates.some(t => t.id !== exceptId && t.name.trim().toLowerCase() === n)
}

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false, error: string }

export async function saveChecklistTemplate(name: string, tasks: ChecklistTask[], defaultFor: string[] = []): Promise<Result<{ template: ChecklistTemplate }>> {
  const res = await api().checklistTemplates.create({ name, tasks, defaultFor })
  if (!res.ok) return res
  await refresh()
  return { ok: true, template: res.data }
}

/** Saves edits made in Master Data: name, tasks and the paths it is the default for. */
export async function updateChecklistTemplate(id: string, patch: { name: string, tasks: ChecklistTask[], defaultFor: string[] }): Promise<Result> {
  const res = await api().checklistTemplates.update(id, patch)
  if (!res.ok) return res
  await refresh()
  return { ok: true }
}

export async function duplicateChecklistTemplate(id: string): Promise<string | null> {
  const t = templates.find(x => x.id === id)
  if (!t) return null
  let name = `${t.name} (copy)`
  let n = 2
  while (checklistTemplateNameTaken(name)) name = `${t.name} (copy ${n++})`
  const res = await saveChecklistTemplate(name, t.tasks, [])
  return res.ok ? res.template.id : null
}

export async function deleteChecklistTemplate(id: string): Promise<Result> {
  const res = await api().checklistTemplates.remove(id)
  if (!res.ok) return res
  await refresh()
  return { ok: true }
}

/** The template a new ticket for this reason and mode is issued: its own path first, then the catch-all, then the first one. */
export function checklistTemplateFor(reason: string, mode: string): ChecklistTemplate {
  return templates.find(t => t.defaultFor.includes(`${reason}:${mode}`))
    ?? templates.find(t => t.defaultFor.includes('*'))
    ?? templates[0]!
}

/** True when these tasks (text and required flag) already exist as a saved template. */
export function checklistMatchesATemplate(tasks: ChecklistTask[]): boolean {
  const key = (list: ChecklistTask[]) => list.map(t => `${t.text.trim()}|${t.required ? 1 : 0}`).join('\u0000')
  return templates.some(t => key(t.tasks) === key(tasks))
}
