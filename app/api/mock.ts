// PROTOTYPE ONLY: delete this file with `app/mocks/` when the real backend is
// connected (see docs/retrieval/BACKEND_SWAP.md). It plays the server: it returns the
// fixtures exactly as the real API would, applies the rules the real server will
// own (unique names, one template per path), and keeps changes in this browser's
// localStorage so they survive a refresh.
import { camelizeKeys } from './keys'
import { ticketFromResource } from './mappers'
import {
  TICKETS, NOTIFICATIONS, MATRIX, REASON_LABELS, assetCatalogEntry, assetTagFor, serialFor, recommendedCourierProvider, findOpenDuplicate,
  pushHistory, raiseNotification, localISO, currentUserName, assetTeamMemberByName, templateForKey,
  type AssetTeamMember, type HrisRecord, type SentEmail, type Ticket
} from '~/data/ticketTrackers'
import { RETRIEVAL_FORMS, RETRIEVAL_FORM_CONTENT } from '~/data/retrievalForms'
import { renderTicketMessage } from '~/utils/ticketMessage'
import { checklistTemplateFor } from '~/data/checklistTemplates'
import { ACTIONS, cleanTasks } from './ticketActions'
import { deepClone } from '~/utils/deepClone'
import type { ApiClient, ApiResult, ChecklistTemplateInput, EmailTemplateRecord, MasterData, RetrievalFormRecord, SendEmailRequest, TicketActionResponse } from './types'
import type { ChecklistTask, ChecklistTemplate } from '~/data/checklistTemplates'
import type { RetrievalForm } from '~/data/retrievalForms'
import type { EmailTemplate } from '~/data/templates'
import courierProviders from '~/mocks/courier_providers.json'
import courierBranches from '~/mocks/courier_branches.json'
import users from '~/mocks/users.json'
import hrisDirectory from '~/mocks/hris_directory.json'
import checklistTemplateRows from '~/mocks/checklist_templates.json'
import emailTemplateRows from '~/mocks/email_templates.json'
import retrievalFormRows from '~/mocks/retrieval_forms.json'
import ticketRows from '~/mocks/tickets.json'

// --- Checklist templates ----------------------------------------------------

const STORAGE_KEY = 'ams:checklistTemplates:v2'
const LEGACY_KEY = 'ams:checklistTemplates:v1'

const today = () => localISO(new Date())

const seedChecklistTemplates = () => camelizeKeys<ChecklistTemplate[]>(checklistTemplateRows)

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

let checklistCache: ChecklistTemplate[] | null = null

function readChecklistTemplates(): ChecklistTemplate[] {
  // There is no storage on the server: it always renders the seed.
  if (typeof window === 'undefined') return seedChecklistTemplates()
  if (checklistCache) return checklistCache
  checklistCache = seedChecklistTemplates()
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return checklistCache
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return checklistCache
    const list = parsed.map(normalize).filter((t): t is ChecklistTemplate => !!t)
    if (!list.length) return checklistCache
    // A list saved before defaults existed has none: the first one covers every path.
    if (!list.some(t => t.defaultFor.length)) list[0]!.defaultFor = ['*']
    checklistCache = list
  } catch { /* unreadable saved list: keep the seeded one */ }
  return checklistCache
}

function writeChecklistTemplates(list: ChecklistTemplate[]) {
  checklistCache = list
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) } catch { /* storage unavailable: still works for this session */ }
}

const nameTaken = (list: ChecklistTemplate[], name: string, exceptId?: string) => {
  const n = name.trim().toLowerCase()
  return list.some(t => t.id !== exceptId && t.name.trim().toLowerCase() === n)
}

/** A path can belong to only one template, so claiming it takes it from any other. */
function claimPaths(list: ChecklistTemplate[], keys: string[], forId: string) {
  for (const t of list) {
    if (t.id !== forId) t.defaultFor = t.defaultFor.filter(k => !keys.includes(k))
  }
}

