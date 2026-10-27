# Ticket Tracker Specification (retrieval tickets)

**Audience:** the developer building the retrieval ticket backend and porting the Ticket Tracker UI.
**Companion to:** [DEV_HANDOFF.md](./DEV_HANDOFF.md) (traps, checklist, verification), [TEMPLATES_SPEC.md](./TEMPLATES_SPEC.md) (the emails and forms the tickets send), [DATA_CONTRACT.md](./DATA_CONTRACT.md) (proposed tables and endpoints), [BACKEND_SWAP.md](./BACKEND_SWAP.md) (how to replace the mock server).

Everything here was read from the code as of 14 October 2026, then checked claim by claim against `main` on 27 October 2026 (the source of truth after pull requests 1 and 2) and corrected. Cites use `file` and symbol names rather than line numbers, because line numbers drift. Where a claim could not be confirmed by reading, it is marked **UNVERIFIED**. Nothing in this file was exercised at every path in a browser; see DEV_HANDOFF section 13 for what was and was not run.

Files referred to:

| Short name | Path |
|---|---|
| `TT` | `app/data/ticketTrackers.ts` (types, matrix, stage lists, derived rules, client wrappers) |
| `TA` | `app/api/ticketActions.ts` (the 52 actions: the stand-in server) |
| `MK` | `app/api/mock.ts` (mock server: create, lists, checklist templates) |
| `WS` | `app/pages/ticket-tracker/[id].vue` (the workspace, about 7,000 lines) |
| `IDX` / `CR` | `app/pages/ticket-tracker/index.vue` / `create.vue` |
| `SM` | `app/data/smsTemplates.ts` |

## 1. How the front end talks to the server

- Every operator button calls a typed wrapper at the bottom of `TT`, which calls `api().tickets.act(ticketNumber, actionName, args)` and then replaces the local ticket with the server's copy. The workspace page makes no other network calls.
- A thrown error becomes a toast; four actions (`finalizeChecklist`, `changeReasonAndMode`, `takeOverTicket`, `cancelRetrieval`) return `{ ok: false, error }` as a value instead.
- Tickets are addressed by **ticket number** in the URL and in the API (`/ticket-tracker/422`), not by the internal `id`. Seed tickets have `id` equal to the employee id (`EMP-xxxxx`); created tickets have a UUID. Pick one id scheme in production.
- The action layer has **no authorization**. The actor is the current persona (`currentUserName()`); any Asset Team user may take every action, including take over, cancel, close and reopen.
- Most actions do not check stage or status (section 6.2 lists what is and is not enforced). A real backend must enforce them.

## 2. Ticket data model

Stored fields (see `Ticket` in `TT`). **Derived values are never stored** (section 4).

| Group | Fields |
|---|---|
| Identity | `id`, `ticketNumber` (`max(421, existing) + 1`), `reference` (`APR-YY-NNNNN`, restarts each January), `auditTrailId` (`AUD-YYYY-NNNNN`), `acknowledgmentToken` (32 hex, public link token) |
| People | `employee` (HRIS snapshot, never edited in AMS), `assignee {name, email}`, `createdBy`, `lastUpdatedBy`, `lastUpdatedAt` |
| Case | `reason`, `mode`, `status` (open or closed), `lwd`, `sep` (copied from HRIS at create), `authorizingEndorsement` and `authorizingEndorsementDate`, `recallEffectiveDate` (recalled only), `gateCount` (0, 1 or 3) |
| Gates | `gatesReleased`, `gateNotes{n}`, `gateReleaseDates{n}` |
| Stage pointer | `stageIdx`, `furthestStageIdx` (high-water mark, never moves back), `overdueForced` (legacy demo flag) |
| Checklist | `checklistItems[]`, `checklistDone[]`, `checklistOptional[]`, `checklistDoneBy[]` (four parallel arrays), `checklistReview {by, at} | null` (an old optional `note` is kept only so older data loads), `checklistNudgeDismissed` |
| Assets | `assetsLocked`, `assets[] {name, model, type, serial, assetTag, checked, remarks, resolution}`, `equipmentNotReturned` |
| Deadline | `targetDateISO` (null until assets are confirmed), `targetDateHistory[] {previousDateISO, newDateISO, reason, actor, when, wasOverdue}` |
| Contact | `contact {number, numberVerified, email, emailVerified, altName, altNumber}` |
| IT lock | `itLock {scheduledConfirmed, scheduledFor, executedConfirmed}`, `itLockNeedsReschedule` |
| Courier | `courierProviderId`, `courierBranchName`, `courierBranchAddress`, `courierBranchSubstituted`, `branchCaptureMethod` (call or email), `branchRequestSentAt`, `branchRequestTemplateKey`, `branchRequestReplyReceived`, `branchReplyDetectedAt`, `teamMemberAddressOverride` |
| Transit | `trackingNumber`, `trackingLink`, `transitTrackingRef`, `transitConfirmedAt` (date only) |
| Calls and texts | `callAttempts[] {when, outcome}`, `smsSentAt` (A7 follow-up), `smsSent{code: ISO}` (per SMS code) |
| Reminders | `reminderCount` (0, 1, 2), `overdueReminderSentAt`, `overdueReminderCount` |
| Gate passes | `gatePass`, `gatePassRef` (GoTeam), `buildingGatePass`, `buildingGatePassRef` |
| Evidence | `evidenceProof`, `evidenceCondition` (`{name, url}`) |
| Charging | `deductionApplicable` (true, false, or null = undecided), `deductionOutcome`, `deductionCase*` (first name and officer overrides, five dates, amount basis, figures, words, supporting doc ref, asset serials, per-serial notes), `quotationReceivedISO`, `quotationReference`, `quotationFileName`, `referredToPayrollAt`, `referredToPayrollBy`; legacy `atdReference`, `deductionDate`, `deductionItem`, `deductionAmount`, `deductionAuthorizedBy` |
| Routing and close | `inspectionRoute` (standard, condition, tampering), `handovers[]`, `cancellation {reason, note, at, by}` |
| HRIS flags | `hrisUpdatePending`, `hrisUpdateChangedAt`, `hrisUpdateAcknowledgedAt` |
| Log | `history[]` `{action, actor, when, category}`, newest first. `when` is a **UTC ISO instant** (formatted for the viewer at display time). `emails[]`: the emails the server sent, each with the rendered subject and body, the attached form, recipients, sender, `sentAt` (UTC) and an idempotency key (section 6.4), plus `id`, `kind`, `stage`, `templateKey`, `status` (queued, sent or failed), `error?` and `sentExternally` (true for a send marked as done outside the system) |

