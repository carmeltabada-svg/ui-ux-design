# QA Documentation — GoTeam AMS Retrieval Module

**Prototype:** Nuxt 4 + Nuxt UI v4: the email-template and retrieval-forms builders, the ticket tracker, and the master data checklists.
**How to test:** run `pnpm install && pnpm dev`, open `http://localhost:3000`. No login is required (no auth exists). For a build without the dev server, use `npx nuxt build` then `node .output/server/index.mjs`.
**Build for QA and PM (no setup):** the live demo at https://ams-retrieval-demo.netlify.app (a static build of `main`), or the HTML export in the handoff package. It has the same states and flows as the code. Changes stay in your own browser.
**User guide:** `AMS Retrieval User Guide.html` explains every control and has eleven guided missions. Hand it to anyone testing.

**The simulator strip is the fast way to reach each state.** The bar at the top (State, Viewing as, Scenario, Situation) and the flask popover in the navbar ("Simulate an employee record update") jump a ticket to a condition. It is **verification scaffolding, not a shipped feature**: confirm it is absent from the production build.

**Reference:** [Dev Documentation](./DEV_HANDOFF.md). Every test case is tagged with the Dev Doc section it verifies, and with its module: **Templates**, **Ticket Tracker**, **Master Data**, **Data layer**, or **All**.

## Table of contents
1. Known Traps (test priority)
2. Out of Scope
3. Numbered test cases (3.1 Email Templates, 3.2 Retrieval Forms, 3.3 Ticket Tracker, 3.4 Master Data, 3.5 Data layer, 3.6 Text and spacing standard, 3.7 Accessibility: keyboard and focus, 3.8 Ticket Tracker final pass)
4. Responsive & Touch
5. Sign-off checklist
6. Full regression pass

---

## 1. Known Traps (test priority)

Verify these **first**. They are behavior that has broken before. Same substance as the Dev Doc's Known Traps.

### 1.1 Priority traps

1. **[All]** Run the type check as `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json`. The old `-p .` command reports nothing even when there are errors. Plant a deliberate type error once and confirm it is reported.
2. **[Data layer]** Create or edit data, reload: it must still be there. No page should write ticket history or notifications itself; every history line in the Activity Log is attributed to the signed-in persona.
3. **[Data layer]** Perform two quick actions on one ticket (tick two checklist items fast): both must stick. (In http mode an unserialized second action can overwrite the first.)
4. **[Ticket Tracker]** After creating a ticket and reloading, the ticket and the seed tickets must all be there. A stale saved snapshot must never replace newer data.
5. **[Ticket Tracker]** Dates must not shift by a day. Check Created, Notice date, the Audit Trail ID year and the `ATD-` reference near 1 January and in a western time zone.
6. **[Ticket Tracker]** For the assignee, the menu item "Take over ticket" is dimmed, shows a tooltip on hover, and a click shows a toast and opens nothing. For anyone else it opens the form.
7. **[All]** Helper text is the lightest passing gray (`#67778f`), placeholders and empty values are lighter (`#7b8aa0`); labels are darker than helper text so the two are clearly different.
8. **[Templates]** The email Subject is 16px (matches Outlook) and form editor field labels are bold highlighted: these are intentional, not bugs.

### 1.2 Templates builder traps

1. Click an image inside the email/form editor → it must select
   (highlight), never navigate away or open a file dialog.
2. Click a button-link inside the email editor → it must select, and must
   **never** open a new tab / navigate to its target URL while editing.
3. Insert an image or button-link, then delete surrounding content until
   it's the only content on the page → the tab must **not** hang or freeze.
4. Insert a footer-role image at the end of a document → no extra blank
   paragraph should appear below it. Insert a non-image block at the end →
   a trailing blank paragraph **should** appear (this is intentional,
   opposite of the footer case).
5. Set a button-link's alignment (left/center/right) → export/copy the email
   → the alignment must survive into the exported HTML, not just the live
   editor view.
6. Upload a file into a form's file-upload field → confirm no native
   "no file chosen" / duplicate filename text appears alongside the custom
   upload UI.
