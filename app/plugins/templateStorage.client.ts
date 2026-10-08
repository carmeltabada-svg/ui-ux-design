import { hydrateTemplatesFromStorage, watchTemplatesToStorage, flushTemplatesToStorage } from '~/utils/templateStorage'

export default defineStorageSyncPlugin({ hydrate: hydrateTemplatesFromStorage, watch: watchTemplatesToStorage, flush: flushTemplatesToStorage })
