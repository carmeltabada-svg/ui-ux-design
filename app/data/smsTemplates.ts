// The eleven companion SMS templates (SMS-1A to SMS-11) from FR-003.12, word for
// word as the Asset Team supplied them. Copy-paste only, no gateway: AMS stages
// the text and the operator sends it from their own phone, then confirms it.
//
// Tokens: {NAME} is the team member's first name, {REF} the APR reference,
// {DATE} depends on the template (see dateKind): the ticket's Target Date for
// most, today's date for the non-compliance notice ("as of").

export type SmsDateKind = 'target' | 'asof' | 'none'

export interface SmsTemplate {
  code: string
  label: string
  dateKind: SmsDateKind
  texts: { onsite?: string, remote?: string }
  /** The Asset Team's own sending guidance, shown beside the text. */
  note?: { type: 'info' | 'warning', text: string }
}

export const SMS_TEMPLATES: SmsTemplate[] = [
  {
    "code": "SMS-1A",
    "label": "Return notice, resignation",
    "dateKind": "target",
    "texts": {
      "onsite": "Hi {NAME}, GoTeam Asset Management has issued a formal Equipment Return Notice to your email. Kindly review and act on the instructions at your earliest convenience. Target return date: {DATE}. For inquiries, contact itasset@go.team. Ref: {REF}.",
      "remote": "Hi {NAME}, GoTeam Asset Management has issued a formal Equipment Return Notice to your email. Kindly review and act on the instructions at your earliest convenience. Target dispatch date: {DATE}. For inquiries, contact itasset@go.team. Ref: {REF}."
    }
  },
  {
    "code": "SMS-1B",
    "label": "Return notice, immediate resignation",
    "dateKind": "target",
    "texts": {
      "onsite": "Hi {NAME}, GoTeam Asset Management has issued an urgent Equipment Return Notice to your email following your immediate resignation. Kindly act on the instructions without delay. Target return date: {DATE}. For inquiries, contact itasset@go.team. Ref: {REF}.",
      "remote": "Hi {NAME}, GoTeam Asset Management has issued an urgent Equipment Return Notice to your email following your immediate resignation. Kindly act on the instructions without delay. Target dispatch date: {DATE}. For inquiries, contact itasset@go.team. Ref: {REF}."
    }
  },
  {
    "code": "SMS-2",
    "label": "Return notice, end of contract",
    "dateKind": "target",
    "texts": {
      "onsite": "Hi {NAME}, GoTeam Asset Management has issued a formal Equipment Return Notice to your email as your contract concludes. Kindly review and act on the instructions at your earliest convenience. Target return date: {DATE}. For inquiries, contact itasset@go.team. Ref: {REF}.",
      "remote": "Hi {NAME}, GoTeam Asset Management has issued a formal Equipment Return Notice to your email as your contract concludes. Kindly review and act on the instructions at your earliest convenience. Target dispatch date: {DATE}. For inquiries, contact itasset@go.team. Ref: {REF}."
    }
  },
  {
    "code": "SMS-3",
    "label": "Return notice, sabbatical",
    "dateKind": "target",
    "texts": {
      "onsite": "Hi {NAME}, GoTeam Asset Management has issued a formal Equipment Return Notice to your email in advance of your approved leave. Kindly review and act on the instructions at your earliest convenience. Target return date: {DATE}. For inquiries, contact itasset@go.team. Ref: {REF}.",
      "remote": "Hi {NAME}, GoTeam Asset Management has issued a formal Equipment Return Notice to your email in advance of your approved leave. Kindly review and act on the instructions at your earliest convenience. Target dispatch date: {DATE}. For inquiries, contact itasset@go.team. Ref: {REF}."
    }
  },
  {
    "code": "SMS-4",
    "label": "Return notice, recalled",
    "dateKind": "target",
    "texts": {
      "onsite": "Hi {NAME}, GoTeam Asset Management has issued a formal Equipment Return Notice to your email based on a change in your employment status. GoTeam will coordinate all retrieval logistics on your behalf. Target return date: {DATE}. For inquiries, contact itasset@go.team. Ref: {REF}.",
      "remote": "Hi {NAME}, GoTeam Asset Management has issued a formal Equipment Return Notice to your email based on a change in your employment status. GoTeam will coordinate all retrieval logistics on your behalf. Target dispatch date: {DATE}. For inquiries, contact itasset@go.team. Ref: {REF}."
    }
  },
  {
    "code": "SMS-5",
    "label": "Security notice, unexplained absence",
    "dateKind": "target",
    "texts": {
      "remote": "Hi {NAME}, GoTeam Asset Management has issued a formal Equipment Security Notice to your email. Kindly return all assigned equipment by {DATE}. If no response is received, GoTeam will proceed with a courier collection from your address on record. Ref: {REF}."
    },
    "note": {
      "type": "warning",
      "text": "Unexplained Absence retrievals are Remote by default. Verify the team member's mobile number is active on record before sending."
    }
  },
  {
    "code": "SMS-6",
    "label": "Midpoint reminder",
    "dateKind": "target",
    "texts": {
      "onsite": "Hi {NAME}, this is a follow-up from GoTeam Asset Management. Your Equipment Return Notice remains outstanding. Kindly check your email and act on the instructions provided. Target return date: {DATE}. For inquiries, contact itasset@go.team. Ref: {REF}.",
      "remote": "Hi {NAME}, this is a follow-up from GoTeam Asset Management. Your Equipment Return Notice remains outstanding. Kindly check your email and act on the instructions provided. Target dispatch date: {DATE}. For inquiries, contact itasset@go.team. Ref: {REF}."
    },
    "note": {
      "type": "info",
      "text": "Send when no response has been received by the midpoint of the return window."
    }
  },
  {
    "code": "SMS-7",
    "label": "Final reminder",
    "dateKind": "target",
    "texts": {
      "onsite": "Hi {NAME}, GoTeam Asset Management is issuing a final reminder. Your equipment return is due {DATE} and no action has been recorded. Kindly act immediately. For urgent assistance, contact itasset@go.team or +63 9189225962. Ref: {REF}.",
      "remote": "Hi {NAME}, GoTeam Asset Management is issuing a final reminder. Your equipment dispatch is due {DATE} and no action has been recorded. Kindly act immediately. For urgent assistance, contact itasset@go.team or +63 9189225962. Ref: {REF}."
    },
    "note": {
      "type": "info",
      "text": "Send on the business day before or the morning of the target date."
    }
  },
  {
    "code": "SMS-8",
    "label": "Tracking number received",
    "dateKind": "none",
    "texts": {
      "remote": "Hi {NAME}, GoTeam Asset Management has received and logged your tracking number. Your shipment is being monitored. We will notify you once your equipment has been received at our office. Ref: {REF}."
    },
    "note": {
      "type": "info",
      "text": "Remote retrievals only. Send once the tracking number has been received and logged on the ticket."
    }
  },
  {
    "code": "SMS-9",
    "label": "Equipment received",
    "dateKind": "none",
    "texts": {
      "onsite": "Hi {NAME}, GoTeam Asset Management confirms receipt of your returned equipment. Your return has been recorded and your retrieval ticket is now closed. Thank you for your cooperation. Ref: {REF}.",
      "remote": "Hi {NAME}, GoTeam Asset Management confirms receipt of your returned equipment. Your return has been recorded and your retrieval ticket is now closed. Thank you for your cooperation. Ref: {REF}."
    },
    "note": {
      "type": "info",
      "text": "Send once equipment has been physically received and inspected at the GoTeam office."
    }
  },
  {
    "code": "SMS-10",
    "label": "Non-compliance notice",
    "dateKind": "asof",
    "texts": {
      "onsite": "Hi {NAME}, GoTeam Asset Management is formally noting that your equipment return remains outstanding as of {DATE}. Non-compliance has been recorded. Kindly contact itasset@go.team immediately to resolve this matter. Ref: {REF}.",
      "remote": "Hi {NAME}, GoTeam Asset Management is formally noting that your equipment return remains outstanding as of {DATE}. Non-compliance has been recorded. Kindly contact itasset@go.team immediately to resolve this matter. Ref: {REF}."
    },
    "note": {
      "type": "warning",
      "text": "Send after the target date has passed with no action. Applies to all paths except Unexplained Absence (it uses the courier pickup text instead)."
    }
  },
  {
    "code": "SMS-11",
    "label": "Courier pickup, unexplained absence",
    "dateKind": "target",
    "texts": {
      "remote": "Hi {NAME}, GoTeam Asset Management will be arranging a courier collection of your assigned equipment from your address on record on {DATE}. Kindly ensure the equipment is available and accessible. For coordination, contact itasset@go.team. Ref: {REF}."
    },
    "note": {
      "type": "warning",
      "text": "Unexplained Absence only. Send after GoTeam has confirmed the courier booking from the team member's address on record."
    }
  }
]

