// Turns what the API returns into what the front end holds, where the two differ
// by more than letter case. Everything else goes through camelizeKeys alone.
import { camelizeKeys } from './keys'
import type { Ticket } from '~/data/ticketTrackers'

/** A checklist item as the API returns it: one object per task. */
interface ChecklistRow {
  text: string
  required: boolean
  done: boolean
  doneBy: string | null
}

// The API uses plain names. The front end's own names carry a suffix or an
// abbreviation (`...ISO`, `Idx`) that would read badly in snake_case, so they
// are renamed here, in one place.
const TICKET_RENAMES: Record<string, string> = {
  targetDate: 'targetDateISO',
  separationDate: 'sep',
  stageIndex: 'stageIdx',
  furthestStageIndex: 'furthestStageIdx',
  quotationReceivedOn: 'quotationReceivedISO'
}
const TARGET_DATE_CHANGE_RENAMES: Record<string, string> = {
  previousDate: 'previousDateISO',
  newDate: 'newDateISO'
}

function rename(obj: Record<string, unknown>, map: Record<string, string>) {
  for (const [from, to] of Object.entries(map)) {
    if (from in obj) {
      obj[to] = obj[from]
      delete obj[from]
    }
  }
}

/**
 * One ticket from the API. The checklist arrives as a list of tasks. The front
 * end keeps it as four arrays indexed together (items, done, optional, done by),
 * so they are rebuilt here.
 */
export function ticketFromResource(resource: unknown): Ticket {
  const { checklist = [], ...ticket } = camelizeKeys<Record<string, unknown> & { checklist?: ChecklistRow[] }>(resource)
  rename(ticket, TICKET_RENAMES)
  if (Array.isArray(ticket.targetDateHistory)) {
    for (const change of ticket.targetDateHistory as Record<string, unknown>[]) rename(change, TARGET_DATE_CHANGE_RENAMES)
  }
  return {
    ...ticket,
    checklistItems: checklist.map(c => c.text),
    checklistDone: checklist.map(c => c.done),
    checklistOptional: checklist.map(c => !c.required),
    checklistDoneBy: checklist.map(c => c.doneBy)
  } as unknown as Ticket
}
