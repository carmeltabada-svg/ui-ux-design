# Product Requirements Document: Supplier Return and Client Pull-Out

**Author:** Carmel Tabada
**Status:** Approved on 2026-10-29.
**Last updated:** 2026-10-29
**Reviewer:** Karl Bustillo (prototype signed off)
**Build target:** the Move Asset screen of the live Assets app (`/app/move-asset/[assetTag]/move`) and the places that show the two new statuses (`/app/assets`, `/app/assets/[assetId]`). The layout work on the list and detail views is covered in `DEV_DOC_assets-ux-enhancements.md`.
**Source of the live behaviour:** the R24 Assets tab code, the backend status data in `api/database/data/asset_statuses.php`, and the running app, checked 2026-10-29

---

## Problem Statement

Assets sometimes leave the company for reasons the status list cannot express. A supplier agrees to take a unit back, or a client removes a unit it was using, either to move to a competitor or to hire the team member directly. Today the Asset Team has to force these units into a status that does not fit, such as Decommissioned, or leave them as In Use. The units then stay in the active count, which inflates "active assets" and the "Assets Accounted For" number, and the record holds no proof of why the unit left.

Not solving this means the inventory count is wrong, audits cannot tell a lost unit from a returned one, and there is no document trail for supplier credits or client disputes.

---

## Goals

1. **Correct inventory count.** A unit that was returned to its supplier or pulled out by its client is out of the "active assets" count the moment its status is saved. (The prototype also names an "Assets Accounted For" number. See open question 3.)
2. **Every exit has proof.** No exit status is saved without a date, a person who did it, a reason and a supporting document (supplier return agreement or client instruction).
3. **Right unit, right status.** Client Pull-Out cannot be applied to Monthly Rental units. Only Outright Purchase and BYOD units can be pulled out by a client.
4. **Traceable history.** The asset history shows each exit with date, user, reason and document, and a Supplier Return can be linked to its replacement unit.
5. **Fit the app as it is.** The feature reuses the existing Move Asset flow and status model, and adds no new screen and no ticket flow in this phase.

---

## Non-Goals

1. **A ticket flow with assignees and sign off.** Decided on the 22 Oct call: status only for now. A ticket flow may come later once it is defined.
2. **Bulk exit of many units at once.** Each unit is moved on its own. Bulk handling is a separate request.
3. **Refund, credit or billing handling for supplier returns.** This phase records the fact and the document, not the money.
4. **Reversing an exit status.** Whether and how a wrongly saved exit is undone is an open question, not part of this phase.
5. **Parts 2 and 3 of the Assets work.** The prototype is labelled part 1 of 3. The other parts are specified separately.
6. **Redesigning the Assets list or the asset detail page.** The UI/UX enhancements of those two views are covered in `DESIGN_SPEC_assets-ux-enhancements.md` and `DEV_DOC_assets-ux-enhancements.md`. This task changes only the items listed under Requirements.

---

## Users and Roles

| Role | What they do here |
|---|---|
| Asset Team officer (primary) | Sets Supplier Return or Client Pull-Out on a unit, attaches the document, writes the reason |
| Asset Team manager or approver | Reviews the count, reads the history and documents, exports CSV |
| Asset Specialist, Karl Bustillo | Reviewer of this feature, has signed off the prototype |

---

## User Stories

**Asset Team officer**
- As an officer, I want to set Supplier Return on a unit from any status so that a unit the supplier takes back leaves my active inventory.
- As an officer, I want to attach the supplier return agreement as a PDF or photo so that the exit has proof.
- As an officer, I want to link the replacement unit from the supplier, now or later, so that both units show the connection.
- As an officer, I want to set Client Pull-Out with a sub status of Competitor or Direct Hire so that I record why the client took the unit.
- As an officer, I want the app to tell me plainly when a Monthly Rental unit cannot be pulled out so that I do not waste time on an invalid move.
- As an officer, I want a clear list of what is still missing when I try to save so that I can fix it in one pass.
- As an officer, I want a file that is not a PDF or an image refused with a reason so that I attach the right document.

**Manager or approver**
- As a manager, I want the active asset count to drop when a unit leaves so that the number I report is true.
- As a manager, I want a separate "returned or pulled out" count so that I can see how many units exited.
- As a manager, I want to open a unit's history and see who removed it, when, why, and the document so that I can answer a supplier or client question.
- As a manager, I want to filter the list by the two new statuses so that I can review them.

**Edge cases**
- As an officer on a Monthly Rental unit, I expect Client Pull-Out to be visible but disabled, with the reason, not hidden.
- As an officer who attached the wrong file, I want to replace it before saving.
- As an officer, I expect a saved exit unit to show no Move action, only an "Exited" marker, so that it is not moved again by accident. (Subject to the open question on reversal.)

---

## Requirements

### Must-Have (P0)

