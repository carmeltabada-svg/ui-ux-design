import { hydrateFormsFromStorage, watchFormsToStorage, flushFormsToStorage } from '~/utils/formStorage'

export default defineStorageSyncPlugin({ hydrate: hydrateFormsFromStorage, watch: watchFormsToStorage, flush: flushFormsToStorage })