Create seeds (`MK`): `gatesReleased` 0, `stageIdx` 0, `assetsLocked` false, every asset `checked: true`, serials `SN-NNNNN`, tags `GT-AST-NNNN`, checklist copied from the template for the path. The first visible stage is A3.

Create rules the server checks today: unknown employee ("That team member was not found in HRIS.") and an open duplicate ("This team member already has an open retrieval ticket."). **Everything else about create is checked only in the form** (section 7.2) and must be re-enforced by the backend.

Create history: "Entry recorded: authorizing endorsement (+ recorded date) + Last Working Day + Separation Date captured", the two override notes if present, then "Ticket Created - <reference>". If the assignee is not the creator, a notification of kind `assigned` goes to the assignee.

## 3. Reason by mode: deadlines, gates and templates

Gates are advisory: they never block a stage or a send.

| Reason | Gates | Mode | Deadline anchor | Target Date | Notice template |
|---|---|---|---|---|---|
| Resignation | 0 | Onsite | Last Working Day | LWD + 0 days ("within the last 2 days of work") | t1 |
| Resignation | 0 | Remote | LWD | LWD + 3 calendar days | t2 |
| Immediate Resignation | 0 | Onsite | ticket creation date ("notice date") | + 0 | t3 |
| Immediate Resignation | 0 | Remote | ticket creation date | + 3 calendar days | t4 |
| End of Contract | 1 | Onsite | LWD | + 0 | t5 |
| End of Contract | 1 | Remote | LWD | + 3 calendar days | t6 |
| Recalled | 1 | Onsite | Recall Effective Date | + 0 | t9 |
| Recalled | 1 | Remote | Recall Effective Date | + 3 calendar days | t10 |
| Unexplained Absence | 3 | Onsite | not offered | none | none |
| Unexplained Absence | 3 | Remote | LWD (product decision 2026-09-23) | + 3 calendar days | t11 |

- Source: `MATRIX` and `computeTargetDateForPath` in `TT`. All units in use are calendar days; a business-day branch exists but no path uses it.
- Immediate Resignation anchors on `createdAt`, the creation date, not an actual notice date. An LWD change therefore never moves that deadline.
- Business days skip weekends only. There is no holiday calendar. Everything is browser-local time, Manila assumed; there is no timezone setting.
- Other fixed templates: reminders midpoint t12 onsite and t13 remote, final t14 and t15, overdue t16 and t17; courier endorsement t18; charging t22 to t25 (section 5, A11). Template keys t7, t8 and t19 to t21 are not in the seed data (t19, the Equipment Safekeeping Request, is referenced but not drafted).
- Checklist due date: LWD minus 3 business days. The screen says "Due no later than 3 business days before the Last Working Day."
- Checklist template for a new ticket: the template whose `defaultFor` contains `reason:mode`, else the one with `*`, else the first. A ticket gets a **copy**; later edits to the template never reach open tickets.

## 4. Derived values (compute, never store)

| Value | Rule |
|---|---|
| Overdue Return | `overdueForced`, or: status open, Target Date set, **not** having reached A10 or B11, and Target Date strictly before today. The due date itself is not overdue. Reaching B11 (in transit) halts the clock |
| Transit delayed | remote, open, `transitConfirmedAt` set, not at A10 yet, more than 14 days since. Advisory banner, not a status |
| Shipment status | `received` if A10 reached; `not-shipped` if no `transitConfirmedAt`; `delayed`; else `in-transit` |
| Days left label | none if no Target Date or closed; "Overdue by Nd"; "Nd left" (0d left on the due date) |
| Status label (first match wins) | Cancelled; Closed; Custodian Under Review (unexplained absence before assets locked); Overdue Return; In Transit (B11 or B11a); Hold Off (A10, A11, A12); the inspection route status; else Pending Return |
| Inspection route statuses | standard: Returned Device Servicing; condition: Returned Item Check; tampering: Forensic Review |
| Branch capture urgent | remote, no branch yet, LWD within 2 days (or past) |
| IT lock run time | the end of the shift that starts on the LWD; an overnight shift (end at or before start) runs on LWD + 1 day. The shift comes from HRIS and is not stored by AMS |
| Safekeeping available | gateCount 3 and 2 or more gates released but not 3 |
| Path change locks | `the ticket is closed`, `a notice or reminder has been sent` (any history entry of category `send`), `a call has been logged`, `an acknowledgment has been captured` (any gate note or date) |
| Acknowledgment due date | recalled: recall date or Target Date; immediate resignation onsite: next working day after creation; immediate resignation remote: creation + 3 days; unexplained absence: Target Date; others: LWD or Target Date |
| Date requested (charging default) | the earliest history entry of category `send` (any send, not specifically the notice) |
| Date received (charging default) | the earliest `return` history entry containing "Proof-of-Receipt" |

Do not store any of these. `isOverdueReturn` is computed live from the Target Date.

## 5. Stages

Stage lists (`STAGES_ONSITE`, `STAGES_REMOTE`): onsite is A1 to A13; remote adds B8 and B9 after A5 and B11 and B11a after A8. A1, A2 and B11a are **skipped** (no panel): A1 and A2 happen at create, and B11a has no operator action. `currentStageKey` skips them and **rewrites `stageIdx` while being read**; a backend should resolve skip stages at advance time.

Phases: Setup (A3 to A5), Branch and Endorsement (B8, B9; remote), Notice and Confirmation (A6 to A8), Transit (B11, B11a; remote), Return and Evidence (A9 to A12), Closure (A13).

