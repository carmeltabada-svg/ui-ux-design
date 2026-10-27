import { watch } from 'vue'
import { deepClone } from '~/utils/deepClone'

/** An api call answers { ok: false, error } instead of throwing when the server refuses; that is not saved. */
function accepted(res: unknown): boolean {
  if (res && typeof res === 'object' && 'ok' in res && (res as { ok: unknown }).ok === false) {
    console.warn('[recordSync] the server refused a change:', (res as { error?: unknown }).error)
    return false
  }
  return true
}

/**
 * Sends changes to a set of records to the server, one record at a time.
 *
 * The editors change the stores in place and autosave as they always did. This watches those
 * stores, works out which records changed since the last save (or were removed), and sends only
 * those: a save for each changed record and a delete for each one that is gone. It never sends the
 * whole set.
 */
export function createRecordSync<T>(options: {
  /** Every record as it is now, by id. */
  records: () => Map<string, T>
  /** The reactive stores `records` reads, so a change to any of them is noticed. */
  sources: object[]
  save: (id: string, record: T) => Promise<unknown>
  remove: (id: string) => Promise<unknown>
  /** How long to wait after the last change before sending. */
  delayMs?: number
}) {
  const sent = new Map<string, string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> = Promise.resolve()

  const snapshot = () => {
    const out = new Map<string, { record: T, json: string }>()
    for (const [id, record] of options.records()) out.set(id, { record, json: JSON.stringify(record) })
    return out
  }

  async function send() {
    const current = snapshot()
    const work: Promise<unknown>[] = []
    for (const [id, { record, json }] of current) {
      if (sent.get(id) === json) continue
      // Marked as sent only once the server has taken it, so a failure is tried again on the next change.
      work.push(options.save(id, deepClone(record)).then((res) => { if (accepted(res)) sent.set(id, json) }))
    }
    for (const id of [...sent.keys()]) {
      if (!current.has(id)) work.push(options.remove(id).then((res) => { if (accepted(res)) sent.delete(id) }))
    }
    const results = await Promise.allSettled(work)
    for (const r of results) if (r.status === 'rejected') console.warn('[recordSync] a change could not be saved:', r.reason)
  }

  /** Sends what has changed now, without waiting for the delay. Safe to call at any time. */
  function flush(): Promise<void> {
    clearTimeout(timer)
    running = running.then(send)
    return running
  }

  /** Call once the stores hold what the server returned. What they hold now counts as already saved. */
  function start() {
    sent.clear()
    for (const [id, { json }] of snapshot()) sent.set(id, json)
    watch(options.sources, () => {
      clearTimeout(timer)
      timer = setTimeout(flush, options.delayMs ?? 80)
    }, { deep: true })
  }

  return { start, flush }
}