7. Re-open a form that was already submitted → it must render **read-only**
   with a submitted/already-emailed indicator, and must not allow editing.

## 2. Out of Scope

Do not file bugs for the following. They are deliberate boundaries, identical to the Dev Doc's Out of Scope.

**Deferred / boundary**
- **[All]** No real email, SMS or notification is ever sent. "Send" only records a state to show the UX.
- **[All]** No real backend: data resets if `localStorage` is cleared or a different port or domain is used.
- **[All]** No login, roles or real recipient directory; no FormKit Pro inputs.
- **[Ticket Tracker, Data layer]** No live employee-record (HRIS) connection: the directory is a fixture, and the simulator shows the update flow.
- **[Ticket Tracker, Data layer]** Timed jobs (alerts every 60 seconds, the morning digest) run in the browser because there is no server.
- **[Ticket Tracker]** Evidence and quotation files are browser files, not uploaded.
- **[Master Data]** No permissions on who may edit checklists.
- **[Templates]** Real OS print-to-PDF fidelity beyond the in-browser preview is not claimed as verified.
- **[Templates]** E-signature legal certification: a signature box captures a drawn image only. A phone-ready editor layout is not built (see section 4 for the measured gaps).

**Anticipated, not wanted** (do not report these as missing)
- **[Templates]** Merging the email editor and the forms editor; `object-fit` image scaling; a live `href` on the in-editor button.
- **[Data layer]** Page-side computation of stage rules, ticket numbers or references.
- **[All]** The text "(optional)" or uppercase field labels: Optional is a badge and only section labels are uppercase.
- **[Ticket Tracker]** Don't make the IT access lock (stage A4) a gate, and don't add a scheduling or execution confirmation. Locking access is IT's job. The stage is a notice to IT, with "Continue without notifying IT" as an equal way on.
- **[Master Data, Ticket Tracker]** Don't bring back a reviewer step, a reviewer note or the word "review" on the offboarding checklist. The button is "Complete checklist". The `noteText` argument on `finalizeChecklist` is an unused leftover; the real server should not accept or store a reviewer note.
- **[Ticket Tracker]** Don't restore a date limit on the Endorsement Recorded Date. It was removed on purpose.
- **[Ticket Tracker]** Don't add J&T Express. JRS and LBC are the couriers.
- **[All]** Don't add the dashboard to the retrieval module's branches. It lives on its own branch and is not part of this handoff.

## 3. Numbered test cases

### 3.1 Email Templates

| # | Steps | Expected | Bug if |
|---|---|---|---|
| 1 | Open Templates → create/open an email template → press Edit, type body text, select it, click Align Center | Text visually centers, toolbar's center button shows active state | Text doesn't move, or wrong button highlights → Dev Doc §6.1 |
| 2 | Insert an image (Insert Image popover: alt text, URL or upload), then hover it, press the gear "Image options" and choose "Use this image as" Header | Image crops to 640×140 and snaps to the very top of the document, no gap left behind | Image distorted/stretched, or a blank paragraph remains above/below it → Dev Doc §3.2 items 4 and 7 |
| 3 | Insert an image, then hover it, press "Image options" and choose "Use this image as" Footer | Image crops to 640×100 and snaps to the very bottom, no trailing blank paragraph | Trailing gap appears, or image doesn't move → Dev Doc §3.2 items 4 and 5 |
| 4 | Click directly on an inserted image | Image shows a selection outline; toolbar align buttons reflect the image's current alignment | Image not selectable, or click does nothing → Dev Doc §3.2 |
| 5 | With an image selected, click Align Right | Image moves right, toolbar shows Align Right active | Image doesn't move, or text alignment changes instead → Dev Doc §6.1 |
| 6 | Insert a button-link, set a target URL, click directly on the rendered button in the editor | Button gets selected (highlighted), **no new tab opens, no navigation occurs** | Any navigation/new tab happens → **Known Trap #2, highest priority** |
| 7 | With the button-link selected, click Align Center, then More actions, Copy to clipboard (or Download EML) | Exported HTML's button is centered and contains a real, working `href` to the target URL | Alignment lost in export, or exported link is missing/broken → **Known Trap #5** |
| 8 | Drag an inserted image to a different position in the document | Image moves to the new position via drag-and-drop | Image drag does nothing, or triggers a generic browser image-drag instead | 
| 9 | Press Edit, set a background color and a footer note, press Save, reload | Background color and footer note persist after reload | Values reset or don't apply |
| 10 | Use More actions, Copy to clipboard (or Download EML) on a template with a table, colored callout, and highlighted text, and open it in Outlook (paste into a real Outlook client if available) | Table fill, callout background, and highlight color all render correctly in Outlook | Any fill/color is lost specifically in Outlook (not just the in-app preview) |