Navigation: Back is hidden at A3 and walks past skipped stages. Forward only goes up to `furthestStageIdx`. A phase or step click on a future stage shows "Not reached yet" / "{label} hasn't been reached yet." Jumping is logged as "Jumped to {stage}" (category `navigation`). **No send or record action advances the stage** except where noted; a sent banner appears and an explicit Continue advances.

Closed tickets stay browsable stage by stage (Back and Forward) but are read only: the stage body is inert and its buttons are hidden.

Guard pattern: a not-ready button is never natively `disabled`. It stays clickable with `aria-disabled` and a tooltip, and a click shows a toast. Toast titles: "Not ready yet" (warning), "Ticket is closed" (neutral), "Already done" (reasons starting "Already"), "Limit reached" (reasons starting "Maximum"). Keep this pattern.

### A3 Offboarding checklist
- Shows "{requiredDone} of {requiredTotal} required" plus optional counts, and a due badge ("Overdue by Nd", "Due today", "Due {date}").
- Required tasks must be done before the checklist can be completed; optional tasks never block it. Tasks can be ticked, switched between Required and Optional, added, removed and reordered (drag or Move up and down). Ticking records who did it.
- "Checklist options": Use a saved checklist (replaces the list; asks to confirm when any item is done because progress is dropped), Save as template (to Master Data), Manage templates. A nudge ("Do this for every ticket?") shows while the list matches no saved template.
- Complete checklist: there is no review step and no reviewer note. Once every required task is done, any Asset Team member presses "Complete checklist" (`finalizeChecklist`, which records `checklistReview {by, at}`, logs "Offboarding checklist completed" and advances). Server errors: "The final review is already signed off." and "Do every required task first."; the page shows the second as a toast titled "Cannot complete the checklist yet". After completion the list is read only and a "Checklist completed" banner shows who completed it. The action still accepts an optional `noteText` (nothing sends it).
- Actions: `setChecklistDone`, `toggleChecklistRequired`, `addChecklistItem`, `removeChecklistItem`, `reorderChecklistItem`, `applyChecklistTemplate`, `finalizeChecklist`.

### A4 IT access lock (a notice to IT, not a gate)
- Locking access is **IT's responsibility, not the Asset Team's**, so this stage never waits on IT. The stage is named "IT access lock" and opens with a banner saying so in plain words, so the Asset Team is not held to account for what IT does or misses.
- Two ways on: **Notify IT and continue** (`notifyItLock`) or **Continue without notifying IT** (`skipItNotice`). Both advance the ticket only when it is still at A4, so a later re-notice never skips a stage. There is no scheduling confirmation and no execution confirmation any more. The old `confirmItLockScheduling` and `confirmItLockExecution` actions are gone.
- `itLock.scheduledConfirmed` now means "IT was notified" and `scheduledFor` is the Last Working Day IT was told. `itLock.executedConfirmed` is no longer set by anything (kept only so older saved tickets load).
- History: "IT notified to lock access at the end of the last shift on <date>. The lock is IT's responsibility" (with " (sent again for the updated Last Working Day)" on a re-notice) and "Continued without notifying IT. The access lock is IT's responsibility". The old "IT lock scheduled ..." and "IT lock executed ..." strings are still recognised by the Activity Log for older tickets.
- If the LWD changes after IT was told, the right rail "IT Access Lock" card shows "IT needs the new date" and a **Notify IT of the new date** button. It does not block anything.
- Removed: the "IT lock not confirmed" notification and its preference option, and the "IT lock" closure check that required execution. The closure check is now "IT told about the access lock" and is informational.
- **Dev work:** the notice to IT is recorded and toasted here; an actual message to IT (email or ticket in their queue) is not built. Wire `notifyItLock` to whatever IT uses.

### A5 Custodian Card and asset confirmation
- Table of assets with a tick and a remarks field per row, "Select All" and "Unselect All", then "Confirm Assets". The list is re-synced from the asset register while not locked (matched by **category name**, so a second unit of one category, such as two monitors, is not added).
- `confirmAssets` locks the list, sets the Target Date from the matrix, logs "Asset list confirmed (x of y) - locked, status moves to Pending Return", and advances.
- **Trap: `confirmAssets` sends no asset data.** The ticks and remarks are edited on the local ticket and never reach the server. The real request must carry `checked` and `remarks` per asset (by serial). The server also does not check that at least one asset is ticked.

### B8 Branch confirmation capture (remote only)
- Courier provider (active only, Recommended or Alternate badge), branch (auto-selected as the nearest to the address on file, by city name in the address), address box, "Captured via" Confirmation call (primary) or Email reply (fallback).
- The address can be corrected for this ticket (`setTeamMemberAddressOverride`; `employee.address` is never changed). Note: the nearest-branch suggestion uses the HRIS address, not the correction.
- Email path: send a reminder (no default template; operator attaches one; placeholder guard applies), then "Mark Reply as Received", or "No reply? Use the branch on file", recorded as a substitution. A reply is requested within 1 business day (alert when late).
- Confirm needs a courier and branch; on the email path also a received reply or a substitution. Action `confirmCourierBranch`, which advances.
- Urgent banner: "The last working day is close" or "...has passed".
- Courier choice and branch selection are local until confirm.

### B9 Courier endorsement (remote only)
- Template fixed to t18, sent to the courier account manager (never the team member). No form attached. Shows "Confirm the courier branch first" until a branch exists.
- `recordNoticeSent` logs "Courier endorsement sent" and does not advance; Continue does. Sits **before** A6 in the remote order.

