// Demo-only switches, toggled from the top bar's Simulation Control (flask
// icon). Persisted per browser so a demo setup survives a reload; off by
// default so normal use always gets the real guardrails.
const KEY_ALLOW_UNRESOLVED = 'ams:demo:allowUnresolvedSends'

function read(key: string): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem(key) === '1' } catch { return false }
}

/** When on, sends go out even if their email/form still has unresolved placeholders (the send guardrail only warns). */
export const allowUnresolvedSends = ref(read(KEY_ALLOW_UNRESOLVED))

if (typeof window !== 'undefined') {
  watch(allowUnresolvedSends, (v) => {
    try { v ? localStorage.setItem(KEY_ALLOW_UNRESOLVED, '1') : localStorage.removeItem(KEY_ALLOW_UNRESOLVED) } catch {}
  })
}

// --- Checklist final-review rule ---------------------------------------
//
// Finalised 5 Oct 2026 (open items #11, #34). FR-003.11 applies no
// segregation of duties, so the policy is "anyone on the Asset Team can sign
// off". For real accountability without changing the policy, every task's
// "Done by" is recorded as it is ticked and shown next to the task, and the
// final sign-off records who signed. The reviewer may also leave a short
// note that is kept with the sign-off record.
//
// The Simulation Control switch that offered four rules while this was being
// decided is gone, and so are the designated-reviewer list and the "a
// different person must sign" path. `reviewerRule` is kept as a frozen const
// so any older call-site reading it keeps compiling until it is cleaned up.
export type ReviewerRule = 'anyone'
export const reviewerRule = { value: 'anyone' as const } as const

// --- Prototype simulator bar -------------------------------------------
//
// Verification scaffolding, not a product feature: a persistent strip at the
// very top of the layout (SharedSimulatorBar) so every state, role, scenario
// and situation of the retrieval screens can be reviewed without rebuilding
// anything. None of these values are saved to tickets, and the first three
// reset on reload so a forgotten setting never survives into a real review.
// Only whether the bar is shown is remembered.
export type SimState = 'populated' | 'loading' | 'notfound' | 'error'
export type SimScenario = 'standard' | 'first-timer'
export type SimSituation = 'normal' | 'no-contact'

/** Loading / not found / error views of the ticket workspace and the list. */
export const simState = ref<SimState>('populated')
/** Standard data, or a first-timer who has no tickets yet. */
export const simScenario = ref<SimScenario>('standard')
/** Normal, or the team member has no contact number on file. */
export const simSituation = ref<SimSituation>('normal')

const KEY_SIM_BAR = 'ams:demo:simulatorBar'
export const simulatorBarVisible = ref(typeof window === 'undefined' ? true : (() => { try { return localStorage.getItem(KEY_SIM_BAR) !== '0' } catch { return true } })())
if (typeof window !== 'undefined') {
  watch(simulatorBarVisible, (v) => {
    try { v ? localStorage.removeItem(KEY_SIM_BAR) : localStorage.setItem(KEY_SIM_BAR, '0') } catch {}
  })
}