### 3.2 Retrieval Forms

| # | Steps | Expected | Bug if |
|---|---|---|---|
| 11 | Open/create a retrieval form → insert a text field, a checkbox field, and a file-upload field | Each renders as a real interactive FormKit input inline in the document | Field doesn't render, or renders as a plain HTML input with no validation | 
| 12 | Leave a required text field empty and attempt to submit | Validation error shows on that field, submission is blocked | Submission succeeds anyway, or no error shown → Dev Doc §5 |
| 13 | Upload a file into the file-upload field | Custom upload UI (outline button + preview) shows the file; no native "no file chosen" text appears | Native file input text overlaps/duplicates the custom UI → **Known Trap #6** |
| 14 | Draw a signature in the signature field, save | Signature image is captured and persists on reload | Signature lost, or pad doesn't respond to drawing |
| 15 | Fill and submit a form as a "recipient" (via `/form-preview`) | Form locks to read-only, shows a submitted/"emailed copy" confirmation | Form remains editable after submission, or no confirmation shown → **Known Trap #7** |
| 16 | Re-open the same already-submitted form | Renders read-only immediately, does not allow re-editing or re-submitting | Form is editable again |
| 17 | Add several fields, scroll/type until content spans multiple pages | On-screen page breaks appear at reasonable points as you type | Page count doesn't update, or content visibly overlaps a page break |
| 18 | Open `/form-preview` and trigger the print/PDF view | pagedjs renders the document paginated with real page breaks matching print margins | Content is cut off mid-field, or a field/row is split awkwardly across a page break |
| 19 | Duplicate an existing form template | The duplicate carries over its real content (not blank/placeholder content) | Duplicate is empty or missing fields — the existing Playwright test for this case is stale (it opens the missing form `aof-commitment`), so test it by hand |
| 20 | Make an edit, save a new version, open Version History | Diff view shows what changed between the two versions | Diff shows nothing, or shows unrelated/incorrect changes |

### 3.3 Ticket Tracker

