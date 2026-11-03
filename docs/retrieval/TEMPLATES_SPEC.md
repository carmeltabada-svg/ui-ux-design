# Templates and Master Data Specification

**Audience:** the developer building the backend for email templates, retrieval forms and checklists, and porting the builders.
**Companion to:** [DEV_HANDOFF.md](./DEV_HANDOFF.md), [TICKET_WORKFLOW.md](./TICKET_WORKFLOW.md) (the tickets that send these), [DATA_CONTRACT.md](./DATA_CONTRACT.md), [BACKEND_SWAP.md](./BACKEND_SWAP.md).

Read from the code, first on branch `checkpoint` and refreshed on 27 October 2026 against `main` (the source of truth after pull requests 1 and 2). Cites name files and symbols, not line numbers. **UNVERIFIED** marks anything inferred and not confirmed by reading or running. DEV_HANDOFF sections 3.2, 6.1 and 6.2 hold the Tiptap and Outlook export traps; this file does not repeat them.

## 1. What the Templates module is

Two builders behind one list page, `/templates`, with two tabs (Email, Forms):

- **Email templates** (`pages/templates/email/[id]/edit.vue`): a Tiptap body editor with an Outlook-safe export.
- **Retrieval forms** (`pages/templates/forms/[id]/edit.vue`): a paginated Tiptap document with field nodes, plus `/form-preview` for filling and printing.

Both are consumed by the ticket workspace, which resolves a template or form at send time (section 7).

State is held in reactive stores (`data/templates.ts`, `templateRuntime.ts`, `retrievalForms.ts`) that start empty and are filled by `plugins/00.masterData.ts` from the api. Saving goes through `data/recordSync.ts`: a deep watch with an 80 ms debounce that sends `PUT /email-templates/{key}` or `PUT /retrieval-forms/{id}` per changed record and `DELETE` per removed record. A failed save (`{ ok: false }`) is not marked sent and is retried on the next change.

**Behavior that applies to every page, including the editors** (added in the final pass, see DEV_HANDOFF section 14 and 15):

- `plugins/closeMenusOnScroll.client.ts` closes any open select or dropdown menu when the page scrolls (not when its own list scrolls). It is global and sends a synthetic Escape; a layering fix is the better cure (DEV_HANDOFF section 15).
- A visible keyboard focus ring in both themes (a rule in `assets/css/main.css`), so the editors' toolbar buttons and menu items show focus.
- Light, Dark or System theme from the navbar toggle. Documents that stand for paper stay light.

## 2. Templates list page

- Title "Templates", subtitle "The emails and forms your team sends and collects, all in one place." The active tab is kept in `?tab=forms|email` (default email). Rows are cards, not a table.
- **Create Template** on the Email tab, **Create Form** on the Forms tab (primary, a dropdown): "Start from blank" or "Start from an existing template" (on Forms "Start from an existing form", which opens with `?mode=edit` rather than `?created=1`), with a search field when more than 5 choices exist.
- **Search** matches name or description (case-insensitive substring). **Status chips:** All, Active, Draft, Retired. **Mode:** All modes, Onsite, Remote. No sort control: custom (created) templates first, then the seed templates in group order. On the Forms tab a created or duplicated form is added to the end of the list. Seven rows per page; the page resets on any filter change.
- **Row:** a hover-only checkbox, an icon with a status dot, name, status badge, mode badge, a one-line description, and "Last saved {x}" (drafts) or "Updated {x}". Hover actions: Edit, Duplicate, and a More menu (Retire or Reactivate, Delete). A row opens the editor in **read** mode; the pencil opens it in edit mode.
- **Bulk:** "Retire selected" and "Reactivate selected" only (no bulk delete or duplicate). Selection is not cleared when the tab or filter changes; it is cleared after a bulk action. Both tabs show an "N selected" count and a Clear button. Other toasts: "Template deleted" or "Form deleted"; "Form duplicated" with "{name} was added as a draft"; "Form retired" or "Form reactivated"; "{n} template(s)" or "{n} form(s)" retired or reactivated. In the editors an Active status toasts "Template published" or "Form published" and Draft "Marked as draft".
- **Behavior and toasts:**