const BY_CODE = new Map(SMS_TEMPLATES.map(t => [t.code, t]))
export const smsTemplateByCode = (code: string) => BY_CODE.get(code)

/**
 * Which SMS belongs to which stage, from FR-003.6 and the templates' own notes.
 * A6 carries the notice SMS for the ticket's reason ("Email plus SMS"; SMS-3 is
 * Sabbatical, which AMS has no path for yet). A7's follow-up text is separate
 * (see CALL_ESCALATION_SMS_TEMPLATE). SMS-9 reads "your retrieval ticket is now
 * closed", so it goes at Closure. SMS-10 is every path except Unexplained
 * Absence, which uses SMS-11 at the courier pickup instead.
 */
export function smsCodesForStage(reason: string, stage: string): string[] {
  switch (stage) {
    case 'A6': {
      const byReason: Record<string, string> = {
        'resignation': 'SMS-1A',
        'immediate-resignation': 'SMS-1B',
        'end-of-contract': 'SMS-2',
        'recalled': 'SMS-4',
        'unexplained-absence': 'SMS-5'
      }
      return byReason[reason] ? [byReason[reason]!] : []
    }
    case 'A8': return ['SMS-6', 'SMS-7']
    case 'B9': return reason === 'unexplained-absence' ? ['SMS-11'] : []
    case 'B11': return ['SMS-8']
    case 'A9': return reason === 'unexplained-absence' ? [] : ['SMS-10']
    case 'A13': return ['SMS-9']
    default: return []
  }
}