**R1. Two new statuses in the existing Terminal lane**
Supplier Return, and Client Pull-Out with sub status Competitor or Direct Hire. Both are new: none of them exists in the backend status list today. They are added as status rows the same way Charged Deduction was (a migration row in `asset_statuses`), in the existing `terminal` lane next to Disposed, Sold, Recovery Deduction, Charged Deduction, Gifted and Missing. Competitor and Direct Hire are stored as `sub_status_options` of Client Pull-Out, the same way Sold stores Buyout, and no new lane is created. The prototype's separate "Left us" group is dropped (see Terminology).
- [ ] Given any unit, when the officer opens New Status, then the Terminal lane lists Supplier Return and Client Pull-Out, and Client Pull-Out asks for its sub status (Competitor or Direct Hire).
- [ ] Supplier Return is selectable from any current status.
- [ ] Sub status is stored with the status and shown in the badge as "Client Pull-Out, Competitor" style text, matching how the live sub status badge renders.

**R2. Client Pull-Out eligibility**
- [ ] Given a Monthly Rental unit, when the officer opens New Status, then both Client Pull-Out options are disabled with the label "not for Monthly Rental".
- [ ] Given a Monthly Rental unit, then the Move Asset page shows: "Client Pull-Out isn't available for Monthly Rental units. Only Outright Purchase and BYOD units can be pulled out by the client."
- [ ] The server rejects Client Pull-Out for a Monthly Rental unit even if the client check is bypassed, with a 422 and the same message.

**R3. Required exit details**
Choosing either status reveals an "Exit details, all required" block with Date, Supporting document and Reason. Done by is the signed in user. Note stays optional.
- [ ] Save is blocked until date, done by, reason and the supporting document are all present.
- [ ] The error reads: "Can't move the asset yet. Still needed: [list]." The list names exactly what is missing, and the document is named by status (supplier return agreement, or client instruction).
- [ ] Date defaults to today and cannot be empty.
- [ ] The same four fields are validated on the server, not only in the form.

**R4. Supporting document rules**
- [ ] Accepts a PDF or an image (JPG, PNG). Anything else is refused with: "[file name] can't be attached. Use a PDF or an image (JPG or PNG), for example a printed email or a photo of it."
- [ ] The label reads "Supplier return agreement" for Supplier Return and "Client instruction" for Client Pull-Out.
- [ ] Validation runs on the file type and not only the extension.
- [ ] The file is stored with the movement and is openable from the asset history.

**R5. Movement and location follow the status**
- [ ] Supplier Return sets the movement to Check In and the location to the supplier.
- [ ] Client Pull-Out sets the movement to Check Out and the location to the client the unit was checked out to.
- [ ] The Location field shows the derived value read only, instead of "Set when you pick the status".

**R6. Out of the active count**
- [ ] Saving either status lowers the "active assets" count by one and raises the "returned or pulled out" count by one.
- [ ] No "Assets Accounted For" number is built. It was named in the prototype but does not exist in the system.
- [ ] The two counts are visible at the top of the Assets list (see R7).

**R7. What the Assets list shows for an exit**
- [ ] The two counts from R6 ("Active assets" and "Returned or pulled out", helper text: "Supplier Return and Client Pull-Out") are visible at the top of the list. How the list header, metric cards and filters are laid out is the separate UI/UX enhancements task (``), not this one.
- [ ] The Asset Status filter includes the two new statuses under the Terminal lane.
- [ ] A unit in an exit status shows its status badge and an "Exited" marker in the Actions column in place of Add Movement.
- [ ] Nothing else in the table is changed by this task.

**R8. History**
- [ ] The asset Activity Feed and Movements record the change with date, user, reason and document link.
- [ ] The status history panel on Move Asset shows the same entry.

### Nice-to-Have (P1)

**R9. Replacement unit link for Supplier Return.** An optional field "Replacement unit from the supplier (optional, can be linked later)", default "Not linked yet", listing eligible units. Both units show the link in their history. Linking later from the asset detail page is also supported.
**R10. Export.** The CSV export includes the exit date, reason and document name for exit units.
**R11. Document preview.** Open the PDF or image in place from the history entry.

### Future Considerations (P2)

- Ticket flow with assignees and sign off. Keep the status change as a single service call so a ticket can wrap it later.
- Supplier credit tracking.
- Reversal of an exit status with its own audit entry.
- Dashboard widgets for exits by reason and by client.

---

## UX Notes (from the prototype, to be rebuilt in the live app)

- The prototype is a mock with a light theme and an 8 column table. The live app has 16 columns and a dark mode. The feature is inserted into the live screens, so the live layout wins.
- New items carry no "new" outline in the build. That outline is prototype chrome.
- The prototype's purple Demo guide, circle cursor and sign off section are review tools, not product features.
- Reuse the Charged Deduction pattern on Move Asset (a status that reveals document fields). The difference is that these fields are required, not optional.
- Status badge colours: the prototype uses purple for Supplier Return and grey for Client Pull-Out. Confirm both against the live status palette and the 600 shade rule in `AMS_DESIGN_SYSTEM.md` and the Dev Doc.
- Copy uses no dashes. The status name "Client Pull-Out" is a proper noun and keeps its hyphen.

---

## Terminology: replacing "Left us"