| Action | Result |
|---|---|
| Create blank email | UUID key, opens the editor in edit mode (`?created=1`) |
| Duplicate (email) | New UUID, name "{name} (copy)", status forced to draft, history not copied. Toast "Template duplicated" / `"{name}" was added as a draft.` |
| Retire or Reactivate | Sets status only. Reactivate always sets Active, even if the template was a draft before it was retired. Toasts "Template retired", "Template reactivated" |
| Delete | Confirm modal: `Delete "{name}"? This can't be undone.` with "Keep it" and "Delete template" (or "Delete form"). Hard delete including history |
| Create form blank | Draft named "Untitled form", onsite, theme `#386BE6`, Letter page |
| Duplicate form | New UUID, "{name} (copy)", draft. The content HTML is copied as is: **field ids inside the content are not regenerated**. Versions are not copied |

- **No usage check anywhere.** Retire and Delete do not check whether a ticket path, a reminder, a charging outcome or another template points at the item. Deleting a created template makes the ticket's `templateForKey` return null for that key. Deleting a seed template only hides it (`DELETED_TEMPLATE_KEYS`): `templateForKey` re-creates the shipped default from `TEMPLATES`, so tickets keep sending it, and only the pickers and the list hide it. Decide whether deleting a template in use must be refused.
- Statuses: Draft (new or duplicate), Active (published), Retired (a label only). Ticket send pickers show only Active items; the auto-resolved defaults are not status-checked (section 7).
- Empty state: "No templates found" ("No forms found" on the Forms tab) / "Try clearing filters or adjusting your search."

## 3. Email templates

### 3.1 Model
`TemplateRuntime`: name, mode (onsite or remote), description, subject, body (HTML), cc[] and bcc[] (`{email, locked?}`), status, attachment (the display **name** of a form, or `none`), `attachmentFormId`, background (hex), footerNote, `lastSavedAt` (a UTC ISO instant), `nameManuallySet`. A record is `{ key, runtime, history[], system }`.

All shipped subjects carry the employee id after the name, for example `Equipment Return Notice | {{TM_FULL_NAME}} ({{EMPLOYEE_ID}}) | {{APR_REF}}`; `migrateTemplateSubject` in the mock adds it to saved copies. Keys: `t1` to `t18` and `t22` to `t25` are shipped (20 templates); created ones use a UUID. The gaps t7, t8 and t19 to t21 do not exist. Groups (not shown on the list): Return Notices (Resignation t1 to t4, End of Contract t5 and t6, Recalled t9 and t10, Unexplained Absence t11), Reminders and Overdue (t12 to t17), Courier (t18), Post-Retrieval Charging (t22 to t25). Seed defaults: CC `itasset@go.team` (locked), status Active. Shipped attachments: t1, t3, t5, t9 carry `return-ack-onsite`; t2, t4, t6, t10, t11 carry `return-ack-remote`; t23 to t25 carry their charging forms; t12 to t18 and t22 have none.