| # | Steps | Expected | Bug if |
|---|---|---|---|
| 21 | Ticket Tracker, then Create Ticket and choose Retrieval (Onboarding and Replacement only show a toast) | Cards with headings: Team member, Case details, Dates, Assignment, 24px apart; Summary appears after a team member is picked | One big card, missing headings, or cards touching → Dev Doc §6.3 |
| 22 | Before picking anyone, try to type in Reason, Mode or the date fields | The three lower cards are faded and nothing can be edited | A field is editable before a team member is chosen |
| 23 | Pick "Kevin Ong" | Reason ("End of Contract") and Mode are pre-filled with the notes "Pre-filled from the offboarding case. Confirm or change." and "Set from the address on file."; Last Working Day and Separation Date fill in; the Summary card shows Deadline counted from, Deadline, Notice sent by, Notice email | Anything stays blank, or the notes are missing |
| 24 | Change the Reason | A "Why are you changing the reason?" note appears; until it is filled Create looks dimmed and clicking it shows the toast "Not ready yet" | A ticket is created with an unexplained override → Dev Doc §5 |
| 25 | Enter an Endorsement Recorded Date on or after the Separation Date | It is accepted: the date has no limit (removed on purpose) and the ticket can be created | A date error, or Create refused for this reason |
| 26 | Choose a team member who already has an open ticket (for example Josef Cruz) | A red banner names the open ticket, links to it, and Create is blocked | A second open ticket is created |
| 27 | Create a ticket, then reload the page, then open the Ticket Tracker list | The ticket is still on its workspace page and in the list; the seed tickets are all present | The ticket disappears or a seed ticket changes → **Known Trap #4** |
| 28 | As the creator (the assignee), open More options | "Take over ticket" is dimmed; hovering shows "You are already the assignee of this ticket."; clicking shows the toast "Already your ticket" and opens nothing | Handover form opens, or no tooltip or toast → **Known Trap #6** |
| 29 | Switch "Viewing as" to another team member, open the same menu, choose Take over ticket, enter a note, submit | Item is normal; the ticket is taken over and the Activity Log records the handover | Item is dimmed for someone who is not the assignee |
| 30 | More options, Cancel retrieval, choose "Keep ticket" | Modal closes, the ticket is unchanged | The ticket is cancelled by dismissing |
| 31 | Cancel retrieval again, confirm with the note empty, then with a note | Empty note shows a note error; with a note the toast "Retrieval cancelled" shows and the ticket is cancelled | Cancels without a note, or no confirmation |
| 32 | On a ticket at the checklist step, tick every required task | "Complete checklist" enables and pulses for about 3 seconds, once. Untick and tick again: no second pulse | Pulse at page load, while the button is disabled, or on a step that only asks to continue (came back or charge, continue to the next step) |
| 33 | On the same step, read below the checklist | The helper line ("Required tasks must be done before the checklist can be completed. Optional tasks never block it."), then the Complete checklist button. No reviewer note and no divider | A reviewer note box, the word "review", or the text "(optional)" |
| 34 | Open a charging case, go to the Dates step before and after choosing an outcome | An info banner ("Dates narrow to the outcome", then "Dates for this outcome") | Plain gray text instead of a banner |
| 35 | On that Dates step, look at the Quotation card | Its description sits under the title, not beside it | Description beside the title |
| 36 | Look for optional fields: Tracking Link (shipment), P&C Acknowledgement, email Footer note, form Hint, the simulator popover | Each shows the outlined neutral "Optional" badge | The text "(optional)" anywhere |
| 37 | Open Reason, Courier Provider, the list filters, rows per page, and the Templates list filters | The selected option is blue and medium weight, with a blue check | A selected option is not blue, or the check is gray |
| 38 | Courier & Shipping card on a remote ticket | Courier name and branch are values; the branch address is a darker supporting line 4px below; "Account manager" is a lighter label with the name beside it | Address in the same pale gray as helper text, or no gap between name and address |
| 39 | Press the bell (mouse and keyboard) | Notifications open; the unread badge shows and updates | The bell cannot be opened from the keyboard |

### 3.4 Master Data

| # | Steps | Expected | Bug if |
|---|---|---|---|
| 40 | Open Master Data, then Offboarding Checklists | Title with only the back arrow beside it (no icon) | An icon beside the title |
| 41 | New template, name it, add tasks, tap a task's badge | The badge switches Required and Optional; Save stores it | The badge does nothing, or Save loses a task |
| 42 | Rename a template to an existing name | "A template with this name already exists. Choose a different name." | Two templates share a name → Dev Doc §5 |
| 43 | In the checklist editor add a second template (New), then in "Starts every ticket for" tick a reason and mode another template already uses (a "(from <other template>)" hint shows) | The path moves to this template (one template per path) | A path belongs to two templates |
| 44 | Delete templates until one is left, then try to delete it | Refused: "Keep at least one template. New tickets are issued from it." | The last template is deleted |
| 45 | Delete a template that covers paths | Its paths move to the first remaining template | A path is left without a template |

### 3.5 Data layer