"Left us" in the prototype is informal and does not match how the app names things. In the live app a status group is a lane, and lane names describe a stage of the asset lifecycle (Intake and Ready Pool, Active Use, Return and Triage, Review and Investigation, Decommissioning, Terminal).

| Where | Prototype wording | Recommended wording | Why |
|---|---|---|---|
| Lane for the two statuses | "Left us (new)" group | **Terminal** (existing lane, no new lane) | Both statuses end the asset's life with GoTeam, exactly like Disposed, Sold, Gifted and Charged Deduction. A new lane would split one idea in two and need a lane migration. |
| Alternative, not chosen (Terminal was decided) | | **Out of Custody** | Matches the lifecycle style, says the unit is no longer in GoTeam's hands, and does not repeat "Terminal". |
| Header count card | "Left us" | **Returned or pulled out** (helper: "Supplier Return and Client Pull-Out") | Names what is counted, in plain words. |
| Actions column marker | "Left us" | **Exited** | Short, fits the cell, and is not a lane name. |

## Success Metrics

No baseline exists for how often exits happen, so targets are proposals for the owner to confirm.

### Leading indicators (first 2 to 4 weeks)
| Metric | Target (proposed) | How measured |
|---|---|---|
| Exit units recorded with all four required fields | 100 percent | Database check, should be enforced by validation |
| Exit moves saved on the first attempt | 80 percent or more | Count of "Still needed" errors against saved moves |
| Exits recorded in a status that does not fit (Decommissioned used instead) | Trend to zero | Audit of Decommissioned reasons |

### Lagging indicators (1 to 3 months)
| Metric | Target (proposed) | How measured |
|---|---|---|
| Difference between active asset count and the physical audit count | Smaller than the last audit | Audit session results |
| Supplier or client questions about an exit answered from the record | All of them | Asset Team feedback |

---

## Open Questions

| # | Question | Owner | Blocking? |
|---|---|---|---|
| 1 | RESOLVED. BYOD is an existing Tech Pack type (confirmed by the user, and in the backend Tech Packs controller and seeder as "Bring Your Own Device (BYOD) / Client Owned"). Still to check in the build: the Assets list Tech Pack Type filter shows all three types, and how the unit's tech pack type is read for the Client Pull-Out rule. | Asset Team | No |
| 2 | RESOLVED. Supplier Return, Client Pull-Out and its two sub statuses are new and must be added in the backend. DECIDED 2026-10-29: they go in the existing Terminal lane, no new lane. | Carmel Tabada | No |
| 3 | RESOLVED 2026-10-29. The "Assets Accounted For" number does not exist anywhere in the system, so it is dropped from the requirements. Only "active assets" and "returned or pulled out" are counted. | Carmel Tabada | No |
| 4 | Can an exit be reversed if saved by mistake, and by whom? The prototype shows no Move action after saving. Terminal statuses elsewhere in the app may already answer this. | Karl Bustillo, Product | No, but it decides the Exited marker design |
| 5 | Which statuses may Client Pull-Out start from? The prototype shows only In Use examples. | Karl Bustillo | No |
| 6 | Supplier Return location: derive the supplier from the unit's purchase order, or let the officer choose it? The prototype hard codes one supplier name. | Karl Bustillo, backend dev | No |
| 7 | Maximum document size. Charged Deduction allows 10MB each. Keep that? | Backend dev | No |
| 8 | Who may set these statuses (permission)? Existing roles in the RBAC module need checking. | Product, backend dev | No |
| 9 | Is the replacement unit limited to units already in the system, and does it need to be the same model? | Karl Bustillo | No |
| 10 | The prototype is signed off. What is the IAM ticket key and sprint for the build? | Gilbert, Product | No |

---

## Timeline Considerations

- **No hard deadline identified.** The prototype is already signed off. The build can start.
- **Backend work is part of the build.** The two statuses and sub statuses are new rows, plus validation of the required fields and of the Monthly Rental rule. Question 3 only affects R6.
- **Suggested phasing.** Phase A: R1 to R6 and R8 (statuses, rules, documents, count, history). Phase B: R7 list changes and R9 replacement link. Phase C: P1 items. Phase A and B can ship together if the backend work is small.
- **Dependency.** The feature changes shared status data, so the Asset Models, Tech Packs and Audit screens that read status should be regression tested.
- **Scope of this build.** Front end only, built by the designer with mock data. The developer fetches it from the designer's GitHub, builds it into the R24 code base and adds the backend. The designer has no push access to R24, so the build lives on its own local branch and is pushed only to the designer's GitHub.
- **Reference code.** The Assets tab code I copied came from `feature/IAM-188-retrieval-ticket`. The R24 repo is now on `feature/IAM-165-charged-deduction-terminal-status`, whose recent commits changed how Charged Deduction handles notes and documents, so the Move Asset precedent may be out of date. The Dev Doc tells the developer to re-check it on their branch.

---

## References

- Live app routes: `/app/assets` (list), `/app/assets/[assetId]` (detail), `/app/move-asset/[assetTag]/move`
- [AMS_DESIGN_SYSTEM.md](AMS_DESIGN_SYSTEM.md)
