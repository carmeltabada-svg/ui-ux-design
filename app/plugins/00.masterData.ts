import { initApi } from '~/api'
import { setTicketMirrorEnabled } from '~/utils/ticketStorage'
import { applyMasterData, applyNotifications, applyTickets } from '~/data/ticketTrackers'
import { applyTemplateRecords } from '~/data/templateRuntime'
import { applyFormRecords } from '~/data/retrievalForms'

// Reference data and tickets are loaded before the first page renders, so every
// page can keep reading them synchronously. Reference data comes first, because
// tickets refer to it (couriers, Asset Team members).
export default defineNuxtPlugin(async () => {
  const { apiMode, apiBase } = useRuntimeConfig().public
  setTicketMirrorEnabled(apiMode === 'mock')
  const client = await initApi(apiMode, apiBase)
  applyMasterData(await client.loadMasterData())
  applyTickets(await client.tickets.list())
  applyNotifications(await client.notifications.list())
  applyTemplateRecords(await client.emailTemplates.list())
  applyFormRecords(await client.retrievalForms.list())
})