### 3.2 Editor behavior (beyond DEV_HANDOFF 6.1)
- **Read and edit modes.** Edit opens with the Edit button, `?created=1` or `?mode=edit`. Read mode shows tokens highlighted and a browse-only Placeholders drawer (clicking a token copies `{{CODE}}`; the drawer shows a sample value). **Inserting placeholders** (edit mode): both the Subject line and the body toolbar have an Insert placeholder (braces) button. The button that opened the drawer decides where inserts go (the drawer says "Inserting into Subject line" or "Body"). A placeholder is inserted at the author's cursor, replacing any selected text; it never goes to the end. The drawer stays open so several can be inserted in a row (each shows "Added", counted only when the insert really happened). Escape closes the drawer while focus is in it; below 640px it is a bottom sheet so the field stays visible above it. After a keyboard pick in the subject, focus stays on the token row. If the author has not clicked into the field in this edit session, nothing is inserted and a "No active cursor" toast says so; an image or button selected in the body gives the same toast, so it is never replaced. Save leaves edit mode; there is no publish step. Status and Mode changes apply immediately in either mode (there is no edit lock).
- **Header:** back, inline name (pencil in edit mode; "Untitled" fallback), description (max 140; "No description"), status, mode, autosave indicator, and an overflow menu: Download EML, Copy to clipboard, Mode, Status.
- **Auto-name:** while `nameManuallySet` is false the name follows the subject.
- **Cancel** reverts only subject, body, background and footer note. Name, description, mode, status, CC, BCC and attachment are autosaved at once and are **not** reverted by Cancel.
- **Autosave** shows "Saving..." then writes `lastSavedAt = nowISO()`, a UTC ISO instant shown in the viewer's time zone through `formatDateTime`. The "Can't save - you're offline" state follows `navigator.onLine` only.
- **Versions** are recorded on Save only (not autosave, not Cancel), when subject, body, CC, BCC or attachment changed (microdiff). Labels: "Subject line", "Email body", "A recipient" or "{n} recipients", combined "X and Y updated" or, with three or more, "X, Y, and Z updated" (Oxford comma). Name, description, mode, status, background and footer changes create no version. Cap 50, ids `v{max+1}`. The first entry is "Initial version" (t16 is the exception: its history is seeded from `VERSION_HISTORY_T16` with "Wording corrected" by Geraldene de la Torre and "Created from spec" by System) (actor System for seed keys, else the current user). The actor is hard-coded (`CURRENT_USER_NAME`).
- **Restore** (History tab: "Version history" / "Every saved change to this template's content.") applies subject, body, CC and BCC only, **not the attachment**, and toasts `Restored "{label}"` / "Save to keep it." Disabled when retired.
- **Retired banner contradiction:** the banner says "This template is retired. It can't be edited. Reactivate it to make changes." but editing is **not blocked** (the code comment says retired is only a label). Fix the copy or add enforcement.
- **Insert placeholder** opens the "Placeholder Library" (search, All or "Used in template {n}"). Insert **appends** `{{CODE}}` to the end of the subject or body (whichever was last focused), not at the caret.
- **Attach a form:** lists only Active forms. The chip shows the form name, "Online form via link", and Preview, Edit, Replace and Remove. The template stores the form's name **as a copy** at attach time, so renaming the form later does not update it. If `attachmentFormId` is unset, Preview and Edit fall back to `return-ack-onsite`.
- **Recipients:** To is fixed to `{{TM_EMAIL}}`; CC and BCC choose from `data/teamMembers.ts` (8 fixtures). The locked CC `itasset@go.team` cannot be removed.
- **Background and footer:** none or one of six fixed swatches (there is no free colour picker); an optional footer note.
- **Export:** EML is `Subject`, `Content-Type` and the HTML, resolved with **sample values**, with no To, CC, BCC or attachment headers. Copy to clipboard writes HTML and plain text.
- **Concurrency:** none. Two tabs editing one template are last write wins (each save sends the whole record).
- **v-html sinks:** `wrapTokens` output (token values are escaped; the template's own subject text is not) and the Full Preview modal subject. Both render author content, not user input; sanitize on the server if authorship widens.

## 4. Retrieval forms

### 4.1 Model
`RetrievalForm`: id (slug for seed forms, UUID for created), name, description (max 140), mode, status, `updatedAt` (a UTC ISO instant written on every autosave), `themeColor` (default `#386BE6`), `background {type solid|gradient|image, value}`, `pageSize` (letter 816x1056, legal 816x1344, a4 794x1123, tabloid 1056x1632, in pixels at 96 dpi), `margins {top, right, bottom, left}` (0 to 200; presets Normal 96, Narrow 48, Moderate 96/72, Wide 96/192, Custom), `category`, `nameManuallySet`, `showSubmitButton` (default off). A record is `RetrievalForm` plus `content`, `sections[]` and `versions[]`.

**Content is one Tiptap HTML string.** The legacy `sections` and `FormSection` types remain only for a one-time migration (`ensureFormContent`); all five shipped forms have `sections: []`. Shipped forms: `return-ack-onsite`, `return-ack-remote`, `atd-loss-damage-non-return`, `atd-settlement-transfer`, `notice-assessment-quotation-pending`.

### 4.2 Field node
`div[data-form-field]` with `id` (UUID, must stay unique and stable), `field-type`, `label` (default "Untitled field"), `hint`, `required`, `button-url`, `button-color`, `hide-label`. Seven types:

| Type | Insert label | Behavior |
|---|---|---|
| `short_text` | Short answer | Text input |
| `paragraph` | Long answer | Textarea |
| `number` | Number | Text input that strips everything but digits, one leading minus and one dot; error "Must be a number." |
| `checkbox` | I acknowledge | Boolean |
| `file_upload` | Attachment | `image/jpeg` and `image/png` only, one file, preview and remove; kept as a data URL for print |
| `signature` | Signature | Draw (canvas) or Upload. Always required. **Locked** (veil, "Locked" badge, tooltip "Complete these first:") until every other required field is filled. Error "Signature is required." No timestamp, identity or audit trail |
| `button_link` | Open link | Link opens in a new tab through `safeUrl` (http, https, mailto, tel, relative); never required; active only in the interactive view. In the **print** render the href is only HTML-escaped, not passed through `safeUrl` |

New fields are required unless they are button links. Required error: "{label} is required." (checkbox: "This is required."); errors show after blur or a submit attempt. A field's gear popover edits type, label, show label, hint, link URL and required, applied live. Fields can be duplicated (new id), removed and dragged.

**Field values are never persisted.** Answers live in the node view and a per-page registry. Nothing is sent on submit. The backend must define a submission model (field id to value, with file and signature blobs).

### 4.3 Builder page behavior
- **Read and edit modes** (`Edit` or `Done`). Fields are fillable only in edit mode (to test them); read mode is a structural preview.
- **Header:** inline name, a collapsible description, status, mode, autosave, and buttons Placeholders (read mode), Preview (new tab `/form-preview?formId=...&mode=...`, flushing the save first), Edit or Done. Overflow: Copy link, Duplicate form, Version history, Mode, Status, Background (4 solids, 4 gradients, color picker, image URL or upload under 5 MB), Page size, Margins, and the Submit button switch.
- **Letterhead and layout:** per page, a logo and the GoTeam entity address header (`GOTEAM_ENTITY_ADDRESS`), a footer "{form name} · Internal Use Only" and "Page {n} of {total}". On-screen pagination is `tiptap-pagination-plus` (approximate); print is `pagedjs`.
- **Autosave** every 600 ms writes the record and `updatedAt = nowISO()`. Leaving the page flushes the sync.
- **Undo and redo** for page-level settings (name, description, mode, status, theme, background, page size, sections): Ctrl+Z and Ctrl+Shift+Z or Ctrl+Y, 50 deep. Margins and the Submit button switch are not in the undo stack or in saved versions. Text undo is Tiptap's.
- **Versions** are recorded on Done, and also on leaving the page or unloading, so leaving mid-edit saves a version. Categories: "name and description", "a section" or "n sections", "a field" or "n fields", "field content", "appearance", "form content". Cap 50 by dropping the oldest, and ids are positional (`v{index+1}`), so **ids renumber after the cap**. Restore re-applies the snapshot including content but not margins or the submit switch; it is disabled when retired.
- **The version View modal shows nothing useful:** it renders only legacy `sections`, which are empty, so it shows just the form name. There is no content preview of past versions.
- **There is no edit lock.** Nothing blocks editing, retiring or deleting a form that a template or ticket uses. The only related gating: the placeholder buttons in the toolbar and in field labels are enabled only when the form is attached to an email template; and structure (typing, toolbar, drag, gear) is editable only in builder edit mode, while the values are interactive in builder edit mode and always on `/form-preview`.
- Legacy components that are dead or nearly so: `FormDocumentField.vue` (the only place `<FormKit>` renders, used only by the version modal), `FormFieldPropertiesPanel.vue`, `FieldRowControls.vue`, `StaticTextEditor.vue`.

## 5. `/form-preview` (fill, submit, print)

- Layout `blank`, client-rendered only (`routeRules` entry in `nuxt.config.ts`). Query: `formId` (default `return-ack-onsite`), `ref` (the ticket reference), `mode` (letterhead only), `ticket` (ticket id).
- **States:** "No form found for "{formId}"."; already submitted ("This form has already been submitted" / "A signed copy was emailed to you when it was submitted. This link can no longer be previewed or filled out again.", with Print hidden); or the fillable document with the caption "Submit the completed form to the Asset Management Team at {email} or {mobile}." (constants from sample values).
- **Submit** appears only when the form's `showSubmitButton` is on, and is disabled while any required field is empty (so the "reveal all errors on submit" path is unreachable). It records a timestamp in browser storage under `ams:formSubmissions:v1` (key `{formId}:{ref}`), toasts "Form submitted" / "A signed copy has been emailed to you for your records." and **stores no values and sends no email**. "Single use per form and reference" is client-side only.
- **Print / Save as PDF** builds a static copy (`formFieldStaticRender`) with `buildPrintCss` and a `pagedjs` Previewer, then `window.print()`. Hints are hidden in print. Error: "Could not prepare the printable copy. Please try again."
- **Token resolution:** with `?ticket=`, values come from browser storage (`ams:formPreviewValues:{ticketId}`, written by the ticket workspace) and unresolved codes stay as raw `{{CODE}}`. If the stored values are missing (another browser, cleared storage) the page silently falls back to sample values, so it can show the fake name "Juan Miguel Dela Cruz" instead of raw tokens. Without a ticket, sample values resolve and unresolved codes print blank. **This cross-tab handoff does not work for a real recipient on another device.**
- **The recipient-facing link is undefined.** The email's `ACKNOWLEDGMENT_LINK` is `https://forms.go.team/acknowledgment/{acknowledgmentToken or id}`, a placeholder host that is not this route. `/form-preview` is an internal preview. The real token scheme and the recipient page are future work.

## 6. Placeholders (tokens) and rendering

Syntax `{{CODE}}` (regex `\{\{(\w+)\}\}`), also resolved inside tag attributes (`href`, `data-href`) with attribute escaping. SMS uses single braces (`{NAME}`, `{REF}`, `{DATE}`), except the call escalation text, which uses `{{CODE}}`.

Where each token's value comes from, and whether production supplies it (Yes, No or Open), is in [TOKEN_DATA_MAPPING.html](./TOKEN_DATA_MAPPING.html). That file does not claim production field names or types; the developer fills those in. This section covers the syntax and the rendering rules.

**66 tokens in 8 groups** (`TOKEN_INFO` in `data/templates.ts`):
- Custodian (10): `TM_FULL_NAME`, `TM_FIRST_NAME`, `EMPLOYEE_ID`, `TM_EMAIL`, `TM_CONTACT_NUMBER`, `TM_PRESENT_ADDRESS`, `CLIENT_NAME`, `LEADERSHIP_COACH`, `ALTERNATE_CONTACT_NAME`, `ALTERNATE_CONTACT_NUMBER`.
- Ticket (4): `APR_REF`, `TICKET_CREATED_DATE`, `RETRIEVAL_REASON`, `RETURN_MODE`.
- Dates (13): `TARGET_RETURN_DATE`, `TARGET_DISPATCH_DATE`, `LAST_WORKING_DAY`, `SEPARATION_DATE`, `NOTICE_DATE`, `DATE_OF_THIS_NOTICE`, `LEAVE_START_DATE`, `RECALL_EFFECTIVE_DATE`, `DATE_OF_ORIGINAL_NOTICE`, `DAYS_OVERDUE`, `ORIGINAL_TARGET_DATE`, `ACKNOWLEDGMENT_DUE_DATE`, `ESCALATION_DEADLINE`.
- Assets (6): `ASSET_NAME`, `ASSET_TAG`, `SERIAL_NUMBER`, `ASSET_QTY`, `ASSET_TABLE`, `ASSET_TABLE_QTY`.
- Courier (9): `COURIER_NAME`, `COURIER_ACCOUNT_NAME`, `COURIER_ACCOUNT_NUMBER`, `ACCOUNT_MANAGER_NAME`, `ACCOUNT_MANAGER_EMAIL`, `BRANCH_NAME`, `BRANCH_ADDRESS`, `DECLARED_VALUE` (fixed "PHP 5,000.00"), `TRACKING_NUMBER`.
- Asset Team (7): `ASSET_TEAM_NAME`, `_ADDRESS`, `_MOBILE`, `_LANDLINE`, `_EMAIL`, `_SCHEDULE`, `_OFFICER`.
- Links (2): `ACKNOWLEDGMENT_LINK`, `TRACKING_LINK`.
- Post-Retrieval Charging (15): `CASE_OFFICER`, `ATD_REFERENCE`, `ASSET_OWNER`, `DATE_RETURN_REQUESTED`, `DATE_RECEIVED`, `DATE_ASSESSED`, `DATE_BUYOUT_ELECTION`, `QUOTATION_EXPECTED_BY`, `HEAR_BACK_BY`, `RESPONSE_DUE_TM`, `AMOUNT_BASIS`, `SUPPORTING_DOC_REF`, `AMOUNT_FIGURES`, `AMOUNT_WORDS`, `ASSET_CONDITION`.

**Three resolution layers:**
1. Editors, previews and EML export use `SAMPLE_VALUES` (fake data such as "Juan Miguel Dela Cruz" and `APR-2026-04821`).
2. The ticket workspace uses `ticketTokenValues` (`utils/ticketMessage.ts`, shared with the mock server's `renderTicketMessage`; the page's `ticketRealValues` only wraps it), which maps ticket fields to tokens and leaves a token undefined when the ticket has no value. Organization constants (`ORG_CONSTANT_TOKENS`: the Asset Team details, `DECLARED_VALUE`, `COURIER_ACCOUNT_NAME`) come from sample values. Any other unresolved token stays as a raw `{{CODE}}`.
3. `/form-preview` resolves through `resolveTokensForPrint`.

**Token status** (`placeholderStatusFor`): `unrecognized` (not in `TOKEN_INFO`; prints blank), `org-constant`, `resolved`, `missing` (no value on this ticket). The send guard blocks on `missing` plus `unrecognized`: toast "Resolve {n} placeholder(s) before sending" / "Fill in the missing values first." The guard runs in the workspace and again in the mock `emails.send` (error "Resolve {n} placeholder(s) before sending: {CODES}. Nothing was sent."); a manual send ("Mark as sent outside the system") skips it; a demo switch (`ams:demo:allowUnresolvedSends`) bypasses it, and must be removed for production. The real server must keep that check.

Token facts a server-side renderer must reproduce:
- `LEAVE_START_DATE` has no ticket source (always missing on a ticket). `ASSET_CONDITION` exists only in the charging asset table.
- Multi-asset expansion: `ASSET_TABLE`, `ASSET_TABLE_QTY`, and any table row containing `ASSET_TAG` or `SERIAL_NUMBER` (one row per asset, quantity 1) or `ASSET_NAME` or `ASSET_QTY` (grouped by model) expand per **ticked** asset, unless the content contains `{{ASSET_CONDITION}}`, in which case `expandCaseAssetRows` prints the charging case's chosen items with their notes. a bare `{{ASSET_QTY}}` counts all assets, not only ticked ones (inside an expanded row it is 1, or the model count among ticked assets); in charging content `ASSET_NAME`, `ASSET_TAG` and `SERIAL_NUMBER` take the first case selected item. These rules operate on `<tr>` and `<br>` shapes of the HTML.
- When the equipment was not returned, the line `Date received: {{DATE_RECEIVED}}` is removed from charging content.
- `ATD_REFERENCE` falls back to `ATD-{created year}-{ticket number padded to 4}`. `ESCALATION_DEADLINE` is creation + 3 days for immediate resignation, else the Target Date. `EMPLOYEE_ID` has leading non-digits stripped. `DAYS_OVERDUE` exists only when overdue (minimum 1, from the local clock). `TM_FIRST_NAME` honors the case override. `NOTICE_DATE` is the ticket creation date. `DATE_OF_THIS_NOTICE` is today on the client clock. `ORIGINAL_TARGET_DATE` is the first re-baseline's previous date, else the current one.

## 7. Contracts between templates and tickets

The ticket module hard-codes these keys; a backend must keep them stable or turn them into data.

| Contract | Value |
|---|---|
| Notice template by reason and mode | t1 and t2 resignation, t3 and t4 immediate resignation, t5 and t6 end of contract, t9 and t10 recalled, t11 unexplained absence (remote) |
| Reminders | midpoint t12 and t13, final t14 and t15, overdue t16 and t17 (onsite, remote) |
| Courier endorsement | t18 |
| Return acknowledgment form | by **ticket mode**: `return-ack-onsite`, `return-ack-remote` |
| Charging | `no-charge` t22 (no form); `quotation-pending` t23 with `notice-assessment-quotation-pending`; `charge` t24 with `atd-loss-damage-non-return`; `settlement` t25 with `atd-settlement-transfer` |

- **The ticket does not read a template's `attachmentFormId`.** The form attached to a send comes from the ticket's mode (and from the charging outcome map), so the attachment set in the Templates editor is informational for the send flow. Pick a single source of truth.
- `templateForKey` reads the live runtime store, so Templates edits apply to the next send immediately (no published-version pinning) and the result does **not** check `status` (a retired or draft t1 still sends). Deleting a created template makes it return null; deleting a seed template only hides it (see section 2).
- A send is stored on the ticket as a `SentEmail` (rendered subject, `html`, `formHtml`, recipients, template key, form id, sender, `sentAt`, idempotency key and status), plus the history line and stage flags; repeating an idempotency key returns the earlier send. A real server must do the same and also store failed attempts.
- The form name appears as text in the charging history line; renaming a form later changes nothing.

## 8. Master Data

### 8.1 Index (`/master-data`)
Title "Master Data Configuration". Four cards: **Offboarding Checklists** (live) and three placeholders (Courier Providers, Policy Library, Asset Team Contact Block) that toast "{Title} isn't wired up yet" / "This card is a placeholder for a planned next iteration." A banner "Some values are awaiting Asset Team confirmation" lists three open items: the authoritative Asset Team mobile and landline numbers, the office barangay that differs between the form body and its letterhead, and the version and effective date of the International Asset Movement Policy. Asset Team contact data and couriers currently live as token constants and mock JSON, not in a master-data store.

### 8.2 Offboarding checklists (`/master-data/offboarding-checklists`)
- A list of templates (name, "N tasks", "M optional", up to two path chips and "+N more", or "No paths assigned"; the seed template's catch all `*` is hidden everywhere, so it reads "No paths assigned" and cannot be seen or removed in the editor) and an editor: Name; Tasks (reorder, edit text, toggle Required or Optional, remove, add with Enter or the Add button); "Starts every ticket for", a matrix of reason by mode checkboxes (only offered paths; unexplained absence has Remote only) with Check all and Uncheck all and a "(from {other template})" hint. Buttons: New, Duplicate, Delete, Discard, Save changes (enabled only when dirty).
- Copy: "Required tasks must be done before the checklist can be completed. Optional tasks never block it." / "A path uses one template. Choosing a path here takes it from the template that had it." Save toast "Template saved" / "New tickets use it from now on. Tickets already open keep their own checklist." Delete modal: `"{name}" is removed. Its paths move to the first remaining template. Tickets that already use it keep their own checklist.` with "Keep it" and "Delete template".
- A new checklist is named "New checklist" (then "New checklist 2" and so on); a duplicate is "{name} (copy)" (then "(copy 2)"). A failed delete shows a "Cannot delete" toast with the server error, and a failed save shows the banner "This template cannot be saved yet". Deleting an unknown id returns ok.
- Server rules (mock): tasks trimmed and blanks dropped; no tasks (create: "Add at least one task before saving a template."; update: "A template needs at least one task."); blank name ("Give the template a name."); name unique case-insensitively ("A template with this name already exists. Choose a different name."); unknown id ("That template no longer exists."); deleting the last template refused ("Keep at least one template. New tickets are issued from it."); deleting moves its paths to the first remaining template (not necessarily the `*` default); a path belongs to one template (saving claims paths from the others). New creates "New checklist" with one required task "First task"; Duplicate names "{name} (copy)" with no paths.
- Seed: one template, "Standard offboarding", four required tasks, applying to all paths.

## 9. Findings and corrections for the developer

1. **Delete and retire have no usage check** (section 2).
2. **No edit lock** on attached or used forms and templates (section 4.3).
3. **The ticket picks the form by ticket mode, not by the template's attachment** (section 7).
4. **Field answers and submissions are never persisted** (section 4.2); there is no submission model.
5. **Retired banner copy contradicts behavior** (section 3.2).
6. **Version history of forms cannot preview content** and its ids renumber after the cap (section 4.3).
7. **Stored times are UTC ISO strings** (`lastSavedAt`, `updatedAt`, version dates, shown in the viewer's zone), but the seed `lastSavedAt` is hard coded, `actor` is the hard coded `CURRENT_USER_NAME`, and one legacy t16 version date is a pre-formatted string. The server must own the timestamps and a user id.
8. **Whole-record `PUT`** carries the full content and all versions (up to 50 snapshots of the full body) after every store change (an 80 ms debounce, so keystrokes included), with last write wins. Consider version-append endpoints and a version check.
9. **Reads create rows:** `ensureTemplateRuntime(key)` creates runtime entries as a side effect of reading (list rendering and `templateForKey`). Against a real backend reads must not create rows.
10. **Uploaded signature images, file uploads and background images are data URLs or object URLs;** no upload endpoint is defined for forms (the background upload limit is 5 MB).
11. **The template editor's EML export and Outlook copy use sample values, not ticket data,** and omit recipients and attachments. The **ticket workspace** is different: its email preview "Download EML" and the closure modal's "Download EML" resolve this ticket's values, build inline styled HTML through the same `buildEmailExportHtml`, and write the file with the shared `downloadEmlFile` (in `utils/emailExportHtml.ts`). That helper strips line breaks from the subject so a placeholder value cannot add mail headers, and the template editor now uses it too. Still no recipients or attachments in the file.
12. **The form editor creates drafts on the client only,** because the forms store was shared across SSR requests; relevant if real SSR is used.
13. **Seed templates and their saved copies:** two migration helpers in the mock, `migrateChargingFormContent` (rewrites old saved charging forms) and `migrateTemplateSubject` (inserts the employee id into saved subjects), are prototype-only logic to delete with the mock.