/** Shared checks for create and update. Returns the cleaned input, or the message the server would send. */
function validateChecklistInput(list: ChecklistTemplate[], input: ChecklistTemplateInput, exceptId?: string, emptyTasksMessage = 'Add at least one task before saving a template.'):
  { ok: true, name: string, tasks: ChecklistTask[] } | { ok: false, error: string } {
  const tasks = cleanTasks(input.tasks)
  if (!tasks.length) return { ok: false, error: emptyTasksMessage }
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Give the template a name.' }
  if (nameTaken(list, name, exceptId)) return { ok: false, error: 'A template with this name already exists. Choose a different name.' }
  return { ok: true, name, tasks }
}

const checklistTemplates: ApiClient['checklistTemplates'] = {
  async list() {
    return deepClone(readChecklistTemplates())
  },

  async create(input): Promise<ApiResult<ChecklistTemplate>> {
    const list = deepClone(readChecklistTemplates())
    const checked = validateChecklistInput(list, input)
    if (!checked.ok) return checked
    const template: ChecklistTemplate = {
      id: `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: checked.name,
      tasks: checked.tasks,
      defaultFor: [...input.defaultFor],
      createdAt: today(),
      updatedAt: today()
    }
    claimPaths(list, template.defaultFor, template.id)
    list.push(template)
    writeChecklistTemplates(list)
    return { ok: true, data: deepClone(template) }
  },

  async update(id, input): Promise<ApiResult> {
    const list = deepClone(readChecklistTemplates())
    const t = list.find(x => x.id === id)
    if (!t) return { ok: false, error: 'That template no longer exists.' }
    const checked = validateChecklistInput(list, input, id, 'A template needs at least one task.')
    if (!checked.ok) return checked
    t.name = checked.name
    t.tasks = checked.tasks
    t.defaultFor = [...input.defaultFor]
    t.updatedAt = today()
    claimPaths(list, t.defaultFor, id)
    writeChecklistTemplates(list)
    return { ok: true, data: undefined }
  },

  /** The last template cannot be deleted: every ticket needs something to be issued from. */
  async remove(id): Promise<ApiResult> {
    const list = deepClone(readChecklistTemplates())
    if (list.length <= 1) return { ok: false, error: 'Keep at least one template. New tickets are issued from it.' }
    const i = list.findIndex(t => t.id === id)
    if (i === -1) return { ok: true, data: undefined }
    const [removed] = list.splice(i, 1)
    // Whatever paths it covered fall back to the first remaining template, so none is left without one.
    if (removed!.defaultFor.length) {
      const next = list[0]!
      next.defaultFor = [...new Set([...next.defaultFor, ...removed!.defaultFor])]
    }
    writeChecklistTemplates(list)
    return { ok: true, data: undefined }
  }
}

// --- Tickets ----------------------------------------------------------------

// The numbers a real server hands out. Taken from the tickets that exist, so a number
// is never reused. 421 and 417 are where the 2026 demo tickets start.
function nextTicketNumber(): number {
  return Math.max(421, ...Object.values(TICKETS).map(t => t.ticketNumber)) + 1
}

/** APR-YY-NNNNN: the sequence restarts every January. */
function nextReference(): string {
  const yy = String(new Date().getFullYear()).slice(-2)
  const used = Object.values(TICKETS).filter(t => t.reference.startsWith(`APR-${yy}-`)).map(t => Number(t.reference.slice(`APR-${yy}-`.length)))
  return `APR-${yy}-${String(Math.max(yy === '26' ? 417 : 0, ...used) + 1).padStart(5, '0')}`
}

const tickets: ApiClient['tickets'] = {
  async list() {
    return ticketRows.map(ticketFromResource)
  },

  async create(input): Promise<ApiResult<Ticket>> {
    const employee = camelizeKeys<HrisRecord[]>(hrisDirectory).find(e => e.id === input.employeeId)
    if (!employee) return { ok: false, error: 'That team member was not found in HRIS.' }
    // The server checks this itself. The form's own check is only a hint.
    if (findOpenDuplicate(employee.id)) return { ok: false, error: 'This team member already has an open retrieval ticket.' }
    const assignee = camelizeKeys<AssetTeamMember[]>(users).find(m => m.email === input.assigneeEmail) ?? assetTeamMemberByName(currentUserName())
    const { reason, mode, authorizingEndorsement, authorizingEndorsementDate, recallEffectiveDate, reasonOverrideNote, modeOverrideNote } = input
    // From HRIS, not from the request.
    const { lwd, sep } = employee
    const entry = MATRIX[reason]
    const issuedChecklist = checklistTemplateFor(reason, mode)
    const id = crypto.randomUUID()
    const reference = nextReference()
    const ticketNumber = nextTicketNumber()
    const ticket: Ticket = {
      id,
      ticketNumber,
      reference,
      employee,
      assignee,
      reason,
      mode,
      lwd,
      sep,
      authorizingEndorsement,
      authorizingEndorsementDate,
      gateCount: entry.gateCount,
      gatesReleased: 0,
      gateNotes: {},
      stageIdx: 0,
      furthestStageIdx: 0,
      overdueForced: false,
      // FR-003.6: the checklist is issued at notice, from the template set for this path.
      checklistItems: issuedChecklist.tasks.map(t => t.text),
      checklistDone: issuedChecklist.tasks.map(() => false),
      checklistOptional: issuedChecklist.tasks.map(t => !t.required),
      checklistReview: null,
      assetsLocked: false,
      assets: employee.assets.map((a, i) => ({ name: a.name, model: a.model, type: assetCatalogEntry(a.name).type, serial: serialFor(employee.id, i), assetTag: assetTagFor(employee.id, i), checked: true, remarks: '', resolution: null })),
      targetDateISO: null,
      callAttempts: [],
      smsSentAt: null,
      overdueReminderSentAt: null,
      overdueReminderCount: 0,
      reminderCount: 0,
      deductionApplicable: null,
      contact: {
        number: employee.contactNumber,
        numberVerified: false,
        email: employee.personalEmail,
        emailVerified: false,
        altName: employee.altContactName,
        altNumber: employee.altContactNumber
      },
      itLock: { scheduledConfirmed: false, scheduledFor: null, executedConfirmed: false },
      courierProviderId: mode === 'remote' ? (recommendedCourierProvider()?.id ?? null) : null,
      courierBranchName: '',
      courierBranchAddress: '',
      courierBranchSubstituted: false,
      branchCaptureMethod: null,
      teamMemberAddressOverride: null,
      branchRequestSentAt: null,
      branchRequestTemplateKey: null,
      branchRequestReplyReceived: false,
      transitTrackingRef: '',
      transitConfirmedAt: null,
      gateReleaseDates: {},
      targetDateHistory: [],
      hrisUpdatePending: false,
      hrisUpdateChangedAt: null,
      hrisUpdateAcknowledgedAt: null,
      itLockNeedsReschedule: false,
      history: [],
      gatePassRef: null,
      gatePass: null,
      buildingGatePassRef: null,
      buildingGatePass: null,
      evidenceProof: null,
      evidenceCondition: null,
      atdReference: null,
      deductionDate: '',
      deductionItem: '',
      deductionAmount: '',
      deductionAuthorizedBy: '',
      deductionCaseFirstNameOverride: null,
      deductionCaseOfficerOverride: null,
      deductionCaseReturnRequestedDate: '',
      deductionCaseReceivedDate: '',
      deductionCaseAssessedDate: '',
      deductionCaseBuyoutElectionDate: '',
      deductionCaseQuotationExpectedDate: '',
      deductionCaseHearBackByDate: '',
      deductionCaseResponseDueDate: '',
      deductionCaseAmountBasis: null,
      deductionCaseSupportingDocRef: '',
      deductionCaseAmountFigures: '',
      deductionCaseAmountWords: '',
      deductionCaseAssetSerials: [],
      deductionOutcome: null,
      quotationReceivedISO: null,
      quotationReference: '',
      quotationFileName: '',
      referredToPayrollAt: null,
      referredToPayrollBy: '',
      inspectionRoute: null,
      status: 'open',
      createdAt: localISO(new Date()),
      createdBy: currentUserName(),
      recallEffectiveDate: reason === 'recalled' ? (recallEffectiveDate || '') : undefined,
      acknowledgmentToken: crypto.randomUUID().replace(/-/g, ''),
      auditTrailId: `AUD-${new Date().getFullYear()}-${String(ticketNumber).padStart(5, '0')}`
    }
    // The first lines of the history, written by the server. Notifications are raised in the
    // browser's store here, because that is where the prototype keeps them.
    pushHistory(ticket, 'Entry recorded: authorizing endorsement (+ recorded date) + Last Working Day + Separation Date captured', 'entry')
    if (reasonOverrideNote) pushHistory(ticket, `Reason overridden from the suggested case type: "${reasonOverrideNote}"`, 'entry')
    if (modeOverrideNote) pushHistory(ticket, `Mode overridden from the address-derived auto default: "${modeOverrideNote}"`, 'entry')
    pushHistory(ticket, `Ticket Created - ${reference}`, 'entry')
    // A ticket created for someone else is news to that person.
    if (assignee.name !== currentUserName()) {
      raiseNotification(ticket, {
        kind: 'assigned',
        action: true,
        title: `Ticket assigned to you · ${employee.name}`,
        description: `${employee.name} · ${REASON_LABELS[reason]}`
      })
    }
    return { ok: true, data: ticket }
  },

  async act(ticketNumber, name, args): Promise<ApiResult<TicketActionResponse>> {
    // The browser's store stands in for the database. The action runs on a copy, the way a
    // server would work on a row it just read, and the copy is what comes back.
    const row = Object.values(TICKETS).find(t => t.ticketNumber === ticketNumber)
    if (!row) return { ok: false, error: 'That ticket was not found.' }
    const copy = deepClone(row)
    try {
      return { ok: true, data: { ticket: copy, result: ACTIONS[name](copy, args) } }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }
}

// --- Email sending ------------------------------------------------------------

// A real mail server takes a moment. This keeps the "Sending" state on screen long enough to be seen.
const SEND_DELAY_MS = 700

/** The stage's own record of a send: the history entry and the flags the workspace reads (see docs/retrieval/TICKET_WORKFLOW.md section 6.3). */
function recordSend(ticket: Ticket, req: SendEmailRequest, formName: string | null) {
  switch (req.kind) {
    case 'notice':
    case 'courier-endorsement': return ACTIONS.recordNoticeSent(ticket, {})
    case 'branch-request': return ACTIONS.sendBranchRequest(ticket, { templateKey: req.templateKey })
    case 'reminder': return ACTIONS.recordReminderSent(ticket, {})
    case 'overdue': return ACTIONS.recordOverdueReminderSent(ticket, { templateKey: req.templateKey })
    case 'charging': return ACTIONS.recordDeductionOutcome(ticket, { outcome: req.outcome, templateKey: req.templateKey, formName })
  }
}

const emails: ApiClient['emails'] = {
  async send(ticketNumber, req) {
    const row = Object.values(TICKETS).find(t => t.ticketNumber === ticketNumber)
    if (!row) return { ok: false, error: 'That ticket was not found.' }
    const copy = deepClone(row)
    // A repeat of an attempt that already went out answers with that send, never a second email.
    const earlier = copy.emails?.find(e => e.idempotencyKey === req.idempotencyKey)
    if (earlier) return { ok: true, data: { ticket: copy, email: earlier } }
    await new Promise(resolve => setTimeout(resolve, SEND_DELAY_MS))
    try {
      if (!req.to.length) return { ok: false, error: 'Add a recipient first.' }
      const template = templateForKey(req.templateKey)
      if (!template) return { ok: false, error: 'That email template no longer exists.' }
      const form = req.formId ? RETRIEVAL_FORMS.find(f => f.id === req.formId) : null
      if (req.formId && !form) return { ok: false, error: 'That form no longer exists.' }
      const rendered = renderTicketMessage(copy, { subject: template.subject, body: template.body, formHtml: form ? (RETRIEVAL_FORM_CONTENT[form.id] ?? '') : null }, { charging: req.kind === 'charging' })
      // A manual send was composed and sent by the operator from their own email
      // client, so the in-app placeholder guard and the mock mail server (which
      // only models the app's own sending) don't apply to it.
      if (!req.manual && rendered.issues.length && !allowUnresolvedSends.value) {
        const n = rendered.issues.length
        return { ok: false, error: `Resolve ${n} placeholder${n === 1 ? '' : 's'} before sending: ${rendered.issues.map(i => i.code).join(', ')}. Nothing was sent.` }
      }
      if (!req.manual && failNextSend.value) {
        failNextSend.value = false
        return { ok: false, error: 'The mail server did not accept the message. Nothing was sent. Try again.' }
      }
      recordSend(copy, req, form?.name ?? null)
      if (req.manual) pushHistory(copy, `Recorded as sent from outside the system (manual send by ${currentUserName()})`, 'send')
      const email: SentEmail = {
        id: crypto.randomUUID(),
        kind: req.kind,
        stage: req.stage,
        templateKey: req.templateKey,
        formId: req.formId,
        to: req.to,
        cc: req.cc,
        bcc: req.bcc,
        subject: rendered.subject,
        html: rendered.html,
        formHtml: rendered.formHtml,
        status: 'sent',
        sentExternally: req.manual === true,
        sentBy: currentUserName(),
        sentAt: new Date().toISOString(),
        idempotencyKey: req.idempotencyKey
      }
      copy.emails = [email, ...(copy.emails ?? [])]
      return { ok: true, data: { ticket: copy, email } }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }
}

/**
 * Brings a form copy saved in localStorage up to the current charging-form
 * wording. Saved copies shadow the base content, so the edits are applied as
 * targeted, repeatable replacements (never an overwrite) and any other change
 * made in the editor is kept. Safe to run on every load.
 * Prototype only: it exists for browsers holding an older saved copy. A real
 * backend stores one version of each form and has nothing to migrate.
 */
export function migrateChargingFormContent(id: string, html: string): string {
  if (!html || !(id in CHARGING_FORM_PATCHES)) return html
  let out = html
  const swap = (from: string | RegExp, to: string) => { out = out.replace(from, to) }
  if (!out.includes('{{LEADERSHIP_COACH}}')) swap('Client or Account: {{CLIENT_NAME}}<br>', 'Client or Account: {{CLIENT_NAME}}<br>Leadership Coach: {{LEADERSHIP_COACH}}<br>')
  if (!out.includes('{{TARGET_RETURN_DATE}}')) {
    if (id === 'notice-assessment-quotation-pending') swap('<p>Date received: {{DATE_RECEIVED}}', '<p>Return date that was set: {{TARGET_RETURN_DATE}}<br>Date received: {{DATE_RECEIVED}}')
    else swap('Date the return was requested: {{DATE_RETURN_REQUESTED}}<br>', 'Date the return was requested: {{DATE_RETURN_REQUESTED}}<br>Return date that was set: {{TARGET_RETURN_DATE}}<br>')
  }
  swap(/<td><div data-form-field id="f1-condition"[^>]*><\/div><\/td>/, '<td>{{ASSET_CONDITION}}</td>')
  swap('<th>Condition on Receipt</th></tr><tr><td>{{ASSET_NAME}}', '<th>Finding</th></tr><tr><td>{{ASSET_NAME}}')
  swap(/<td><div data-form-field id="f3-condition-found"[^>]*><\/div><\/td>/, '<td>{{ASSET_CONDITION}}</td>')
  if (id === 'atd-settlement-transfer') {
    swap('<td>{{SERIAL_NUMBER}}</td><td>{{AMOUNT_FIGURES}}</td>', '<td>{{SERIAL_NUMBER}}</td><td>{{ASSET_CONDITION}}</td>')
    if (!out.includes('{{SUPPORTING_DOC_REF}}')) swap('Basis of the amount: {{AMOUNT_BASIS}}<br>Amount in figures', 'Basis of the amount: {{AMOUNT_BASIS}}<br>Supporting document reference: {{SUPPORTING_DOC_REF}}<br>Amount in figures')
  }
  swap('the moment damage or non-return is found but', 'the moment damage is found but')
  return out
}
const CHARGING_FORM_PATCHES: Record<string, true> = {
  'atd-loss-damage-non-return': true,
  'atd-settlement-transfer': true,
  'notice-assessment-quotation-pending': true
}

// --- Retrieval forms and email templates ------------------------------------
//
// The browser's own copy of what the editors save, one record per form and per template. On top
// of the shipped content (app/mocks) it holds what was created, edited or deleted here.

interface SavedRecords<T> {
  records: Record<string, T>
  /** Ids of shipped records that were deleted, so they stay deleted. */
  deleted: string[]
}

function readSaved<T>(key: string): SavedRecords<T> {
  const empty: SavedRecords<T> = { records: {}, deleted: [] }
  if (typeof window === 'undefined') return empty
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Partial<SavedRecords<T>>
    return { records: parsed.records ?? {}, deleted: parsed.deleted ?? [] }
  } catch {
    return empty
  }
}

function writeSaved<T>(key: string, value: SavedRecords<T>) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable: it still works for this session */ }
}

const FORMS_KEY = 'ams:mock:retrievalForms'
const TEMPLATES_KEY = 'ams:mock:emailTemplates'

type SavedForm = Omit<RetrievalFormRecord, 'system'>
type SavedTemplate = Omit<EmailTemplateRecord, 'system'>

const shippedForms = (): RetrievalFormRecord[] => camelizeKeys<(RetrievalForm & { content: string })[]>(retrievalFormRows)
  .map(form => ({ ...form, sections: [], versions: [], system: true }))

const retrievalForms: ApiClient['retrievalForms'] = {
  async list() {
    const saved = readSaved<SavedForm>(FORMS_KEY)
    const out: RetrievalFormRecord[] = []
    const shippedIds = new Set<string>()
    for (const base of shippedForms()) {
      shippedIds.add(base.id)
      if (saved.deleted.includes(base.id)) continue
      const record: RetrievalFormRecord = saved.records[base.id] ? { ...deepClone(saved.records[base.id]!), system: true } : base
      // A saved copy with blank content (an editor session that lost it) gets the shipped content back.
      if (!record.content?.trim()) record.content = base.content
      record.content = migrateChargingFormContent(base.id, record.content)
      out.push(record)
    }
    for (const [id, record] of Object.entries(saved.records)) {
      if (!shippedIds.has(id)) out.push({ ...deepClone(record), system: false })
    }
    return out
  },

  async save(record): Promise<ApiResult> {
    const saved = readSaved<SavedForm>(FORMS_KEY)
    saved.records[record.id] = deepClone(record)
    saved.deleted = saved.deleted.filter(id => id !== record.id)
    writeSaved(FORMS_KEY, saved)
    return { ok: true, data: undefined }
  },

  async remove(id): Promise<ApiResult> {
    const saved = readSaved<SavedForm>(FORMS_KEY)
    delete saved.records[id]
    if (shippedForms().some(f => f.id === id) && !saved.deleted.includes(id)) saved.deleted.push(id)
    writeSaved(FORMS_KEY, saved)
    return { ok: true, data: undefined }
  }
}

/**
 * Shipped subjects carry the employee ID after the name. A saved copy in the
 * browser shadows the shipped one, so it is brought up to date by one targeted,
 * repeatable insert (any other subject edit is kept). Prototype only, like
 * migrateChargingFormContent.
 */
function migrateTemplateSubject(subject: string): string {
  if (!subject || subject.includes('{{EMPLOYEE_ID}}') || !subject.includes('{{TM_FULL_NAME}}')) return subject
  return subject.replace('{{TM_FULL_NAME}}', '{{TM_FULL_NAME}} ({{EMPLOYEE_ID}})')
}

const shippedTemplates = (): EmailTemplateRecord[] => camelizeKeys<(EmailTemplate & { key: string })[]>(emailTemplateRows).map(({ key, ...t }) => ({
  key,
  system: true,
  runtime: {
    name: t.name,
    mode: t.mode,
    description: t.when,
    subject: t.subject,
    body: t.body.split('\n').join('<br>'),
    cc: [{ email: 'itasset@go.team', locked: true }],
    bcc: [],
    status: 'active',
    attachment: t.attachment ?? 'none',
    attachmentFormId: t.attachmentFormId,
    lastSavedAt: '2026-08-24T04:00:00.000Z',
    nameManuallySet: true
  },
  history: []
}))

const emailTemplates: ApiClient['emailTemplates'] = {
  async list() {
    const saved = readSaved<SavedTemplate>(TEMPLATES_KEY)
    const out: EmailTemplateRecord[] = []
    const shippedKeys = new Set<string>()
    for (const base of shippedTemplates()) {
      shippedKeys.add(base.key)
      if (saved.deleted.includes(base.key)) continue
      if (!saved.records[base.key]) { out.push(base); continue }
      const record: EmailTemplateRecord = { ...deepClone(saved.records[base.key]!), system: true }
      record.runtime.subject = migrateTemplateSubject(record.runtime.subject)
      out.push(record)
    }
    for (const [key, record] of Object.entries(saved.records)) {
      if (!shippedKeys.has(key)) out.push({ ...deepClone(record), system: false })
    }
    return out
  },

  async save(record): Promise<ApiResult> {
    const saved = readSaved<SavedTemplate>(TEMPLATES_KEY)
    saved.records[record.key] = deepClone(record)
    saved.deleted = saved.deleted.filter(key => key !== record.key)
    writeSaved(TEMPLATES_KEY, saved)
    return { ok: true, data: undefined }
  },

  async remove(key): Promise<ApiResult> {
    const saved = readSaved<SavedTemplate>(TEMPLATES_KEY)
    delete saved.records[key]
    if (shippedTemplates().some(t => t.key === key) && !saved.deleted.includes(key)) saved.deleted.push(key)
    writeSaved(TEMPLATES_KEY, saved)
    return { ok: true, data: undefined }
  }
}

// --- Notifications ----------------------------------------------------------

// The browser's store stands in for the database here too: actions raise notifications into it
// (see raiseNotification) and the timed alert scan does the same.
const notifications: ApiClient['notifications'] = {
  async list() {
    return deepClone(NOTIFICATIONS)
  },
  async markRead(ids): Promise<ApiResult> {
    for (const n of NOTIFICATIONS) if (ids.includes(n.id)) n.read = true
    return { ok: true, data: undefined }
  }
}

// --- Client -------------------------------------------------------------------

export const mockApi: ApiClient = {
  async loadMasterData(): Promise<MasterData> {
    return {
      courierProviders: camelizeKeys(courierProviders),
      courierBranches: camelizeKeys(courierBranches),
      assetTeam: camelizeKeys(users),
      hrisDirectory: camelizeKeys(hrisDirectory),
      checklistTemplates: await checklistTemplates.list()
    }
  },
  tickets,
  emails,
  notifications,
  retrievalForms,
  emailTemplates,
  checklistTemplates
}
