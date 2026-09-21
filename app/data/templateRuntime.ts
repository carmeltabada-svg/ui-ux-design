// Per-template editable state, keyed by template id. Previously the page's
// subject/body/status/etc. were flat globals that got overwritten every time
// the picker switched templates - any edit or "save" was silently discarded
// on the next switch or reload. This is the real per-template store so
// switching templates (and creating new ones) actually persists.
import { reactive } from 'vue'
import { TEMPLATES } from './templates'

/** The signed-in user, used to attribute version-history entries created in
 * this session - a seeded template's first version is attributed to
 * 'System' (it shipped with production, nobody in the app authored it), but
 * anything created or edited from here on is attributed to whoever is
 * actually using the app. */
export const CURRENT_USER_NAME = 'Maria Carmel A. Tabada'

export interface Recipient {
  email: string
  locked?: boolean
}

export interface TemplateRuntime {
  name: string
  mode: 'onsite' | 'remote'
  /** editable "when this template is sent" blurb - seeded from TEMPLATES[key].when, editable inline same as a form's description */
  description: string
  subject: string
  body: string
  cc: Recipient[]
  bcc: Recipient[]
  status: 'active' | 'draft' | 'retired'
  attachment: string
  attachmentFormId?: string
  /** Solid color behind the email's centered content column - `undefined`
   * means plain white/none, matching a fresh template's actual current
   * look (see emailExportHtml.ts's `buildEmailExportHtml` for how this
   * becomes the outer full-width table's own fill on copy/EML export). */
  background?: string
  /** Small print sitting below the white content card, directly on the
   * `background` color itself (not part of the editable rich-text body) -
   * e.g. "You are receiving this because..." - a plain string, not Tiptap
   * HTML, since it's meant to stay a single short disclaimer line/paragraph,
   * not another rich-text surface. */
  footerNote?: string
  lastSavedAt?: string
  /** true once the name has been typed directly, not just auto-derived from the subject line */
  nameManuallySet: boolean
}

/** ids of templates created at runtime (not part of the original seed TEMPLATES) */
export const CUSTOM_TEMPLATE_IDS = reactive<string[]>([])

/** Keys removed via the templates list's own Delete action - a seed key
 * (t1, t16, ...) can't be spliced out of `TEMPLATES`/`TEMPLATE_GROUPS`
 * themselves at runtime (those are the static source data, shared by every
 * session), so a deletion is tracked here instead and every reader of "the
 * list of templates" (see templates/index.vue's `allEmailKeys`) filters
 * against it. Session-only, same as the rest of `TEMPLATE_RUNTIME` - email
 * templates have no localStorage mirror the way forms do (see
 * formStorage.client.ts), so this doesn't need to persist either. */
export const DELETED_TEMPLATE_KEYS = reactive<Set<string>>(new Set())

export const TEMPLATE_RUNTIME: Record<string, TemplateRuntime> = reactive({})

/** Permanently removes a template from the list for this session - unlike
 * Retire (a status, still in the list, still reachable), this drops it
 * entirely. A custom (runtime-created) template also loses its
 * `TEMPLATE_RUNTIME` entry outright; a seeded one (t1, t16, ...) just gets
 * hidden via `DELETED_TEMPLATE_KEYS` instead, since its `TEMPLATE_RUNTIME`
 * entry is keyed by the same id `ensureTemplateRuntime` would just recreate
 * from `TEMPLATES` on the next read. */
export function deleteTemplate(key: string) {
  DELETED_TEMPLATE_KEYS.add(key)
  const customIndex = CUSTOM_TEMPLATE_IDS.indexOf(key)
  if (customIndex !== -1) CUSTOM_TEMPLATE_IDS.splice(customIndex, 1)
  delete TEMPLATE_RUNTIME[key]
}

export function ensureTemplateRuntime(key: string): TemplateRuntime {
  if (!TEMPLATE_RUNTIME[key]) {
    const seed = TEMPLATES[key]
    TEMPLATE_RUNTIME[key] = {
      name: seed?.name ?? 'Untitled',
      mode: seed?.mode ?? 'onsite',
      description: seed?.when ?? '',
      subject: seed?.subject ?? '',
      body: seed ? seed.body.replace(/\n/g, '<br>') : '',
      cc: [{ email: 'itasset@go.team', locked: true }],
      bcc: [],
      status: seed ? 'active' : 'draft',
      attachment: seed?.attachment ?? 'none',
      attachmentFormId: seed?.attachmentFormId,
      lastSavedAt: seed ? 'Aug 24, 2026' : undefined,
      nameManuallySet: !!seed
    }
  }
  return TEMPLATE_RUNTIME[key]!
}

/** Creates a new template and returns its id - starts blank/draft/untitled, no modal needed. */
export function createTemplate(): string {
  const id = crypto.randomUUID()
  CUSTOM_TEMPLATE_IDS.push(id)
  TEMPLATE_RUNTIME[id] = {
    name: 'Untitled',
    mode: 'onsite',
    description: '',
    subject: '',
    body: '',
    cc: [{ email: 'itasset@go.team', locked: true }],
    bcc: [],
    status: 'draft',
    attachment: 'none',
    lastSavedAt: undefined,
    nameManuallySet: false
  }
  return id
}

/**
 * Duplicates a template's current runtime state into a brand-new one - the
 * same guardrails as a form's duplicateForm(): always a fresh id (so editing
 * the copy can never bleed back into the original), always starts back at
 * `draft` regardless of the source's status, and the name gets a "(copy)"
 * suffix so it's never confused with the original in a list.
 */
export function duplicateTemplate(sourceKey: string): string {
  const source = ensureTemplateRuntime(sourceKey)
  const id = crypto.randomUUID()
  CUSTOM_TEMPLATE_IDS.push(id)
  TEMPLATE_RUNTIME[id] = {
    ...JSON.parse(JSON.stringify(source)),
    name: `${source.name} (copy)`,
    status: 'draft',
    lastSavedAt: undefined,
    nameManuallySet: true
  }
  return id
}
