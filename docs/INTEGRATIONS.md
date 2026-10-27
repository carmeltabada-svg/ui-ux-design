# Integrations, Sending, Time and Signature

**Audience:** the developer who connects this front end to a real backend (Laravel and MySQL).
**Companion to:** [DEV_HANDOFF.md](./DEV_HANDOFF.md), [TICKET_WORKFLOW.md](./TICKET_WORKFLOW.md), [TEMPLATES_SPEC.md](./TEMPLATES_SPEC.md), [DATA_CONTRACT.md](./DATA_CONTRACT.md), [BACKEND_SWAP.md](./BACKEND_SWAP.md).

This file covers everything that crosses the boundary between the front end and a real system: sending email and SMS, the R24 (HRIS) data, time zones, the e-signature, and print to PDF. It separates **what exists today** (read from the code) from **what is recommended** (a design proposal, not built). Recommendations are marked **Recommended**; nothing marked that way exists in the code yet.

## 1. Email sending in the retrieval flow

### 1.1 Scope, corrected

Sending email is **in scope for the Ticket Tracker and the retrieval flow**. Only the *Templates builders* (the email editor and the form editor) are not responsible for delivery. The earlier wording that put email sending out of scope entirely applied to the builders and has been corrected in DEV_HANDOFF sections 4, 8 and 10.4.

Sends in the retrieval flow (each one is a button in the workspace):

| Stage | Send | Template | Recipient |
|---|---|---|---|
| A6 | Retrieval notice (plus the acknowledgment form) | by reason and mode (t1 to t11) | team member work email, or a typed personal email |
| B8 | Branch confirmation request | operator picks one (no default) | team member |
| B9 | Courier endorsement (remote) | t18 | the courier account manager |
| A8 | Midpoint and final reminders | t12 to t15 | team member |
| A9 | Overdue reminder | t16 or t17 | team member |
| A11 | Charging notice (plus a form to sign, depending on the outcome) | t22 to t25 | team member |
| A13 | Closure copy (PDF) | none (built in the page) | team member |
| Create | `assigned` and `takeover` notifications, the morning digest | none | Asset Team members |

### 1.2 What is built now, and what is not

**Built (front end and mock):** one send operation, `api().emails.send` (`POST /tickets/{n}/emails`), used by every stage send (notice, courier endorsement, branch request, reminders, overdue, charging notice). The request carries the stage, kind, template key, form id, recipients and an idempotency key. The mock server (`api/mock.ts`) renders the message from the ticket with `utils/ticketMessage.ts`, refuses it with a message when a placeholder cannot be filled, simulates a mail server (a 0.7 second delay, and a "Fail the next email send" switch in the Simulation Control popover), stores a snapshot on the ticket (`emails[]`), and applies the stage's own history entry through the existing recorder action. The page shows a Sending state on the button, an "Email not sent" banner and toast on a refusal (nothing is recorded, the same button retries with the same idempotency key), and the sent banner on success. The Templates builders stay free of sending. SMS is unchanged (copy and confirm). **The closure copy is still only recorded** (`closeTicket` with the documented flag); sending it uses the same operation in production but is not wired in the prototype.

**What the developer still builds:** the real server behind that operation (render in PHP against the same rules, send, store, status), the mail provider and sender mailbox, failed-attempt storage, reply detection, and the recipient form link. The list below was the gap analysis before this was built; items marked **built** are done in the front end and mock.

### 1.2a The gaps this closed, and what is left

**Original gap analysis: the setup was ready only partly.**

**What helps the developer:**
- Every send is already one named action per stage (`recordNoticeSent`, `recordReminderSent`, `sendBranchRequest`, `recordOverdueReminderSent`, `recordDeductionOutcome`, closure), so there is a place to hook each send.
- Templates have stable keys, and the ticket module's key map is documented (TEMPLATES_SPEC section 7).
- A placeholder guard exists before every send, and the placeholder rules are documented (TEMPLATES_SPEC section 6).
- All writes already go through `app/api` (BACKEND_SWAP.md).

**What is missing, and would make the developer's job harder (verified in the code):**