| # | Steps | Expected | Bug if |
|---|---|---|---|
| 46 | Create an email template and a form, edit each, reload | Both are listed and open with the edits | Anything resets |
| 47 | Delete a shipped (seed) form or template, reload | It stays deleted | It comes back |
| 48 | Switch "Viewing as" to another persona, reload | The persona is kept | It resets |
| 49 | Run `npx playwright test tests/e2e/ticket-smoke.spec.ts` against the running server (`PLAYWRIGHT_BASE_URL`) | Passes | Fails (create, reload, Take over disabled, Cancel retrieval dismissed and confirmed) |

### 3.6 Text and spacing standard

Use the browser's DevTools (computed styles) on the create view and a ticket workspace.

| # | Steps | Expected | Bug if |
|---|---|---|---|
| 50 | Inspect a field label | 12px, weight 400, `#334155`, 8px above its control (4px above plain text) | Uppercase, bold, or another gap |
| 51 | Inspect a typed value and a displayed value (for example Last Working Day) | 14px, weight 400, `#0f172a` | A displayed value is medium or `#334155` |
| 52 | Inspect helper text | 12px, `#67778f`, 4px below its control | `#64748b` or `#94a3b8` |
| 53 | Inspect a placeholder and an empty value ("Not yet", "Not added yet") | `#7b8aa0`, regular | Same color as helper text |
| 54 | Open the email template editor | Labels `#334155`; Subject 16px semibold; body text `#0f172a` | Subject at 14px, or body in a lighter gray |
| 55 | Open a form editor field | Document labels stay bold highlighted (intentional) | Normalized to the app label style |

### 3.7 Accessibility: keyboard and focus

| # | Steps | Expected | Bug if |
|---|---|---|---|
| 56 | Tab through the create view with only the keyboard | Logical order; every control shows a visible focus ring; no keyboard trap | A control cannot be reached, or focus disappears |
| 57 | Open any modal, press Tab, then Escape | Focus moves into the modal and stays there; Escape closes it and returns focus to the trigger | Focus escapes behind the modal, or Escape does nothing |
| 58 | Open More options with Enter, move with the arrow keys | The menu opens and moves; the disabled Take over item is announced as disabled | The menu cannot be operated from the keyboard |
| 59 | With a screen reader or the accessibility tree, find the three list filters and the bell | Named "Filter by type", "Filter by deployment type", "Rows per page", and "Notifications, N unread" | A control is announced as just "button" or "combobox" |
| 60 | Zoom the create view to 200% | Cards reflow, nothing is cut off, no horizontal scroll | Text or fields are clipped |

### 3.8 Ticket Tracker, final pass (27 October 2026)

