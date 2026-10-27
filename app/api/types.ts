import type { AssetTeamMember, CourierBranch, CourierProvider, HrisRecord } from '~/data/ticketTrackers'
import type { ChecklistTask, ChecklistTemplate } from '~/data/checklistTemplates'
import type { FormSection, RetrievalForm } from '~/data/retrievalForms'
import type { TemplateRuntime, TemplateSnapshot } from '~/data/templateRuntime'
import type { AppNotification, DeductionOutcome, EmailSendKind, SentEmail, StageKey, Ticket, TicketMode, TicketReason } from '~/data/ticketTrackers'

/**
 * Reference data loaded once at startup. The stores in `app/data/*.ts` hold it
 * as a client cache, filled by `applyMasterData()`.
 */
export interface MasterData {
  courierProviders: CourierProvider[]
  courierBranches: CourierBranch[]
  /** The Asset Team users a ticket can be assigned to. */
  assetTeam: AssetTeamMember[]
  /** Team member records from HRIS/R24. External and read only. */
  hrisDirectory: HrisRecord[]
  checklistTemplates: ChecklistTemplate[]
}

/** A retrieval form as the server holds it: the form, its document (HTML), its legacy sections and its saved versions. */
export interface RetrievalFormRecord extends RetrievalForm {
  content: string
  sections: FormSection[]
  versions: unknown[]
  /** True for a form that ships with the product, false for one created in the app. The server sets it. */
  system: boolean
}

/** An email template as the server holds it: its content and settings, and its saved versions. */
export interface EmailTemplateRecord {
  key: string
  runtime: TemplateRuntime
  history: TemplateSnapshot[]
  /** True for a template that ships with the product, false for one created in the app. The server sets it. */
  system: boolean
}

/**
 * What a write returns. A rejected write (validation, a business rule) is
 * `ok: false` with a message the page can show as is. The real backend's 422
 * response is turned into this by `http.ts`.
 */
export type ApiResult<T = void> = { ok: true, data: T } | { ok: false, error: string }

/**
 * Every change to an existing ticket is one of these actions. The browser asks for it by
 * name with its arguments; the server applies it, writes the history, and returns the
 * updated ticket. The arguments of each are the parameters of the function of the same
 * name in `data/ticketTrackers.ts`, as an object.
 */
export type TicketActionName =
  | 'setChecklistDone'
  | 'addChecklistItem'
  | 'removeChecklistItem'
  | 'toggleChecklistRequired'
  | 'applyChecklistTemplate'
  | 'reorderChecklistItem'
  | 'finalizeChecklist'
  | 'advanceStage'
  | 'confirmAssets'
  | 'rebaselineTargetDate'
  | 'acknowledgeHrisUpdate'
  | 'releaseGate'
  | 'goBackStage'
  | 'goForwardStage'
  | 'jumpToStage'
  | 'verifyContact'
  | 'setContactNumber'
  | 'setTeamMemberAddressOverride'
  | 'confirmCourierBranch'
  | 'sendBranchRequest'
  | 'confirmSmsSentFor'
  | 'markBranchReplyReceived'
  | 'confirmInTransit'
  | 'saveShipmentDetails'
  | 'notifyItLock'
  | 'skipItNotice'
  | 'issueGatePass'
  | 'changeReasonAndMode'
  | 'takeOverTicket'
  | 'cancelRetrieval'
  | 'confirmReferredToPayroll'
  | 'saveQuotationDetails'
  | 'openChargeCaseForItems'
  | 'recordNoticeSent'
  | 'recordSafekeepingSent'
  | 'recordCallAttempt'
  | 'continueAfterCalls'
  | 'recordSmsFollowUpSent'
  | 'recordReminderSent'
  | 'recordReminderSkipped'
  | 'recordEquipmentNotReturned'
  | 'recordEquipmentReceived'
  | 'clearChargingClassification'
  | 'recordOverdueReminderSent'
  | 'recordEvidence'
  | 'recordDeductionNotApplicable'
  | 'recordDeductionOutcome'
  | 'continueAfterCharging'
  | 'recordInspection'
  | 'closeTicket'
  | 'reopenClosedTicket'
  | 'updateTicketFields'

/** What an action returns: the updated ticket, and whatever the action itself answers (a gate pass, true or false, an ok or an error). */
export interface TicketActionResponse {
  ticket: Ticket
  result: unknown
}

