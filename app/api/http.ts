// Starter for the real backend. Untested: it follows the paths and response
// envelope proposed in docs/retrieval/DATA_CONTRACT.md (`{ data: ... }`, snake_case,
// Laravel's 422 validation shape) and is meant to be corrected by whoever owns
// the API.
import { camelizeKeys, snakeizeKeys } from './keys'
import { ticketFromResource } from './mappers'
import type { ApiClient, ApiResult, EmailTemplateRecord, MasterData, RetrievalFormRecord, SendEmailResponse } from './types'
import type { ChecklistTemplate } from '~/data/checklistTemplates'
import type { AppNotification } from '~/data/ticketTrackers'

/** First validation message from Laravel's 422 body, else its message, else a generic one. */
function errorMessage(e: unknown): string {
  const data = (e as { data?: { message?: string, errors?: Record<string, string[]> } })?.data
  const first = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined
  return first ?? data?.message ?? 'Something went wrong. Try again.'
}

export function createHttpApi(apiBase: string): ApiClient {
  const request = <T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown) =>
    $fetch<{ data: T }>(`${apiBase}${path}`, { method, body: body === undefined ? undefined : snakeizeKeys(body), credentials: 'include' })

  const list = async <T>(path: string): Promise<T[]> => camelizeKeys<T[]>((await request<unknown[]>('GET', path)).data)

  const write = async <T>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<ApiResult<T>> => {
    try {
      const res = await request<unknown>(method, path, body)
      return { ok: true, data: camelizeKeys<T>(res?.data) }
    } catch (e) {
      return { ok: false, error: errorMessage(e) }
    }
  }

  const checklistTemplates: ApiClient['checklistTemplates'] = {
    list: () => list<ChecklistTemplate>('/checklist-templates'),
    create: input => write<ChecklistTemplate>('POST', '/checklist-templates', input),
    update: (id, input) => write<void>('PATCH',`/checklist-templates/${encodeURIComponent(id)}`, input),
    remove: id => write<void>('DELETE', `/checklist-templates/${encodeURIComponent(id)}`)
  }

  return {
    retrievalForms: {
      list: () => list<RetrievalFormRecord>('/retrieval-forms'),
      save: record => write<void>('PUT', '/retrieval-forms/' + encodeURIComponent(record.id), record),
      remove: id => write<void>('DELETE', '/retrieval-forms/' + encodeURIComponent(id))
    },
    emailTemplates: {
      list: () => list<EmailTemplateRecord>('/email-templates'),
      save: record => write<void>('PUT', '/email-templates/' + encodeURIComponent(record.key), record),
      remove: key => write<void>('DELETE', '/email-templates/' + encodeURIComponent(key))
    },
    notifications: {
      list: () => list<AppNotification>('/notifications'),
      markRead: ids => write<void>('POST', '/notifications/read', { ids })
    },
    tickets: {
      list: async () => (await request<unknown[]>('GET', '/tickets')).data.map(ticketFromResource),
      create: async (input) => {
        try {
          return { ok: true, data: ticketFromResource((await request<unknown>('POST', '/tickets', input)).data) }
        } catch (e) {
          return { ok: false, error: errorMessage(e) }
        }
      },
      act: async (ticketNumber, name, args) => {
        // One route per action: POST /tickets/{ticket_number}/actions/{action-name}. The answer is
        // { data: { ticket, result } }.
        const path = '/tickets/' + ticketNumber + '/actions/' + name.replace(/[A-Z]/g, c => '-' + c.toLowerCase())
        try {
          const res = (await request<{ ticket: unknown, result: unknown }>('POST', path, args)).data
          return { ok: true, data: { ticket: ticketFromResource(res.ticket), result: camelizeKeys(res.result) } }
        } catch (e) {
          return { ok: false, error: errorMessage(e) }
        }
      }
    },
    emails: {
      // POST /tickets/{ticket_number}/emails. The answer is { data: { ticket, email } }. A refusal is a 422.
      send: async (ticketNumber, req) => {
        try {
          const res = (await request<{ ticket: unknown, email: unknown }>('POST', '/tickets/' + ticketNumber + '/emails', req)).data
          return { ok: true, data: { ticket: ticketFromResource(res.ticket), email: camelizeKeys<SendEmailResponse['email']>(res.email) } }
        } catch (e) {
          return { ok: false, error: errorMessage(e) }
        }
      }
    },
    async loadMasterData(): Promise<MasterData> {
      const [courierProviders, courierBranches, assetTeam, hrisDirectory, templates] = await Promise.all([
        list<MasterData['courierProviders'][number]>('/courier-providers'),
        list<MasterData['courierBranches'][number]>('/courier-branches'),
        list<MasterData['assetTeam'][number]>('/asset-team'),
        list<MasterData['hrisDirectory'][number]>('/hris/team-members'),
        checklistTemplates.list()
      ])
      return { courierProviders, courierBranches, assetTeam, hrisDirectory, checklistTemplates: templates }
    },
    checklistTemplates
  }
}