| Gap | Today | What a real send needs |
|---|---|---|
| **Built.** The send actions are recorders | `recordNoticeSent` and `recordReminderSent` take no arguments and only write a history line (for example "Retrieval notice sent (email + SMS)") | The request must say what to send: template key, form id, recipients |
| **Built.** Recipient override is lost | The "Use personal email" toggle and the typed address are page state and never reach the server | `to`, `cc`, `bcc` in the request |
| **Built.** Template and form overrides are lost | Replace and Remove in the pickers are page state (`overrideTemplateKey`, `overrideFormId`) | The chosen `templateKey` and `formId` (or none) in the request |
| **Built (rules extracted).** Token values are resolved in the page | `ticketRealValues` in `ticket-tracker/[id].vue` maps ticket fields to the 66 placeholders, and expands asset tables with regex over HTML | The server must render the message. Otherwise the front end would post finished HTML and the server could not validate it |
| **Built in the mock.** The placeholder check is client-only | The guard in the page blocks the send; the server does not check | A server-side check that refuses with the list of missing tokens |
| **Built in the mock.** Nothing is stored about what was sent | Only a history line; no subject, body, recipients, form version | A snapshot of the rendered message and attachments, recipients, sender, time, provider id |
| **Built in the UI.** No send status | The UI assumes the send succeeded the instant the button is pressed and shows "sent" | Pending, sent and failed states, with a retry; a failed send must not show as sent |
| **Built.** No idempotency | Pressing twice records twice (the UI hides the button after the first, but the server does not guard) | An idempotency key per send |
| Reply detection is simulated | `simulateBranchReply` fakes "a reply has arrived in Outlook" | Inbound mail integration (see 1.4), or drop the feature and keep "Mark Reply as Received" manual |
| The recipient form link is undefined | `ACKNOWLEDGMENT_LINK` is `https://forms.go.team/acknowledgment/{token}`, a placeholder host that is not a route in this app; `/form-preview` is an internal preview (TEMPLATES_SPEC section 5) | A real recipient page and token scheme (see section 5) |
| Forms attach by ticket mode | The attached form comes from the ticket mode and the charging outcome map, not from the template's own attachment (TEMPLATES_SPEC section 7) | One source of truth for which form a send attaches |

### 1.3 Recommended contract

**Recommended:** replace the recorder actions with one send operation per ticket, and keep the per-stage actions as thin wrappers over it. The page keeps its guards and banners; the server does the rendering and sending.

```
POST /tickets/{ticketNumber}/emails
{
  "stage": "A6",                        // which step sent it (for history and rules)
  "templateKey": "t2",
  "formId": "return-ack-remote" | null,
  "to":  ["m.ferrer@goteam.io"],
  "cc":  ["itasset@go.team"],
  "bcc": [],
  "idempotencyKey": "uuid"
}
```

The server should:
1. Load the ticket and the **active** template and form (refuse a deleted or retired one, or require an explicit override).
2. Render subject, body and form content from the ticket's data, using the rules in TEMPLATES_SPEC section 6, and refuse with `422` and a list of missing or unrecognized tokens.
3. Send, and store a **snapshot** (rendered subject and HTML, the form version and filled link, recipients, sender, sent time in UTC, provider message id, status).
4. Write the history entry and update the stage flags in the same transaction.
5. Return the updated ticket and the send record (`queued`, `sent` or `failed`).

The page then shows the real status and offers Retry on a failure. Closure and the digest use the same operation with a built-in template.

**Rendering location.** The rendering rules were JavaScript inside the workspace page. They are now one pure module, `app/utils/ticketMessage.ts` (`ticketTokenValues`, `renderTicketMessage`, and the asset expansion in `data/templates.ts`), used by both the page and the mock server. The developer reimplements them in PHP. **Still to do:** a set of fixed test cases (a ticket and a template in, the expected rendered text out) so the PHP port can be checked against the JavaScript.

**Sender and replies.** The prototype leaves a locked CC of `itasset@go.team` on every email, and the team works in Outlook. **Recommended:** send through the Asset Team's shared mailbox (for example Microsoft Graph against that mailbox) so every sent email appears in their Sent Items and replies land in their inbox. The developer owns the final choice of provider; this is the option that keeps the team's existing workflow and also makes reply detection possible.

### 1.4 Reply detection (optional)

The B8 reply banner ("A reply has arrived") is simulated. Real detection needs a mailbox integration that matches inbound mail to the request (a header or reference token). **Recommended:** ship it with the manual "Mark Reply as Received" button only, and add detection as a later enhancement. The banner copy and the 1-business-day alert already work without it.

## 2. SMS: discussion and recommendation

### 2.1 Where it is today

The SMS texts (11 templates, `data/smsTemplates.ts`) are **copy and paste**. The operator copies the text, sends it from Google Messages for web on their own phone, and taps "Mark SMS sent", which records that it was sent (`confirmSmsSentFor`). There is no gateway. The Asset Team asked for exactly this and it is built.