### A6 Generate and send notice
- Template from the matrix; attached form is the Equipment Return Acknowledgment for the ticket mode (`return-ack-onsite` or `return-ack-remote`). The operator may replace or remove either (tri-state: default, swapped, removed). Pickers list active templates and forms only.
- Recipient: the team member's work email, or a typed personal email.
- Guards in order (skipped for a manual send, see Sending): attach an email ("Attach an email first"), resolve placeholders ("Resolve {n} placeholder(s) before sending" / "Fill in the missing values first."), then `recordNoticeSent` ("Retrieval notice sent (email + SMS)"). A banner and Continue follow.
- Gate tracker ("P&C Acknowledgement", Optional): records the next gate with a note ("Who confirmed this, e.g. via call with P&C"). Action `releaseGate`. For unexplained absence between gates 2 and 3 the operator may log a safekeeping request instead (`recordSafekeepingSent`; the T19 template is not drafted, so it only records history).
- **Sending.** The send button calls one operation, `sendTicketEmail` (section 6.4), with the template key, form id and recipients. The prototype's mock server renders the message, stores a snapshot and writes the same history line as before; **it does not deliver real email**. Each send stage with an email also offers "Mark as sent outside the system" (the notice, the courier endorsement, reminders, the overdue reminder and the charging outcome; not the branch request, and hidden for Quotation Pending). It calls the same operation with `manual: true`: the placeholder guard and the mock mail failure are skipped, the stage bookkeeping runs as for a normal send, the email is stored with `sentExternally: true`, and an extra history line "Recorded as sent from outside the system (manual send by <name>)" (category `send`) is written. It still needs a valid recipient and an attached email. The page shows a Sending state, and an "Email not sent" banner on a refusal that the same button retries.

### A7 Call confirmation
- Up to 3 attempts, each logged as "No answer" or "Answered - confirmed" (`recordCallAttempt`; the list shows "Answered"). Answered marks the contact number verified. At the cap the UI says "Maximum of 3 call attempts already logged." The cap is **UI only**.
- After 3 unanswered attempts a follow-up text appears in the right rail; "Mark SMS sent" calls `recordSmsFollowUpSent`. Continue (`continueAfterCalls`) keeps the attempts. Logs "Continued without a call confirmation" with an optional ", after the SMS follow-up".

### A8 Reminders
- Midpoint (`reminderCount` 0) then Final (1), each sent (`recordReminderSent`) or skipped (`recordReminderSkipped`); both are independent and each increments the count. Templates t12 and t13, t14 and t15. Sent versus skipped is read back from history text, not the counter. Continue appears once both are decided.

### B11 Confirm In Transit (remote only)
- Tracking number and an optional tracking link; at least one is required, and a link must be on the courier's own site (http or https, host equal to or a subdomain of the provider's `trackingWebsiteUrl`). Action `confirmInTransit` sets `transitConfirmedAt` to today (date only), `transitTrackingRef = link or number`, and advances. This **halts the Overdue Return clock** and starts the 14-day delay clock.
- Tracking details can be edited later from the Courier and Shipping card (`saveShipmentDetails`, no advance). The server does not validate the link (the validator is client-side).
- **Trap:** if only a number was entered, the "Tracking Link" row shows the number and "Open tracking" uses it as an href.

### A9 Overdue and awaiting return
- Three renderings in order: equipment not returned; equipment received (banner and Continue); waiting. While waiting: "Waiting for the equipment to come back", with a note that the ticket becomes Overdue Return automatically at the Target Date.
- When overdue and not yet reminded: "Send Overdue Reminder" (t16 or t17; `recordOverdueReminderSent`; one send in the UI). Sending does not clear the overdue state; it clears when the Target Date is re-baselined forward or the equipment arrives.
- "Mark Equipment Received" (`recordEquipmentReceived`) is a preliminary confirmation and does not advance.
- "Equipment won't be returned?" opens a confirm: "Open charging case" calls `recordEquipmentNotReturned`, which sets `equipmentNotReturned` and `deductionApplicable`, jumps straight to A11 and logs "Equipment not returned, moved to Post-Retrieval Charging".

### A10 Receipt and evidence
- Two uploads: Proof-of-Receipt and Condition Photos (image or PDF, 10 MB, distinct file names; client-side checks only). "Confirm Evidence Complete" needs both. `recordEvidence` stores `{name, url}`, logs "Proof-of-Receipt + condition photos uploaded - receipt record generated, status moves to Hold Off", and advances.
- **Trap:** `url` is a browser blob URL and dies on reload. Production needs an upload endpoint and stored file ids. The server also accepts nulls.

### A11 Post-Retrieval Charging
- First choice: Not Applicable (`recordDeductionNotApplicable`, sets `deductionApplicable` false; "Undo this decision" calls `clearChargingClassification`) or Item Damaged or Not Returned (`updateTicketFields { deductionApplicable: true }`).
- **Case Details**, six steps (the step position is not stored): Team member, Case, Dates, Amount, Equipment, Outcome. Choices save at once through `updateTicketFields`; typed text is applied locally and flushed after 400 ms, and flushed before sending the outcome and when leaving the page (**text typed in the last 400 ms is lost if the tab closes**).
  - Step 1: first name (derived from the full name, overridable per case), employee id, client, leadership coach.
  - Step 2: Asset Team officer (defaults to the assignee, overridable), date the return was requested (derived, overridable), return date that was set.
  - Step 3: dates, narrowed by outcome (see below).
  - Step 4: basis of the amount, supporting doc reference, amount in figures and words, and the quotation block (received date, reference, file name; `saveQuotationDetails`).
  - Step 5: pick the items the case covers (a case need not cover every item) and enter a note per selected item, labeled by outcome: "Condition on receipt", "Condition found", "Finding", "Settlement amount".
  - Step 6: summary and the outcome picker.
- Outcomes (`DEDUCTION_OUTCOME_META`):

| Outcome | Label | Email | Form |
|---|---|---|---|
| `no-charge` | No Charge | t22 | none |
| `quotation-pending` | Quotation Pending | t23 | `notice-assessment-quotation-pending` |
| `charge` | Determination & Charge | t24 | `atd-loss-damage-non-return` |
| `settlement` | Settlement Election | t25 | `atd-settlement-transfer` |