/**
 * What the create form sends. The server fills in the rest: the team member's dates,
 * contact details and assets come from HRIS, and the id, number, reference and token
 * are its own. The team member who is signed in is the default assignee.
 */
export interface NewTicketInput {
  /** The team member's id in HRIS (for example 'EMP-03310'). */
  employeeId: string
  reason: TicketReason
  mode: TicketMode
  authorizingEndorsement: string
  /** YYYY-MM-DD. */
  authorizingEndorsementDate: string
  /** YYYY-MM-DD. Only for the Recalled paths. */
  recallEffectiveDate?: string
  /** The prototype's Asset Team members have no id, so the email identifies one. */
  assigneeEmail?: string
  /** Why the operator changed the reason away from the one HRIS suggested. */
  reasonOverrideNote?: string
  /** Why the operator changed the mode away from the one derived from the address. */
  modeOverrideNote?: string
}

/**
 * One email a ticket stage sends. The server renders the template and form from the ticket's own data, refuses it
 * while a placeholder cannot be filled, sends it, keeps a snapshot, and writes the history entry. The browser never
 * sends rendered content.
 */
export interface SendEmailRequest {
  stage: StageKey
  kind: EmailSendKind
  templateKey: string
  /** The form to attach, or null for none. */
  formId: string | null
  to: string[]
  cc: string[]
  bcc: string[]
  /** A new UUID per send attempt the operator makes. A retry of the same attempt reuses it. */
  idempotencyKey: string
  /** Only for kind 'charging': the outcome being sent. */
  outcome?: DeductionOutcome
  /**
   * The operator sent this email themselves, from outside the system (e.g. their
   * own Outlook), and is confirming it here. The stage still advances and the
   * send is recorded, but the mock mail server is bypassed (no simulated
   * failure), the in-app placeholder guard is skipped (they authored their own
   * copy), and the record is flagged as an external send.
   */
  manual?: boolean
}

export interface SendEmailResponse {
  ticket: Ticket
  email: SentEmail
}

export interface ChecklistTemplateInput {
  name: string
  tasks: ChecklistTask[]
  /** 'reason:mode' keys ('resignation:remote'), or '*' for every path without a more specific template. */
  defaultFor: string[]
}

export interface ApiClient {
  retrievalForms: {
    list(): Promise<RetrievalFormRecord[]>
    /** Creates or updates one form. The id is the form's slug or a UUID chosen by the browser. */
    save(record: Omit<RetrievalFormRecord, 'system'>): Promise<ApiResult>
    remove(id: string): Promise<ApiResult>
  }
  emailTemplates: {
    list(): Promise<EmailTemplateRecord[]>
    /** Creates or updates one template. The key is its template key (t1) or a UUID chosen by the browser. */
    save(record: Omit<EmailTemplateRecord, 'system'>): Promise<ApiResult>
    remove(key: string): Promise<ApiResult>
  }
  notifications: {
    /** The signed in user's notifications, newest first. The server raises them (a takeover, an overdue ticket, a reply). */
    list(): Promise<AppNotification[]>
    /** Marks these notifications as read. */
    markRead(ids: string[]): Promise<ApiResult>
  }
  loadMasterData(): Promise<MasterData>
  tickets: {
    /** Every ticket the signed in user can see. The developer may page this. */
    list(): Promise<Ticket[]>
    /** Creates a ticket and returns it, complete. Rejected with a message when the rules say no. */
    create(input: NewTicketInput): Promise<ApiResult<Ticket>>
    /** Applies one action to a ticket. Rejected with a message when the rules say no. */
    act(ticketNumber: number, name: TicketActionName, args: Record<string, unknown>): Promise<ApiResult<TicketActionResponse>>
  }
  emails: {
    /** Sends one stage email for a ticket. Rejected with a message when it cannot be sent (a placeholder the ticket cannot fill, the mail server refusing it). Nothing changes on a rejection. */
    send(ticketNumber: number, request: SendEmailRequest): Promise<ApiResult<SendEmailResponse>>
  }
  checklistTemplates: {
    list(): Promise<ChecklistTemplate[]>
    create(input: ChecklistTemplateInput): Promise<ApiResult<ChecklistTemplate>>
    update(id: string, input: ChecklistTemplateInput): Promise<ApiResult>
    remove(id: string): Promise<ApiResult>
  }
}
