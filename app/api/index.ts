// The only module pages and stores use to reach the server. `apiMode` picks the
// implementation: 'mock' (default, fixtures in app/mocks) or 'http' (the real
// backend). Set NUXT_PUBLIC_API_MODE=http to switch without code changes.
import type { ApiClient } from './types'

let client: ApiClient | null = null

/** Called once at startup (plugins/masterData.ts), before any page renders. */
export async function initApi(mode: string, apiBase: string): Promise<ApiClient> {
  client = mode === 'http'
    ? (await import('./http')).createHttpApi(apiBase)
    : (await import('./mock')).mockApi
  return client
}

export function api(): ApiClient {
  if (!client) throw new Error('The api layer is not initialised. initApi() runs in plugins/masterData.ts.')
  return client
}