| # | Steps | Expected | Bug if |
|---|---|---|---|
| 61 | Open the Ticket Tracker | A headline ("N tickets need your attention") and three chips: Open, Due soon, Overdue, each with a count. Hover a chip: a tooltip with a detail and a breakdown (Open: Onsite, Remote, Mine; Due soon: Remote, Onsite, Mine; Overdue: Avg late, Remote, Mine) | Tall metric cards, or counts that do not match the list → Dev Doc §6.3 |
| 62 | Press the Overdue chip, then press it again | The table shows only open overdue tickets and the chip is pressed; the second press clears it | The filter stays, or closed tickets are included |
| 63 | Press "Assigned to me" | Only tickets assigned to the person in Viewing as; the pressed state shows | A separate tabs row, or other people's tickets listed |
| 64 | Scroll the list page down | The page header and chips stay put; the search row, table and paging footer scroll together; the column header is not pinned | The header scrolls away, or the table scrolls inside itself |
| 65 | Scroll the table sideways | Ticket #, Type, Deployment Type and Team Member stay in place, the rest scrolls | Left columns slide away |
| 66 | Set Scenario to High volume, then set Show to 10, 15 and 25 | Default is 10; each shows that many rows in full; there is no Auto and no 50 | A missing option, or a clipped row |
| 67 | Set Scenario to High volume, go to page 3, then set Scenario back to Standard data | About 35 rows at first; after switching you are on the last page that exists, not an empty page | An empty table showing "21-5 of 5" |
| 68 | Open a ticket at the IT access lock stage | A banner says IT handles the lock. Two ways on: Notify IT and continue, and Continue without notifying IT. Either moves the ticket on | A scheduling or execution confirmation, or a stage that waits for IT |
| 69 | Close a ticket after choosing Continue without notifying IT | The closure check "IT told about the access lock" reads as information and the closed banner does not count it as outstanding | "1 item was still outstanding" because IT was not told |
| 70 | On asset confirmation, press Show Custodian card | The rail opens if hidden, the card expands, scrolls into view and pulses, and the pulse is not clipped | Nothing happens, or the ring is cut off |
| 71 | In the Custodian card, edit the contact number: type letters, then digits | Letters are removed; only digits and + ( ) - and spaces stay; after saving, the number reads "Not yet confirmed" until verified | Letters accepted, or a corrected number still shows as confirmed |
| 72 | On the notice, overdue and charging steps, press "Mark as sent outside the system" | The send is recorded with a history line saying it was sent outside the system, the stage banner shows, and no placeholder guard blocks it. It is hidden for Quotation Pending, and on the notice step with the manual email address switch on and empty it says "Enter the manual email address first" | The system tries to send, or the guard refuses a manual send |
| 73 | On the reminder step | "Mark as sent outside the system" is a quiet link below a divider, under the Send and Skip buttons | It is a third solid button |
| 74 | Open an email preview, press Copy and Download EML | Copy flashes "Copied"; the downloaded .eml opens in a mail client with the subject on one line and a styled body | A download with a broken subject, or no styling |
| 75 | Turn on Fail the next email send, press Send, read the banner, press the same Send again | "Email not sent" with nothing recorded, then the retry works | A history line from the failed attempt |
| 76 | On a ticket that reached closure, press Review & Close Ticket | An item that is in a recorded charging case defaults to "In charging case", others to Returned or Keep Open. Copy and Download EML work on the closure message. After closing, Reopen Ticket works | An item in a charging case reads "Returned" |
| 77 | Open the offboarding checklist and finish the required tasks | The button reads "Complete checklist", the banner "Checklist completed", and there is no reviewer note | The word "review" or a note box |
| 78 | Create a ticket: pick a team member; read the options; set the Endorsement Recorded Date after the Separation Date | Options show employee number and email; the assignee list shows full name with number and email; the date has no restriction | A date error on the endorsement |
| 79 | Remote ticket, branch confirmation | Only JRS and LBC; each has a branch list; a branch near the address is suggested | J&T Express, or an empty branch list |
| 80 | Open any select, then scroll the page; then scroll inside a long list | The menu closes on the page scroll; scrolling inside the list does not close it | The menu floats over the header, or closes while scrolling its own list |
| 81 | Open a saved shipped email template | The subject carries the employee id, for example "(GT-00482)" in the template editor preview and "(04821)" in a ticket's email | The id is missing after a reload |
| 82 | Use the theme toggle: Light, Dark, System | Every screen above works in both themes | Unreadable text in dark |
| 83 | Open an email template, press Edit, press the braces button at the right of the Subject line label | The Placeholder Library opens on the right and says "Inserting into Subject line at your cursor" | No button, or the drawer says Body |
| 84 | Click inside the subject text where you want a placeholder, press the subject braces button, pick two placeholders in a row | Both are inserted at the cursor, in order, and the drawer stays open; each shows "Added" | The drawer closes after one, or a placeholder lands at the end of the subject |
| 85 | Edit a template and, without clicking into the body, press the body toolbar braces button and pick a placeholder. Repeat for the subject | Nothing is inserted and a toast "No active cursor" says to click where you want it | A placeholder appears at the top, the end or anywhere unasked |
| 86 | Click in the middle of a body paragraph, press the toolbar braces button and pick three placeholders in a row | All three go at the cursor, one after the other, and the drawer stays open. Select an image or button first and the toast says to click inside a line of text | A placeholder is appended to the bottom of the body, or an image or button is replaced |
| 87 | With no cursor placed, pick a placeholder in the drawer | No row shows "Added" and the header shows no "N added" count; only the toast appears | A refused pick is marked Added |
| 88 | In the subject, press Shift+Tab to the braces button, Enter, Tab to a placeholder row, press Enter twice | Two copies are inserted and focus stays on the row; Escape closes the drawer and focus returns to the braces button | Focus jumps to the subject, or Escape does nothing |
| 89 | At 375px open the drawer from the subject | It is a bottom sheet (about 45% of the screen). Scroll the subject above it, click in it and pick a placeholder: it inserts at the cursor | The drawer covers the whole screen or the subject cannot be reached |
| 90 | Pick a placeholder not used before, then compare the "Used in template" chip with the section header count | Both show the same number; the "N added" text is dark green and readable in light and dark | The two counts differ, or the added text is pale green |