- Amount bases: charge allows quotation, replacement cost, net book value, component cost; settlement allows net book value, replacement cost, program price; no charge and quotation pending carry no amount. Dates per outcome: no charge (received, assessed); quotation pending (received, assessed, quotation expected, hear back by, response due); charge (received, assessed, response due); settlement (buy-out election, response due). "Received" is hidden when the equipment was not returned. These rules are enforced in the UI only; `updateTicketFields` does not validate values.
- Disabled outcomes: settlement after a recorded quotation pending; no charge and quotation pending when the equipment was not returned. Choosing an outcome the saved basis does not allow clears the basis with a toast.
- Send: `recordDeductionOutcome` after placeholder checks; it does not advance. The outcome stays changeable while the ticket is open.
- For charge and settlement a banner asks to record the handoff: "Mark as referred to Payroll" (`confirmReferredToPayroll`, idempotent). AMS does not post deductions. The handoff is not required to continue.
- Continue (`continueAfterCharging`): hidden for quotation pending; skips A12 (logging why, once) when the equipment was not returned or the outcome is settlement.

### A12 Returned Item Check and routing
- Standard ("No issue found - routes to IT for full servicing."), Condition or Completeness Issue, or Suspected Tampering or Loss. `recordInspection` stores the route and advances. The route status drives the ticket status through closure. The closed view's timestamp lookup reads "Inspection routed" but the server writes "Inspection completed, routed to ...", so that timestamp never shows.

### A13 Closure
- "Before you close" checks, all advisory (none blocks closing): equipment returned, receipt evidence, Post-Retrieval Charging, items sent to charging, items left outstanding, returned item check, and "IT told about the access lock" (informational only, never counted as outstanding).
- "Review & Close Ticket" opens the Close Ticket modal (its confirm button reads "Open charging case" when it will open a case, otherwise "Close ticket"). Each asset is Returned, Send to charging or Keep Open. The default is "In charging case" for an item covered by a recorded charging case (an outcome recorded or the equipment not returned), otherwise Returned if ticked, else Keep Open. The charging option reads "Send to charging" until an outcome exists, then "In charging case". "What happens next" describes the effect; a checkbox sends the team member a detailed closure copy (PDF). With that box ticked, "View contents to be sent" offers Copy and Download EML (`downloadEmlFile`, file `Closure-Notice-<ticket number>.eml`); the PDF record stays a separate download.
- `closeTicket`: if any asset is Send to charging and no outcome is recorded, **it does not close**; it opens a charging case (`openChargeCaseForItems`) and jumps to A11. Otherwise it sets `status` closed and logs "Ticket Closed" plus either "Detailed closure copy sent to team member (PDF)" or "Team member copy not sent - documentation unconfirmed".
- No email is sent. The closure PDF is rendered on demand and is not an immutable record (its "Generated" date is the time of rendering).

### Cancel, take over, change reason or mode, reopen (any stage, open tickets)
- **Cancel retrieval:** reason (Resignation retracted, Recall reversed, Another reason) and a required note. Sets status closed with a `cancellation` record and clears asset resolutions. Status label becomes Cancelled. A cancelled ticket does not count as open for the duplicate rule.
- **Take over ticket:** required handover note. Errors: "A closed ticket cannot be taken over.", "You already own this ticket.", "Enter a handover note." The assignee's menu item is dimmed (`aria-disabled`, clickable on purpose) with a tooltip and a toast "Already your ticket". The previous assignee gets a `takeover` notification.
- **Change reason or mode:** allowed until a notice is sent, a call is logged or an acknowledgment is recorded (section 4, path change locks). Requires a note; unexplained absence forces Remote; recalled needs the recall date. Re-resolves the template and Target Date (recorded as a re-baseline), clears the branch fields when switching to onsite, and clamps the stage pointer. **It does not update `gateCount`, does not re-issue the checklist, and does not remap the stage index between the onsite and remote lists** (so switching mode can land on a different stage).
- **Reopen:** shown for any closed ticket, including cancelled ones. Sets status open and clears the cancellation. It does not reset the stage pointer, asset resolutions or the Target Date, and the server has no guard.

### Target Date edit (right rail card)
`rebaselineTargetDate(newDate, reason)`. A reason is required; the same date is ignored. Each change adds a `targetDateHistory` entry and clears `overdueForced`; if the ticket was overdue the log says so ("that lapse remains on record"). There is no minimum or maximum date check.

## 6. Actions (the server contract)

### 6.1 The 52 actions

`ACTIONS` at the bottom of `TA` is the endpoint specification. Grouped by purpose (see the file for exact arguments and strings):

| Area | Actions |
|---|---|
| Checklist (7) | `setChecklistDone`, `addChecklistItem`, `removeChecklistItem`, `toggleChecklistRequired`, `applyChecklistTemplate`, `reorderChecklistItem`, `finalizeChecklist` |
| Stage movement (4) | `advanceStage`, `goBackStage`, `goForwardStage`, `jumpToStage` |
| Assets and date | `confirmAssets`, `rebaselineTargetDate`, `acknowledgeHrisUpdate` |
| Gates and passes | `releaseGate`, `issueGatePass` (the page never calls it; passes are created in Forms) |
| Contact and address | `verifyContact`, `setContactNumber`, `setTeamMemberAddressOverride` |
| Courier and transit | `confirmCourierBranch`, `sendBranchRequest`, `markBranchReplyReceived`, `confirmInTransit`, `saveShipmentDetails` |
| IT access lock | `notifyItLock`, `skipItNotice` |
| Sends and texts | `recordNoticeSent`, `recordSafekeepingSent`, `confirmSmsSentFor`, `recordCallAttempt`, `continueAfterCalls`, `recordSmsFollowUpSent`, `recordReminderSent`, `recordReminderSkipped`, `recordOverdueReminderSent` |
| Receipt and return | `recordEquipmentReceived`, `recordEquipmentNotReturned`, `recordEvidence` |
| Charging | `recordDeductionNotApplicable`, `recordDeductionOutcome`, `continueAfterCharging`, `clearChargingClassification`, `saveQuotationDetails`, `confirmReferredToPayroll`, `openChargeCaseForItems` |
| Routing and close | `recordInspection`, `closeTicket`, `reopenClosedTicket`, `cancelRetrieval` |
| Ownership and path | `takeOverTicket`, `changeReasonAndMode` |
| Field edits | `updateTicketFields` (whitelist: the `deductionCase*` fields, `deductionApplicable`, `checklistNudgeDismissed`; anything else returns `The field "<key>" cannot be edited this way.`) |

