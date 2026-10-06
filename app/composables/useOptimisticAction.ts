// Optimistic UI with a late-arriving loading state (open item #3).
//
// Pattern:
//   const sendAction = useOptimisticAction({ loadingAfterMs: 450 })
//   async function sendNotice() {
//     await sendAction.run(async () => {
//       // the real API call; may resolve fast or slow
//       await api.sendNotice(ticket.value, payload)
//     })
//   }
//
// Behavior:
//   - By default the UI shows success immediately (the caller renders the
//     SentBanner right after calling `run`). This is the "fast path".
//   - If the promise `run` is given does not resolve within `loadingAfterMs`
//     (default 450ms), `isLoading` flips to true so the caller can show a
//     spinner on the button. This is the "slow path" that was missing: a
//     user clicked, got no feedback, and thought nothing happened.
//   - On completion (resolve or reject), `isLoading` goes false. On reject
//     `isError` flips to true for one tick so the caller can roll back the
//     optimistic view and surface the toast.
//
// This prototype has no backend, so every `run` resolves in the same tick
// and the spinner never appears. It is here so the first real API wiring
// can plug straight in without rebuilding the pattern per button.
export interface OptimisticActionOptions {
  loadingAfterMs?: number
}

export function useOptimisticAction(options: OptimisticActionOptions = {}) {
  const { loadingAfterMs = 450 } = options
  const isLoading = ref(false)
  const isError = ref(false)

  async function run<T>(fn: () => Promise<T> | T): Promise<T | undefined> {
    isError.value = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      // Only start the loading timer if the action is actually async.
      const result = fn()
      if (result && typeof (result as Promise<T>).then === 'function') {
        timeoutId = setTimeout(() => { isLoading.value = true }, loadingAfterMs)
        const awaited = await result
        return awaited
      }
      return result as T
    } catch (err) {
      isError.value = true
      throw err
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
      isLoading.value = false
    }
  }

  return { isLoading, isError, run }
}
