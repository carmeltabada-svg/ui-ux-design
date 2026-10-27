import { hydrateTicketsFromStorage, watchTicketsToStorage, flushTicketsToStorage } from '~/utils/ticketStorage'

export default defineStorageSyncPlugin({ hydrate: hydrateTicketsFromStorage, watch: watchTicketsToStorage, flush: flushTicketsToStorage })
