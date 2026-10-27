// Fires a one-shot "ready to proceed" pulse on a stage's primary button the
// moment the stage first becomes satisfied. Revisiting the stage does not
// re-pulse: once a (ticketId + stageKey) pair has pulsed, it stays pulsed
// for the rest of the session (open item 5 Oct 2026 mid-turn).
//
// Usage:
//   const pulse = useReadyPulse(computed(() => `${ticket.value?.id}:${stageKey.value}`), computed(() => stageReady.value))
//   <UButton :class="{ 'btn-ready-pulse': pulse.active.value }" ...>
//
// `active` is true for `durationMs` after the stage first transitions
// from not-ready to ready; it also stays false if the stage was already
// ready when the composable started (so navigating back to an already-done
// stage never pulses).
const PULSED = new Set<string>()
const DURATION_MS = 3200 // matches the 2 × 1.5s CSS iteration plus a small buffer

export function useReadyPulse(key: Ref<string>, ready: Ref<boolean>, durationMs = DURATION_MS) {
  const active = ref(false)
  let timer: ReturnType<typeof setTimeout> | null = null

  function fire() {
    const k = key.value
    if (!k || PULSED.has(k)) return
    PULSED.add(k)
    active.value = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { active.value = false }, durationMs)
  }

  // Fire only on a false → true transition (never on the initial watch tick
  // if the stage is already ready, which means it was satisfied in a prior
  // visit).
  let seenReady = ready.value
  // The key watcher is registered first so that, when a page loads its ticket after mounting (the key
  // goes from '' to the ticket's id in the same tick the ready state turns true), it absorbs the new
  // ready state before the ready watcher runs. Otherwise the load itself counts as a transition and
  // spends the one-shot pulse before the operator has done anything.
  watch(key, () => { seenReady = ready.value })
  watch(ready, (now) => {
    if (now && !seenReady) fire()
    seenReady = now
  })

  onBeforeUnmount(() => { if (timer) clearTimeout(timer) })

  return { active }
}