Not actions (client or system only, need server equivalents in production): `simulateHrisLwdUpdate`, `simulateBranchReply`, `syncTicketAssetsFromRegister`, `scanTicketAlerts`, `sendMorningDigest`, `raiseNotification`.

### 6.4 Sending an email

`api().emails.send(ticketNumber, request)` (`POST /tickets/{n}/emails`; DATA_CONTRACT 7.4) is how every stage email goes out. Request: `stage`, `kind` (`notice`, `courier-endorsement`, `branch-request`, `reminder`, `overdue`, `charging`), `templateKey`, `formId`, `to`, `cc`, `bcc`, `idempotencyKey` (and `outcome` for charging), `manual` (true when the operator sent the email from outside the system and only confirms it here: the placeholder guard and the mock mail failure are skipped, the stage bookkeeping still runs, the stored `SentEmail` gets `sentExternally: true` and an extra history line is written). The server renders from the ticket (`app/utils/ticketMessage.ts`), refuses with a message when a placeholder cannot be filled, sends, stores a `SentEmail` snapshot, and applies the stage's bookkeeping.

On the page, `sendEmail` in `[id].vue` wraps it: a client check for a valid recipient, a client placeholder check (fast feedback; the server checks again; both are skipped for a manual send), `sending` (the button's loading state, further clicks ignored), `sendError` (the banner), and an idempotency key that stays the same for a retry of an identical request. A refusal changes nothing on the ticket. The recorder actions (`recordNoticeSent`, `recordReminderSent`, `sendBranchRequest`, `recordOverdueReminderSent`, `recordDeductionOutcome`) are now only called by the mock server inside the send; the page no longer calls them. SMS is unchanged. The closure copy is still recorded by `closeTicket` and is not sent by this operation in the prototype.

### 6.2 What the prototype server enforces, and what it does not

**Enforced:** `finalizeChecklist` (already signed; required tasks done), `rebaselineTargetDate` (reason and date), `changeReasonAndMode` (locks, note, path offered, recall date, nothing changed), `takeOverTicket` (closed, same assignee, note), `cancelRetrieval` (closed, note), `updateTicketFields` (field whitelist), create (unknown employee, open duplicate).

**Not enforced (UI-only guards the real backend must add):**
1. Authorization of any kind.
2. Stage order for nearly every action (`closeTicket`, `advanceStage` and `recordNoticeSent` work at any stage).
3. Create rules: unexplained absence must be remote, endorsement required and dated before the separation date (only for paths with gates), recall date, override notes.
4. The 3-call cap and the 2-reminder cap.
5. `confirmAssets` needing at least one ticked asset or an unlocked list.
6. `confirmInTransit` needing a number or a valid link; `recordEvidence` needing both files; `recordInspection` route values.
7. Gate order (`releaseGate` accepts any number, even a lower one) and the gate note.
8. Closed or cancelled checks on most actions; `reopenClosedTicket` does not check the ticket is closed.
9. Placeholder resolution and template status (a draft or retired template still sends).
10. Outcome rules: allowed amount bases, dates per outcome, template and form ids.
11. Per-ticket serialization of actions (see DEV_HANDOFF Known Trap 3).
12. `issueGatePass` input validation (dates, assets, purpose). Re-issuing overwrites.

### 6.3 History strings are part of the contract

The workspace **reads state back by matching history text**. If the backend writes different strings, parts of the UI break. Either keep these formats or expose structured fields (sent flags and timestamps) and change the page.

| Used for | Matched text |
|---|---|
| Notice sent, banner after send | starts with `Retrieval notice sent` |
| Courier endorsement sent | exactly `Courier endorsement sent` |
| Reminder sent or skipped | exactly `Midpoint reminder sent` or `Final reminder sent`; starts with `Midpoint reminder skipped` or `Final reminder skipped` |
| Overdue reminder template | `Overdue reminder sent (T16)` (the key is parsed out and lowercased) |
| Equipment received banner | starts with `Equipment marked received` or `Assets physically received` |
| Branch confirmed or substituted | starts with `Courier branch confirmed` or `Courier branch substituted` |
| Charging outcome sent | starts with `Post-Retrieval Charging resolved` or `Post-Retrieval Charging outcome changed` |
| Closure copy sent | starts with `Detailed closure copy sent to team member` |
| Closure checks | `Proof-of-Receipt + condition photos uploaded`, `Returned item check skipped` |
| Closing | `Ticket Closed` (written by `closeTicket`) |
| IT access lock | `IT notified to lock access at the end of the last shift on <date>`, `Continued without notifying IT. The access lock is IT's responsibility`; the older `IT lock scheduled ...` and `IT lock executed ...` are still recognised for old tickets |
| Contact number | `Contact number corrected for this ticket: <n>`, `Contact number added for this ticket: <n>`, `Contact number cleared for this ticket` (category `contact`) |
| Manual send | `Recorded as sent from outside the system (manual send by <name>)` (category `send`, so it also locks Reason and Mode) |
| Forms column ATD badge | contains `Deduction initiated` (**no action writes this text**, so the ATD badge cannot appear for tickets created in this build) |
| Charging date defaults | earliest `send` entry; earliest `return` entry containing `Proof-of-Receipt` |

The Activity Log renders about 60 regex rules over these strings (`HISTORY_DETAIL_RULES` in `WS`). Display copy replaces `->` with "to", " - " with a comma and " + " with "and" at display time only; the stored text keeps its original form.

History `when` is a UTC ISO instant (older saved entries may still carry a locale string, which the UI tolerates). The UI formats it at display time in the viewer's time zone (`formatDateTime`, `app/utils/dateTime.ts`). History categories (16): entry, asset, checklist, itlock, branch, send, call, transit, return, gate, gatepass, rebaseline, hris, contact, navigation, closure.

## 7. Ticket list, create view and workspace chrome

### 7.1 Ticket list (`IDX`)
- A fixed page header that never scrolls: a status headline ("N tickets need your attention", "You are all caught up" or "No tickets yet"), an ownership subline ("X of Y open tickets are assigned to you"), the Create Ticket menu, and three chips (Open, Due soon, Overdue). Everything below it is one scroll area. An "Assigned to me" toggle in the filter row (assignee equals the current persona) replaces the old All Tickets and My Tickets tabs.
- **The three chips** count open tickets, over the whole list and independent of the table filters: Open, Due soon (Return Deadline within 3 days) and Overdue. A tooltip gives the breakdown by Onsite, Remote and Mine (and the average days late for Overdue). Pressing a chip filters the table; pressing it again clears it. Open sets the status filter; Due soon and Overdue set a deadline filter and reset status to All. Any filter change resets to page 1.
- Columns: select, Ticket # (link; a red dot when an employee record update needs review), Type (always "Retrieval"; Onboarding and Replacement are placeholders that toast "{Type} tickets aren't built yet"), Deployment Type, Team Member, Status, Return Deadline (date plus countdown badge; orange at 3 days or fewer, red when overdue, "Not set"), Assignee, Reason, Client, Assets Affected, Replacement Assets (hard-coded "N/A"), Forms, Created At. Sorted by ticket number, newest first.
- Search matches the employee name or the ticket number (not the reference or email). Status chips All Tickets, Open, Closed (a cancelled ticket counts as closed; the Open chip in the header drives the same filter). Type and Deployment selects. Any filter change resets to page 1.
- Paging: a "tickets per page" select with 10, 15 or 25 (default 10; changing it resets to page 1). There is no Auto and no 50. The table card is as tall as its rows inside the one scroll area; the column header is not pinned and the first five columns stay in place on a sideways scroll. The simulator's High volume scenario shows 35 cloned, unsaved demo tickets (numbers 866 to 900) so paging can be reviewed, and First-timer shows an empty list. Selection persists across pages and filters and is **not** cleared on filter change. The only bulk action is "Export selected" (CSV; columns Ticket #, Reference, Team Member, Mode, Assignee, Reason, Status, Created At; the export includes selected tickets hidden by filters).
- Forms column badges, in order: ERAF (warning once A6 or B9 is reached, `ERAF ✓` once A10 is reached), `CA ✓` (remote, B9 reached), `POR ✓` (A10 reached), `ATD ✓` (see the history string trap). First two inline, the rest in a "+N" popover.

### 7.2 Create view (`CR`)
- Five section cards: Team member, Case details, Dates, Assignment, Summary. The form is inert until a team member is chosen.
- Picking a team member fills reason (the HRIS suggested reason), mode (from the address), LWD and Separation Date. Changing the reason or mode from the suggestion requires an override note, which is sent as `reasonOverrideNote` and `modeOverrideNote` and logged.
- Find Team Member (placeholder "Type a name or employee ID...") shows each person as two lines: the name, then employee number and email. The Assignee select shows the full name, then employee number and email; the value stays the short name and it defaults to the current user.
- Rules (client only): unexplained absence forces Remote; the Recall Effective Date is required for recalled; the authorizing endorsement (text and date) is required only for paths with gates, and the Endorsement Recorded Date has no minimum or maximum (the old rule that it must be before the Separation Date was removed on purpose); a team member with an open ticket blocks the create and shows a link to it.
- Summary card: deadline anchor, computed deadline, who sends the notice, notice email name. Paths with a gate show "P&C Acknowledgement" (Optional).
- Disabled-button explanations are listed in `CR` (`canSubmit`); keep them when porting.

### 7.3 Workspace chrome
- Header: back, ticket number, Open or Closed pill, "Retrieval · {reason} · Onsite or Remote · Assigned to {name}". Actions: Gate Passes popover, Reopen Ticket (closed only), Close Ticket (looks disabled until A13), details panel toggle (shortcut `]`, large screens), overflow menu (Copy Ticket Link, Artifacts Summary, Activity Log, Change reason or mode, Take over ticket, Cancel retrieval).
- Phase stepper (six nodes; segmented bar and popover below 640px). A phase is `blocked` (red) when the ticket is overdue and the phase is Return and Evidence and reached.
- A client plugin (`plugins/closeMenusOnScroll.client.ts`) closes any open dropdown when the page scrolls (not when its own list scrolls), so menus never float over the fixed header.
- **Right rail** (388px on large screens, per-ticket collapsible; open state kept in the browser only): Custodian (with contact verification), Assets Confirmed, Target Date, Communications (SMS), Courier and Shipping (remote), IT Lock.
- Banners above the stage card: HRIS update ("Last Working Day changed", with Acknowledge), cancellation, shipment delayed.
- **Bug (confirmed in the template): the stage card is `v-else-if` of the Shipment delayed banner**, so while a shipment is delayed the whole stage card, including Mark Equipment Received and Back and Forward, is not rendered. Reproduce with a remote ticket in transit more than 14 days. This should be fixed before handoff or flagged to the dev.
- Drawers and modals: Activity Log, Placeholder Check, Artifacts Summary (PDF export), Email Preview, Close Ticket, Gate Pass (view only), Change reason or mode, Take over, Cancel, Save as template, Saved checklists, Equipment not returned, Sent copy.
- Gate pass: the "Create Now" button only toasts "Opens in a new tab" and states that the pass is created in Forms. Numbers are `GP-2026-<n>`, with n from the highest existing ref (minimum 100001), shared by both kinds, year hard-coded; the real server must allocate them atomically.

## 8. Notifications and scheduled jobs

Notifications go only to the ticket assignee, never to the team member. Kinds: overdue, due-soon, branch-overdue, reply, courier-reply, form-signed, acknowledgment, record-update, it-lock, checklist, shipment-delayed, quotation, takeover, assigned. Each has a dedupe `key`; an existing key is not raised again, and a re-baselined date produces a new key. `courier-reply`, `form-signed`, `acknowledgment` and `it-lock` have no producer in the app (demo content only; `it-lock` is also missing from `NOTIFICATION_KINDS`, because the IT lock is now a notice and not a scheduled job).

`scanTicketAlerts` (in the browser every 60 seconds in the prototype; a server job in production) raises, for open tickets:

| Alert | Condition |
|---|---|
| overdue | Target Date set and overdue |
| due-soon | else, Target Date 0 to 3 days away and neither A10 nor B11 reached |
| branch-overdue | branch request sent, no reply received or detected, and more than 1 business day has passed |
| checklist | no final review, A4 not reached, due date today or earlier |
| shipment-delayed | shipment status delayed |
| quotation (hear back) | outcome quotation pending and the hear-back date today or earlier |
| quotation (signed form) | outcome set, not no charge, and the response due date today or earlier |

Morning digest: overdue, due-soon, checklist, shipment-delayed and quotation items wait for a digest email; the bell shows them immediately; every other kind is emailed at once. The digest runs once per member per local day at or after 08:00 and bundles items raised before 08:00 that day (timezone not specified; Manila assumed). In the prototype the "once per day" memory is in browser storage and the digest list is in memory.

## 9. Right-rail Communications: SMS

Twelve copy-and-paste texts (`SMS_TEMPLATES` in `app/data/smsTemplates.ts`; codes SMS-1A to SMS-11): there is no SMS gateway; the operator sends from their own phone and then taps "Mark SMS sent" (`confirmSmsSentFor`, once per code). Tokens: `{NAME}` (first name), `{REF}` (the APR reference), `{DATE}` (target date, today, or none). Codes: 1A resignation, 1B immediate resignation, 2 end of contract, 3 sabbatical (no path uses it), 4 recalled, 5 unexplained absence (remote only), 6 midpoint reminder, 7 final reminder, 8 tracking number received (remote), 9 equipment received, 10 non-compliance notice, 11 courier pickup (unexplained absence).

Stage mapping: A6 by reason, A8 SMS-6 then SMS-7, B9 SMS-11 (unexplained absence), B11 SMS-8, A9 SMS-10 (not unexplained absence), A13 SMS-9. Blocked reasons, in increasing priority: SMS-10 until overdue; SMS-8 until in transit; SMS-11 until the endorsement is sent; no contact number; ticket closed.

## 10. Master Data (ticket-related)

The page is titled "Master Data Configuration" and shows a banner, "Some values are awaiting Asset Team confirmation", with three open values (authoritative phone numbers, the office barangay and the International Asset Movement Policy version). `/master-data` has one live card, Offboarding Checklists; Courier Providers, Policy Library and Asset Team Contact Block are placeholders that toast "{Title} isn't wired up yet". Courier providers, branches, the HRIS directory and Asset Team users have **no edit UI**; they are read-only fixtures. See [TEMPLATES_SPEC.md](./TEMPLATES_SPEC.md) section 8 for the checklist editor.

## 11. Seed data and fixtures (`app/mocks`)

Five seed tickets (422 to 426) cover each reason; 30 HRIS directory people (with shifts and addresses); three Asset Team users (D. Reyes / Dario Reyes EMP-00142, J. Santos / Joy Santos EMP-00151, M. Bautista / Marco Bautista EMP-00167, each with an id, a short name and a full name); two couriers (JRS Express recommended, LBC Express alternate) whose branch lists load from `app/mocks/courier_branches.json` (1,790 branches: 391 JRS and 1,399 LBC); one checklist template; 20 email templates and 5 forms. The branch data (name, address, city, contact person and numbers, latitude and longitude) is a one time snapshot with no verified flag, so confirm it with the Asset Team before go live. The asset catalog (Desktop, Laptop, Monitor and so on) is in `TT`.

## 12. Edge cases, traps and gaps found while documenting

Also in DEV_HANDOFF Known Traps where marked.

1. **Local-only state that must not be stored:** branch selection and capture method until confirm, tracking drafts, evidence and quotation blob URLs, the Case Details step, template and form overrides, closure asset resolutions (sent on confirm), reviewer note drafts, manual email toggles, Activity Log filters, and the rail open state.
2. **Local mutation before the server call:** asset ticks, remarks, the courier select and typed case fields change the local ticket first. If the call fails the page can diverge (no rollback). `patchTicket` overwrites local state with the server copy, so unsent local edits are lost.
3. **Date handling:** `createdAt` is a calendar date string; every instant (`when`, `lastUpdatedAt`, `checklistReview.at`, send times) is a UTC ISO string shown in the viewer's time zone. `transitConfirmedAt` is date-only and is now read with `parseLocalDate` (it was read as UTC before, which could be off by one west of UTC). The closure PDF reference now uses the local date.
4. **Token source of truth** is `ticketRealValues` in `WS`, not the server (see TEMPLATES_SPEC section 6). A server-side renderer must reproduce its rules, including asset expansion.
5. **The `changeReasonAndMode` gaps** (section 5): `gateCount`, checklist and stage index.
6. **`recordEquipmentNotReturned` and `openChargeCaseForItems`** move the stage pointer directly to A11.
7. **Mutation inside a computed:** `currentStageKey` (section 5).
8. **Acknowledgment link** `https://forms.go.team/acknowledgment/<token>` is a placeholder host; the fallback to the internal `id` defeats the "never the guessable id" rule, so always populate `acknowledgmentToken`.
9. **Gate note:** the type comment says "Required" but `releaseGate` does not require it.
10. **`closeTicket` can show "Equipment returned" as ok while an asset is not ticked**, because closing never updates `checked`.
11. **Seed ids differ from created ids** (section 1).
12. **Role and persona:** the only differences by user are Take over (disabled for the assignee), "Signing as", checklist done-by and reviewer, and the Payroll referral actor. The Asset Team officer on a charging case defaults to the assignee, not the viewer.