## 4. Responsive & Touch

The module is desktop-first; these checks confirm the measured behavior and tag back to the Dev Doc's Responsive Spec (§9). Run them against the running build.

- **Breakpoints to check** (priority order): 390px, 360px, 768px, 1920px, 320px. Drag-resize continuously 320 to 1920.
- **No horizontal scroll** at any width: the ticket list, create view, ticket workspace, templates list and offboarding checklists were measured clean at 375, 768 and 1302. **Known gap:** the email template editor header overflows by about 166px at 375px.
- **Create view date rows** (endorsement pair, Last Working Day and Separation Date) are one column below 640px and two columns above it. → Dev Doc §9.
- **Touch targets** on phones should be at least 44 by 44px with 8px between them. **Known gap:** Nuxt UI `sm` and `md` buttons are about 32 to 36px high; log these as a feature request, not a regression.
- **Forms** are single column on phones. **Text** stays at least 14px for body (12px labels and helper text are by design). **Long strings** (emails, tracking links) wrap or truncate and never push the page wider.
- **Sticky elements** (page header, side panel) stick and do not overlap or take an unreasonable share of a small screen.
- **Edge cases**: 200% zoom, landscape phone, on-screen keyboard open on the create view.

## 5. Sign-off checklist

- [ ] All Known Traps (§1.1, 8 items; §1.2, 7 items) verified
- [ ] Email Templates cases 1 to 10 pass
- [ ] Retrieval Forms cases 11 to 20 pass
- [ ] Ticket Tracker cases 21 to 39 pass
- [ ] Master Data cases 40 to 45 pass
- [ ] Data layer cases 46 to 49 pass
- [ ] Text and spacing cases 50 to 55 pass
- [ ] Accessibility cases 56 to 60 pass
- [ ] Ticket Tracker final pass cases 61 to 82 pass
- [ ] Placeholder insertion cases 83 to 90 pass (also covered by `tests/e2e/template-placeholder-insert.spec.ts`)
- [ ] Responsive & Touch block (§4) run; known gaps logged, not filed as bugs
- [ ] `tests/e2e/ticket-smoke.spec.ts` and `ticket-send-and-time.spec.ts` pass (3 tests) (the two older spec files, 7 tests, that open the form `aof-commitment` are stale and are expected to fail until rewritten)
- [ ] `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json` runs clean
- [ ] The simulator strip is absent from the production build
- [ ] No Out-of-Scope item (§2) has been filed as a bug

## 6. Full regression pass

Quick re-run list after any fix, before re-sign-off:
1. Create a ticket, reload, take over disabled, cancel with confirm (the smoke test)
2. Checklist completion and the pulse (once, not at load)
3. Charging case dates banner and Quotation card
4. Selected option blue in a select and in a dropdown
5. Label, value, helper, placeholder colors on the create view
6. Image insert/select/align (Header, Footer, Plain roles)
7. Button-link insert/select/align/export
8. Trailing-paragraph behavior (footer vs. non-footer end-of-doc)
9. Outlook export round-trip (table, callout, highlight, button)
10. Form field insert/validate/submit for each field type
11. Already-submitted read-only state
12. Print/PDF preview pagination
13. Form duplication content carryover (case 19: the existing Playwright test for it is stale)