### 2.2 Can it be sent from inside AMS through Google Messages?

To my knowledge, **no supported way exists.** Google Messages for web works by pairing with the user's phone and has no public API for sending. Automating it would mean driving the web page or using unofficial libraries, which can break without notice, conflicts with Google's terms, and puts a paired phone session inside our app. **Do not build on that.** (This is based on what I know of Google's products; verify before committing, in particular whether Google offers any business messaging API for the Philippines that has appeared since.)

### 2.3 Options if SMS sending ever moves into AMS

| Option | What it is | Main trade-off |
|---|---|---|
| A. Keep copy and confirm (today) | The operator sends from Google Messages | No integration. Replies and the conversation stay in the thread the team already uses. The record of "sent" depends on the operator pressing the button |
| B. SMS gateway provider (Twilio, a Philippine provider such as Semaphore, or similar) | AMS sends through an API and records delivery status | Delivery status and an audit trail. **The text comes from a gateway number or sender ID, not from the team's phone, so replies do not arrive in Google Messages** and the conversation splits. May need sender ID registration with Philippine carriers (verify current rules) |
| C. A phone bridge app on the Asset Team's Android phone | AMS asks an app on their phone to send | Keeps the team's own number and thread. Depends on a phone staying on and connected, adds a security surface, and is harder to support |

### 2.4 Recommendation

1. **Ship Option A now.** It matches what the Asset Team asked for.
2. **Make the code ready for a channel, without building one.** **Recommended:** model each SMS as a message with a `channel` (`manual` today) and a status (`sent_confirmed`). The existing `smsSent{code: ISO}` and the Mark SMS sent action already behave as the `manual` channel, so a gateway later adds a `channel: 'gateway'` and a delivery status without changing the screens.
3. **Decide on B only if there is a need Option A cannot meet**, for example a compliance requirement for delivery receipts, or volume. Before that, ask the Asset Team whether losing the Google Messages thread for replies is acceptable. If they must keep the thread, B is a poor fit.
4. Treat C as an exploration only.

Capture the two open facts in the next discussion: who must be able to read replies, and whether anyone needs delivery proof.

## 3. R24 (HRIS) data the app needs

**Principle (decided with the Asset Team):** the AMS already holds the team member records and their assets. Do **not** bridge to R24 for anything the AMS already has. Fetch from R24 **only what the AMS does not have**, on a case by case basis when a ticket is created or opened, show it in the ticket, and **do not keep a copy of it in AMS tables** (servicing R24 data inside the AMS is not recommended).

The prototype fakes both sources with one mock, `app/mocks/hris_directory.json` (five employees, type `HrisRecord` in `app/data/ticketTrackers.ts`), loaded through `GET /hris/team-members` in `app/api/http.ts`. That single list has to be split into the two sources below.

### 3.1 Already in the AMS: read from the AMS, do not fetch from R24

| Field | Used for | Notes |
|---|---|---|
| Personal email | Optional alternate recipient; seeds the contact card | May be empty |
| Contact number | Contact card, SMS "To", call confirmation | May be empty; SMS and calls are blocked with "No contact number on file. It comes from the employee record, so update it there first." |
| Alternate contact (name and number) | More details, tokens | May be empty. The decision named the number; the name is assumed to live with it |
| Address | Courier branch suggestion, `TM_PRESENT_ADDRESS` | The Asset Team can correct it **for one ticket** (`teamMemberAddressOverride`); the master record is never changed |
| Client | Client column, asset owner rule, `CLIENT_NAME` | `Internal` means a GoTeam-owned asset; any other value means a client-owned asset |
| Position (job title) | Shown next to the recipient email on send screens | |
| Assets | The asset list at A5 | See 3.3 |

### 3.2 Fetch from R24 (not in the AMS), per ticket

| R24 field | Used for | Notes |
|---|---|---|
| Last Working Day | Return clock, IT lock, checklist due date, deadlines, `LAST_WORKING_DAY` | A **calendar date** (`YYYY-MM-DD`). Can change later (3.4) |
| Separation Date | The endorsement date rule, `SEPARATION_DATE` | May be blank for an ongoing absence case |
| Shift `{ days, start, end }` | IT lock run time (the end of the shift that starts on the Last Working Day; an overnight shift runs the next day) | 24-hour `HH:MM` in the team member's local time. May be missing; the page then says "No shift is on file..." |
| Suggested reason (from the offboarding case) | Pre-fills Reason on the create view | The operator may override with a note |
| Department | Details panel, Artifacts, gate pass "Dept. / Role" | Confirmed as an R24 field |
| Leadership coach | Details panel and `LEADERSHIP_COACH` token (format `Name - Role`) | Confirmed as an R24 field |
| Mode (onsite or remote) | Pre-fills Mode on the create view | Confirmed as an R24 field. The operator may override it with a note |

Employee id, name and work email are already in the AMS (confirmed), so they are read from the AMS.

`caseType` (for example "Voluntary Resignation") is in the mock record but **no screen reads it**. Do not fetch it.

### 3.3 Assets: serials and tags

The mock gives each unit only a category (`name`) and a `model`, and **invents the serial number and asset tag** (`SN-NNNNN`, `GT-AST-NNNN`, derived from the employee id). The AMS asset records already hold the real serial and asset tag per unit (confirmed), so the real system reads them from there. They print in emails, forms, gate passes and the charging table, and the app identifies a unit by serial (charging case, gate pass). 
Still to confirm: whether one team member can hold two units of one category (the current sync matches by category name, so a second monitor would be missed; match by asset id instead), and how a unit's remarks and returned state are held (on the ticket, per unit).

### 3.4 What the ticket stores, and the consequence of "do not store R24 data in the AMS"

Fetching on a case by case basis and surfacing in the ticket works for **display fields** (shift, and any department or coach that comes from R24). It has one consequence the developer must handle, because the tickets also make **decisions and send documents** from those values:

- The **Target Date**, the IT lock schedule and the emails already sent are all computed from the Last Working Day. Keep the Target Date and the sent-message snapshots on the ticket as the **record of what was decided and sent**. They are the ticket's own data, not a copy of R24.
- To notice that the Last Working Day changed, the ticket must remember the value it last used. **Recommended:** store one value on the ticket, `lwd_seen` (the date the current Target Date was computed from), and compare it with R24 when the ticket is opened or on a schedule. On a difference the server runs the update flow below. Without it, there is nothing to compare against.
- Do not copy the other R24 fields onto the ticket. Fetch them when needed (with a short cache) and fail visibly if R24 is down (for example "Shift unavailable").

The prototype currently embeds a whole `employee` record in every ticket (a snapshot). That is the shape to **replace**: the ticket should hold the AMS team member id, the AMS asset ids per unit, the per-ticket contact verification flags and address correction, and `lwd_seen`.

### 3.5 Changes after the ticket exists (Last Working Day)

`simulateHrisLwdUpdate` shows the flow. On a change the server must: update `lwd_seen`; if assets are locked, recompute the Target Date and append a re-baseline entry (actor "System", reason naming the old and new dates); flag the IT lock for reschedule only if it was scheduled against the old date; set `hrisUpdatePending`; notify the assignee (`record-update`). Rules are in TICKET_WORKFLOW section 4 and the `simulateHrisLwdUpdate` summary. R24 must either push the change or the backend must poll for it.

### 3.6 When it is read

- **Create view search (name or id):** an AMS query. **Recommended:** server-side with paging; the prototype loads the whole directory into the browser at startup.
- **On create:** one R24 request for the four fields in 3.2 (plus anything confirmed above).
- **On opening a ticket:** the shift and the Last Working Day check.

### 3.7 Other data with no source system yet

The Asset Team members, couriers, courier branches and the Asset Team contact details are fixtures with no source system and no edit screen (TICKET_WORKFLOW section 10). Decide where each is owned.

## 4. Time zones, dates and timestamps

**Requirement:** every date and time shown to a user matches **that user's** time zone.

### 4.1 Rules

1. **Instants** (when something happened or was sent: history entries, `lastUpdatedAt`, send time, `checklistReview.at`, notification time, template and form versions, autosave) are stored as **UTC ISO 8601 with offset** (`2026-10-14T06:41:00Z`) and formatted **at display time** in the viewer's time zone. They are never stored as pre-formatted text.
2. **Calendar dates** (Last Working Day, Separation Date, Target Date, endorsement date, recall date, gate pass valid until, the charging dates) are stored as `YYYY-MM-DD` with **no time zone** and shown as the same calendar day to everyone. They are not instants and must not be shifted.
3. **"Today"** for overdue, due soon, the days-left label and the checklist due date is the calendar date in the viewer's time zone. A ticket can therefore be overdue for a viewer in Manila an hour before it is overdue for a viewer further west; this is the intended consequence of the requirement. Alerts and the digest are produced by the server and need a per-user time zone (see below).
4. Parse a date-only string as a **local date** (`parseLocalDate`), never with `new Date('2026-10-13')`, which reads it as UTC.

### 4.2 What is built now, and what is left

**Built (front end and mock), checked in the browser in Asia/Manila, UTC and America/Los_Angeles with the same stored data:**
- Activity Log entries, call attempts, notification times, template and form save times, and version dates are stored as **UTC ISO instants** and formatted at display time by `formatDateTime` in `app/utils/dateTime.ts`, in the viewer's zone. The same seeded entry read "1:05 PM" in Manila, "5:05 AM" in UTC and "Oct 12, 2026 · 10:05 PM" in Los Angeles. Older saved entries in the old text form still display (they are read in the viewer's zone, which is the best that can be done for them).
- The seed times were converted from Manila text to UTC.
- Date-only values are read as local dates (`parseLocalDate`): the transit delay and "day N" no longer read them as UTC. The closure PDF reference uses the local date.
- `SentBanner`, the Activity Log, the Artifacts summary and the notification list all format at display time.

**Left for the developer and the next pass:**

| Where | Problem |
|---|---|
| `createdAt` | Still a calendar date string. It is also the "notice date" anchor for immediate resignation. The server should set it (in the company's business date) |
| Morning digest and `scanTicketAlerts` | The 08:00 digest uses the browser's local clock; there is no stored time zone per Asset Team member. A server job needs one |
| Number formats | Every date uses the `en-US` locale. If users should see their own locale format, pass the user's locale |
| Time of "today" on the server | Overdue and due soon use the viewer's calendar date in the browser. A server that computes alerts needs the recipient's zone |
| Automated test | The check was run once by script (`tz-check`, not kept in the repo). Node on Windows ignores the `TZ` variable, so an automated multi-zone test needs a browser context with a time zone (Playwright `timezoneId`) |

### 4.3 Recommended work

- Store a time zone and locale on each Asset Team user (default from the browser) and use it for the server's alerts and the 08:00 digest.
- Run date tests in more than one time zone (for example `Asia/Manila`, `UTC` and `America/Los_Angeles`), per the pre-merge workflow, in a test that sets the browser time zone.
- Keep `when`, `sentAt`, `lastSavedAt` and every other instant as a UTC ISO string at the API boundary.

## 5. E-signature: recommended and necessary features

**Today:** the signature field captures a drawn or uploaded image only. It stores no timestamp, identity, IP address or audit trail, and answers and submissions are not stored at all (TEMPLATES_SPEC section 4.2). The submit step only records a browser timestamp and shows a toast.

**Goal:** a signature a person could later rely on as evidence, with an audit trail, without adding features that do not help that. I am not a lawyer. **Get legal review of the final design**; Philippine electronic commerce rules (the Electronic Commerce Act and the Rules on Electronic Evidence) generally recognize electronic signatures and documents, but the required level of evidence for this business is a legal decision (DEV_HANDOFF 10.5).

### 5.1 Recommended (necessary for evidence)

| # | Feature | Why | Where |
|---|---|---|---|
| 1 | **A recipient page with a unique, expiring, single-use link** (token in the URL, not guessable, not the ticket id) | Ties the signature to the person the link was sent to | New page; replaces the browser-only `/form-preview` handoff |
| 2 | **Server-side capture at signing**: UTC time, IP address, browser, the link token, the signer's name as on record | Evidence the client clock cannot supply | Backend |
| 3 | **An explicit consent step** ("I agree to sign this electronically") with the signer's typed full name | Shows intent to sign | Front end plus backend |
| 4 | **Pin the exact form version that was signed** (form id and version, plus the values) | Today the live form content is used; a later edit would change what was signed | Backend |
| 5 | **A hash of the final document** (SHA-256 of the rendered document including values and the signature image), stored with the record | Detects any later change | Backend |
| 6 | **Freeze after signing**: a submitted record cannot be edited; a correction is a new record | Integrity | Backend |
| 7 | **An append-only audit log** of events: link sent, opened, started, signed, submitted, copy emailed, printed, with the actor, UTC time and IP | The audit trail | Backend |
| 8 | **A signed copy**: a PDF of the filled document with the signature, signer name, signing time, record id and hash, emailed to the signer and kept | The record both sides keep | Backend (server-side PDF; see section 6) |
| 9 | **Verify the recipient** before showing the form: send the link to the work or personal email on record, and optionally a one-time code to that email or the contact number | Reduces "someone else signed" | Backend |
| 10 | **Retention and access rules**, plus privacy review: signature images are personal data | Compliance | Backend and policy |

### 5.2 Not recommended (redundant for this need)

Certificate-based digital signatures (PKI), biometric capture, blockchain notarization, and a third-party e-signature vendor are not needed to achieve the list above, unless the legal review requires them. The Asset Team's forms are acknowledgments and authorities to deduct, and a link-verified, hashed, audited signature is the proportionate level. Reconsider if legal advises otherwise.

### 5.3 Front-end work implied

The signature field and the "locked until the other required fields are filled" rule can stay. New: the consent step, a signed-state read-only view, an "expired link" page, and a submission payload (field id to value, with the signature image). The submission model itself is not defined yet (TEMPLATES_SPEC section 9).

## 6. Print and PDF

### 6.1 What the user sees, from the code

On `/form-preview`, **Print / Save as PDF** (`printForm` in `form-preview.vue`):
1. builds a static copy of the document (fields rendered as text, hints hidden),
2. runs it through **Paged.js**, which lays the real pages out in a print area on the page,
3. calls `window.print()`.

So the window that opens is the **browser's own print dialog**, and its preview shows the Paged.js pages, because while `printing` is on, the fill view is hidden and only the Paged.js print area is shown. Paged.js is what produces the pages; the browser still draws the dialog. (If you saw a pop-up that was not the browser dialog, it was most likely the on-page Paged.js area that appears just before the dialog; this is a code reading, not something I ran.)

### 6.2 Does the preview match the print? Mostly, with two caveats

- **The browser's print preview is the same Paged.js layout that will be printed or saved**, so what you see in that dialog should match the output. The Paged.js pages and the dialog use the same page size and margins (`buildPrintCss`).
- **The on-screen editing and fill views are not the same engine.** They use `tiptap-pagination-plus`, which only approximates pages. A page break in the editor can differ from the Paged.js output. Trust the print dialog, not the editor, for page breaks.
- **Not independently verified:** nobody has compared the Paged.js output with a physical printout, or with a saved PDF in other browsers. Only Chromium has been used. This remains an open verification item (DEV_HANDOFF 10.6).

### 6.3 Recommendation

Browser printing is not suitable for the **signed copy** in section 5: it depends on the user's browser, and a saved PDF can be changed. **Recommended:** generate the signed PDF **on the server** from the same document HTML and print CSS (a headless Chromium or a PDF service that supports Paged.js or equivalent), and keep `window.print()` as a convenience for people reading a form. The closure PDF has the same limitation: it is regenerated on demand in the browser and is not an immutable record.

## 7. Dark mode

**Status:** built and audited. Light, Dark or System (the default) from the navbar toggle, remembered under `ams:color-mode`. Nuxt UI color mode puts `.dark` on `<html>`. The tokens are in `app/assets/css/main.css` and the measured values are in `AMS_DESIGN_SYSTEM.md` section 1.5.

What the dev needs to know when porting:
- **Documents stay light.** Add the class `ams-paper` to anything that stands for paper or a real email client: `/form-preview`, the gate pass preview, the closure record attachment. The email editor and the form editor are dark. Form document colors are the `--ams-doc-*` tokens (original hex in light and on paper). A color a user picks inside a document is inline and does not follow the theme. Inside it every token returns to its light value. A translucent background directly on a paper surface blends with the dark page, so give it an opaque one. `@media print` forces the light tokens, so printed and exported output is unchanged. Email HTML and EML export use inline hex and are not theme aware.
- **Tokens, not colors.** `bg-white` is now `bg-card`. The pinned `rgb(0,127,69)` and `#894b00` text are `text-ams-success` and `text-ams-warning`. Tailwind gray, slate and the 50 to 300 tints of the status hues are redefined under `.dark`, and the 600 to 800 text shades are mapped to light tints in `@layer utilities`. Any new color class written for a light surface needs a dark value there.
- **One primary token feeds text and fill** in Nuxt UI, so dark primary is `#7da2ff` and a solid primary button is that blue with dark text. Status pills keep their solid fills with white text.
- **Placeholder passes AA in dark** (5.9:1). The light placeholder exception (3.5:1) is unchanged.
- **Focus ring.** Dark uses a full strength primary outline. Nuxt UI's default (primary at 25% opacity) is about 1.6:1 in dark and 1.4:1 in light, and light is left as it was.
- **Logo.** `public/img/logofull-white.svg` shows in dark, `logofull-default.svg` in light.
- **What was and was not checked** is in `DEV_HANDOFF.md` section 13, and the open items are in section 15.
