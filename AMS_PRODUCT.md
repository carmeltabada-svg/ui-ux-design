# PRODUCT.md: GoTeam Asset Management System (AMS)

> Updated 4 Oct 2026. This is the product document for the AMS **platform and its shared capabilities**:
> the app shell, the Templates area (email templates and forms), Master Data, the placeholder system,
> the design conventions and the prototype boundaries.
>
> **Not covered here, on purpose:** the Retrieval Ticket Module (FR-003): the Ticket Tracker, ticket
> creation and workspace, gate pass, post-retrieval charging, offboarding checklists and the
> retrieval-specific simulation tools. That module gets its own document (`retrieval-ticket-module/PRODUCT.md`
> is the earlier version) and will be folded in later. Where this document has to mention retrieval,
> it only says how the shared platform serves it.
>
> This supersedes `email-templates/PRODUCT.md` (Templates Builder only). Nothing from that document was
> dropped; its feature detail is carried into section 6.

---

## 1. Product summary

AMS is GoTeam's internal operations tool for the Asset Team. It holds the work around company equipment:
tracking it, moving it, retrieving it, charging for it, and communicating about it. This repository is a
**front-end-only prototype** (Nuxt 4, Nuxt UI v4, Tiptap v3, FormKit) built to work out interaction design,
Outlook export fidelity and document pagination before the real build. There is no backend, no
authentication and no real email sending.

Three parts of AMS are live in this prototype:

| Area | Route | Status |
|---|---|---|
| **Templates** (email and forms) | `/templates` | Built, the most complete area |
| **Master Data** | `/master-data` | Landing page built; most cards are placeholders |
| **Ticket Tracker** | `/ticket-tracker` | Built, documented separately (retrieval, out of scope here) |

The rest of the sidebar (Dashboard, Assets, Move Asset, Asset Removal, Locations, Suppliers, Asset Models,
Tech Packs, Purchase Orders, IT Workspace, Forms > Gate Pass, Clients, Team Members, Audits) is shown for
orientation and is not wired up.

## 2. Who uses it

- **Asset Team members**: the primary users. They author templates and forms, maintain master data,
  and run the operational work.
- **Template and form authors**: the same people in their authoring role. They are not technical and must
  never hand-edit HTML.
- **Recipients of forms**: team members and other staff who open a form link, fill it in, sign and submit.
  They are not AMS users in the usual sense; they see only the form.
- **Developers integrating the prototype**: they read `docs/DEV_HANDOFF.md`, `docs/QA_HANDOFF.md`.
  The prototype is built to be taken apart and ported.

There are no roles or permissions in the prototype. Every Asset Team member has equal edit access.
Whether that is acceptable is an open question (section 12).

## 3. The problem

The Asset Team sends high-stakes, repeated communications and collects signed forms, and until now both
were static, hand-edited HTML or paper-adjacent documents:

- No live preview. A broken email could go to a departing employee.
- No guarantee an email survives Outlook. Word's HTML engine silently drops or distorts modern CSS.
- No structured way to build a fillable, paginated, versioned form that prints the way it looks.
- Values such as names, dates, addresses and company details were typed by hand into each message,
  so one wrong value meant a wrong message.
- No history. A change to a template or form left no record of what changed, who changed it and when.

This affects every author on every send. It is not an edge case.

## 4. Goals

1. Give non-technical authors a real in-browser editor for both emails and forms.
2. Guarantee Outlook and Word rendering fidelity for every exported email.
3. Support a structured, paginated form document with typed fields, autosave and an auditable version history.
4. Make every value that changes per message a **placeholder** resolved from one source, so nothing is retyped.
5. Hold company-wide facts once (Master Data) and reference them everywhere.
6. Keep every AMS section inside one shell and one design language, so a new section feels like the same product.

## 5. Non-goals (this version)

- **Backend, auth, persistence.** State is in memory and mirrored to `localStorage`. Deferred to the real integration.
- **Real email sending.** "Export to Outlook" produces client-safe HTML to copy or download. Delivery is a separate feature on another tab of the real app.
- **One shared editor for both builders.** Email and forms use separate Tiptap extension sets and separate pagination libraries, because their content models differ (a flowing body versus a paginated, field-driven document).
- **Users, roles, permissions.** Anything that looks like "assigned to", "submitted by" or a recipient list reads from a static fixture (`app/data/teamMembers.ts`).
- **Defeating a recipient's own Outlook paste setting.** "Merge Formatting" versus "Keep Source Formatting" is a client preference; the export hedges for both and cannot force one.
- **Dark mode.** Light only. The `colorMode` override was removed from `nuxt.config.ts` (light is the preference) and the top bar's dark toggle only shows a "not available" toast.
- **FormKit Pro inputs.** Core inputs only. No `@formkit/pro` and no Pro key.
- **Mobile and tablet.** Desktop-oriented internal tool, not designed for small breakpoints.

## 6. Features

### 6.1 App shell

- **Sidebar** (`app/components/email/AmsSidebar.vue`): a port of the real design-system Sidebar, 240px wide, `NAV_ITEMS` verbatim. Entries without a `to` are placeholders. Active highlighting falls back to the route prefix. The Forms group expands to Gate Pass (placeholder). The Ticket Tracker entry carries a live count of tickets needing attention.
- **Top navbar** (`TopNavbar.vue`): breadcrumb (Home > section), collapse and expand of the sidebar, a notification bell, a dark mode button (unavailable, see non-goals) and a link to the internal dashboard.
- **Simulation Control** (flask icon in the top bar): a demo-only panel, clearly separated from the real controls. It exists because there is no backend. It lets a reviewer push a simulated employee record update, switch the acting user (Act as), clear all tickets, and bypass the unresolved-placeholder send guard. Its retrieval-specific settings are described in the retrieval document.
- **Layouts**: `default` (sidebar plus top bar) and `blank` (full bleed, for print and preview pages).
- **Persistence plugins**: `formStorage.client.ts` and `ticketStorage.client.ts` mirror reactive stores to `localStorage`.
  Saved copies shadow later source edits (see section 11).

### 6.2 Templates directory (`/templates`)

One list-cards page with two tabs, **Email** and **Forms**, because both are the same kind of record: named,
described, tagged, status-tracked and versioned content referenced elsewhere in the system.

- **Search** across name and description.
- **Filters**: status (All, Active, Draft, Retired) and, for email, mode (All modes, Onsite, Remote). The chosen filter option shows in blue with a blue check.
- **Pagination**: 7 rows per page for email; the page clamps when a filter shrinks the list.
- **Status lifecycle**: `draft`, `active`, `retired`.
  - Draft and retired rows carry a small status dot on the row icon so the state reads without opening the badge. Active is the expected default and stays clean.
  - **Retire** and **Reactivate** are single actions with a toast. Retired templates stay in the list and reachable.
  - **Bulk retire** (email): multi-select with a batch action.
  - **Delete** goes through a real confirm modal (the browser's native confirm is not used) and removes the record from the reactive store so it does not reappear from a saved snapshot.
- **Create** (email): "Start from blank" or "Start from an existing template". Both copy through the same mechanism as a row's **Duplicate**: a fresh id, forced to draft, name suffixed "(copy)".
- **Row actions** (Edit, Duplicate, more menu) appear on hover and stay visible while their own menu is open, because the menu is teleported out of the row.
- **Mode tag**: every email carries Onsite or Remote, shown with the shared `ModeBadge`.
- Forms support create draft, duplicate and delete in the same way.

**Seeded library.** The prototype ships with a library of email templates and one real form, grouped
Resignation, End of Contract, Recalled, Unexplained Absence, Reminders and Overdue, Courier, and
Post-Retrieval Charging, plus the post-retrieval charging forms. These exist for the retrieval flow;
how they are chosen and sent from a ticket belongs to the retrieval document. The Templates area itself
treats them as ordinary records.

### 6.3 Email template editor (`/templates/email/[id]/edit`)

- **Header**: back link, inline-editable name and description (hover pencil, confirm and cancel), status badge, autosave indicator, "more actions" menu.
- **Subject** (`SubjectField`) and **Body** (`BodyField`, Tiptap v3 over ProseMirror).
- **Body content types**: text formatting, headings, lists, tables, image, button link, callout, message banner, quote command.
- **Context-aware toolbar** (`BlockToolbar.vue`): the same align left, center and right buttons act on plain text, a selected image or a selected button. There is deliberately **no separate "align image" control**; this was an explicit correction.
- **Images**: click-selectable, drag-reorderable. A role of Header or Footer makes the image a full-width banner with no padding, auto-positioned at the true top or bottom, cropped by pixel to 640x140 or 640x100 (never by CSS, which Outlook ignores). The original image is kept so switching roles never re-crops. A recommended-size hint shows in the insert popover. No safety paragraph is added after a Footer image.
- **Button links**: store their target as `data-href`, not a live `href`, so they stay selectable in the editor without navigating. The real `href` is created only on export.
- **Tables**: size picker, controls, header styling with a WCAG-checked colour palette with real variety.
- **Background colour** and **Footer note** (optional) for the whole email.
- **Recipients** (`RecipientsSection`, `RecipientsSummary`): To, CC and BCC as chips; read-only summary variant.
- **Attachments** (`AttachSection`): the attached form shown as a chip with Placeholder Check, Preview, Edit and a Replace or Remove menu; read-only mode shows Preview only. Delivery text: "Online form via link".
- **Placeholder drawer** (`PlaceholderDrawer`): browse the whole token library by group and insert tokens (section 7).
- **Preview**: live `PreviewPane` plus a full-size modal (`FullPreviewModal`).
- **History tab** (`HistoryTab`, shared `AlignedTabs`): saved versions with who, when and a label.
- **Retired banner**: a retired template shows a banner using the shared Banner component.
- **Export** (6.5): copy for Outlook and download.

### 6.4 Form builder (`/templates/forms/[id]/edit`)

- **Document canvas** (`FormDocumentEditor.vue`): a paginated Tiptap document. On-screen pagination uses `tiptap-pagination-plus`, which is a CSS illusion and only approximates "what page am I on".
- **Field types** (Add field menu): Short text, Paragraph, Number, Checkbox, File upload, Required signature box, Text Block, Button link. Fields are custom Tiptap nodes backed by FormKit inputs, rendered in place.
- **Properties panel** (`FormFieldPropertiesPanel`): label, hint, type, required.
- **Document styling**: toolbar, theme colour swatches, background picker (`vue3-colorpicker`), letterhead.
- **Autosave** of drafts to the in-memory store, mirrored to `localStorage`.
- **Version history with diff**: `FormHistoryTab`, `FormVersionPreviewModal`, `versionDiff.ts` (microdiff). The history tabs are generic over entry type, so email and form histories share one implementation.
- **Content migration**: forms were first a typed sections-and-fields model, now a document. `formContentMigration.ts` converts the old model once, on first open, and never again for that form. A stored value that does not fit a changed field type is not silently coerced.
- **Saved copies**: a saved form wins over source edits. Render-time transforms reach saved content; edits to the seed HTML do not. Changes to seed content need an idempotent migration (the post-retrieval charging forms use `migrateChargingFormContent`, applied from `formStorage.ts`).

### 6.5 Outlook export pipeline

`buildEmailExportHtml()` (`app/utils/emailExportHtml.ts`) walks the document a **second time**, independent
of the editor's own render, and rebuilds it for Word's engine:

- Nested tables with inline styles.
- `mergeStyle()` merges defaults into existing inline style (existing wins) instead of overwriting. Overwriting was the root cause of vanishing banner fills and table header colours.
- Character-run colour, size and highlight wrapped in legacy `<font>` tags plus `mso-highlight`, for Word's Merge Formatting paste mode.
- Buttons rebuilt as bulletproof tables (`width="1"` cell, `white-space:nowrap`, `mso-padding-alt`).
- Empty trailing rows dropped (`isBlankContent()`); long cell content wrapped in real table structure.
- All font stacks are exactly `Inter, sans-serif`. Clients without Inter fall back to the generic sans-serif; this is part of the specification.

Rule: a CSS property that works in the editor is not assumed to survive export. Check the exporter first.

### 6.6 Recipient fill, submit and print

- `/form-preview` renders the form. Opened from a link it is a fill form; once submitted it is read-only with a simulated "emailed copy" notice.
- E-signature is a drawn image from `SignaturePad.vue`. It is not a certified signature (no timestamp, IP or identity check).
- Print and PDF use `pagedjs` (`Previewer`) through `window.print`, which is more print-accurate than the on-screen pagination. Print is forced to a white page, and cells carry explicit borders so the shared print stylesheet cannot box every cell.
- A form opened from the editors shows sample data; a form opened for a specific record shows that record's values, and an unresolved placeholder shows as its raw `{{TOKEN}}`.

### 6.7 Master Data (`/master-data`)

"Master Data Configuration": values held once and referenced everywhere, so a change is made in one place.

| Card | Purpose | State |
|---|---|---|
| Courier Providers | Corporate account details and the branch directory | Placeholder (toast) |
| Policy Library | Versioned governing policies, so the accountability form serves the current version without a form change | Placeholder |
| Asset Team Contact Block | One record referenced by every template, form and generated document | Placeholder; its values live today as fixed company constants in code |
| Offboarding Checklists | Retrieval-specific | Built; belongs to the retrieval document |

Email templates and forms are not under Master Data; they moved to Templates because they are twins of each other.

## 7. The placeholder system

A placeholder is a `{{TOKEN}}` in a subject, body or form that is replaced when the message or document is built. This
is the mechanism that stops values being retyped.

- **Library**: `TOKEN_GROUPS` in `app/data/templates.ts`, 66 tokens in the groups Custodian, Ticket, Dates, Assets, Courier, Asset Team, Links and Post-Retrieval Charging. A `code to name` lookup is derived from it.
- **Where values come from** (three kinds):
  1. **From a record**, nothing to type (the team member, the dates, the assets).
  2. **Typed by an officer** in a step of the work that needs it.
  3. **Fixed company details**, `ORG_CONSTANT_TOKENS`, edited in code until the Asset Team Contact Block exists.
- **No generic sample data in record-scoped previews.** An unresolved token shows as its raw `{{TOKEN}}`. Sample data appears only when opened from the editors.
- **Placeholder Check** (drawer): lists every token in the template, whether it is filled, missing or unrecognized, and highlights each in the preview on click. Missing tokens highlight orange; copy is plain: "This ticket has no value for it yet, so the placeholder stays as is."; an unrecognized token "prints blank".
- **Send guardrail**: a send to a team member is blocked while any attached email or form has missing or unrecognized placeholders. The demo bypass (Simulation Control) lets it through with an info toast.
- **Tokens inside links**: a token in a button's `data-href`, a link's `href` or link text resolves in a single pass and the whole button or link highlights.
- **Repeating rows**: a table row holding an asset token repeats once per asset; the integrity rule is that a row is built from one record and a token never holds several values.
- **Open**: a Placeholder Reference page in Master Data is recommended and not built; authors cannot create their own tokens (explicitly out of scope).

## 8. Shared components and utilities

`shared/Banner` (one banner style: tone, title, icon, slots), `shared/DatePicker` (string `YYYY-MM-DD` in and out,
`min`, `max`), `shared/OverrideNote`, `shared/StatusBadge`, `shared/AutosaveIndicator`, `shared/AlignedTabs`,
`email/ModeBadge`, `AttachPicker`, `RecipientChip`, `FileAttachChip`, `SentBanner`, `TemplateMenu`.
Utilities: `emailExportHtml`, `tiptapExtensions`, `versionDiff`, `formPrintStyles`, `formFieldNode`, `formStorage`,
`formContentMigration`, `demoSettings`.

## 9. Design conventions (standing rules)

Also in `DESIGN_SYSTEM.md` and the `ams_design_conventions` memory.

- **Font**: `Inter, sans-serif` only, everywhere including print, PDF and exported email. No monospace, no `<code>`, no font switching.
- **Status colours use the 600 shade**: green-600 `#00A155` success, orange-600 `#ea580c` warning. Active status `rgb(0,127,69)`, retired `rgb(137,75,0)`, draft `#64748b` on white with `#cbd5e1` border.
- **Labels**: 12px uppercase `text-dimmed`, always on their own line above the value. Right panel labels 10px. Values 14px medium, `text-default`. Inputs and dropdowns `size="md"`.
- **Spacing**: 24px between field groups; helper text stays about 8px from the thing it describes; label to plain text 2px; label to input 6px.
- **Banners**: one banner style (`SharedBanner`): white surface, 200-shade border, 4px 600-shade left accent with square left corners. One banner per record, never stacked.
- **Selection cards**: content vertically centered, `py-2.5 px-4`, 16px icons, 14px title, 12px description.
- **Dropdown selected item**: blue label with a blue check.
- **One primary action per state**; fallbacks are quiet text links; no disabled primary that cannot be used yet.
- **Copy**: no dashes in descriptions, no "+" symbols, no template or form code names (such as T24, F1) in anything a team member sees. Date and time on one line, centre-dot separated.
- **No mention of "HRIS" or "R24"** anywhere the user can see.
- **Accessibility**: WCAG 2.2 AA is the bar. `text-muted` instead of `text-dimmed` where contrast matters; required marked in words; status lines with icons; `role="status"` or `"alert"` on banners; focus rings only on keyboard focus (`has-[:focus-visible]`).
- **Motion**: subtle fade and rise on stage change, banner enter and icon pop; all off under reduced motion.
- **Pills** are `text-xs px-1.5 py-0.5 rounded-full` (built as dedicated components, not `UBadge`).
- **Hover-revealed settings** on a canvas node: a bordered ghost icon button, visible on hover, forced visible while its popover is open.
- **Tokens** that must survive print capture are pinned to hex, because `oklch()` cannot be parsed by DOM-cloning tools.

## 10. Requirements summary

**Must have (built):** email body editor, context-aware toolbar, selectable and draggable image with header and
footer roles, selectable button link, Outlook export pipeline, form document builder, recipient fill, submit and
print, status lifecycle and directory, version history with diff, placeholder library with Placeholder Check and
send guardrail, shared shell and design conventions.

**Nice to have (built):** recommended-size hints, brief popover copy, WCAG-checked table palette, fade-scroll on
overflowing panels, duplicate and start-from-existing, bulk retire.

**Deferred:** backend, auth, roles and permissions, real sending, real e-signature, Master Data cards (Courier
Providers, Policy Library, Asset Team Contact Block), Placeholder Reference page, a shared editor core, dark mode,
mobile layouts, FormKit Pro inputs.

## 11. Technical notes and known limitations

- **Stack**: Nuxt 4, Nuxt UI v4 (Reka UI, Tailwind 4, CSS-first config in `app/assets/css/main.css`), Tiptap 3.31.2 (pinned), `tiptap-pagination-plus`, `pagedjs`, FormKit core, `vue3-colorpicker`, `microdiff`, Playwright, Lucide icons only.
- **Typecheck** is `npx nuxi typecheck` and reports 0 errors.
- **`localStorage` is per origin**, so a different port is a different, empty store. Saved copies shadow source edits.
- **Two pagination systems** that are not interchangeable: the on-screen one is approximate; `pagedjs` is the print source of truth. Neither has been proven against a physical printout.
- **E-signature is a drawn image**, not legally binding.
- **No concurrent editing awareness**, no rate limiting, no input sanitisation boundary beyond Vue and Nuxt defaults.
- **Outlook ceilings**: Merge Formatting cannot be detected or overridden; Word does not support `object-fit`, shorthand `background` or modern layout.
- **Vue gotcha**: an auto-imported ref used in a template is already unwrapped, so `v-model` on it fails; alias it to a local const first.
- Developer docs: `docs/DEV_HANDOFF.md` (traps, scope, packages, checklist), `docs/QA_HANDOFF.md`, `docs/DATA_EXPORT_GUIDE.md`, `docs/HANDOFF_TICKET.md`.

## 12. Open questions

1. **Persistence contract.** Should the export HTML go straight to a mail API, or does an existing service own sending?
2. **Permissions.** Is there a real requirement for role-gated template editing, or does every Asset Team member keep equal access? There is no auth in the prototype, and no version history of who may edit.
3. **One editor or two.** Should email and forms ever share an editor core? Worth deciding before a third builder type.
4. **Asset Team Contact Block.** Fixed company details live in code today. Who owns them, and does the block become the editable source?
5. **Courier Providers and Policy Library.** Real data sources and owners are undecided; both are placeholders.
6. **Global label contrast.** `text-dimmed` (gray-400) is below 4.5:1 and is the standing label colour across the app. A one-line token change fixes it everywhere but darkens every label. Unanswered.
7. **Codes in descriptions.** Some template and form descriptions still end in a code such as "(F1)", against the convention. Offered to strip; unanswered.
8. **Printed and PDF output** has not been visually rechecked since the font change to Inter.
9. **Plain-link insertion** in the email editor with a `{{TOKEN}}` href has only been verified through the pipeline, not through the link dialog.
10. **Dark mode** is untested since the colour-mode override was removed.

## 13. Success measures

The prototype has no analytics. The practical signal, round over round, is whether each piece of reported feedback
(Outlook fidelity, alignment, drag and drop, contrast, copy) was verified fixed live in a real browser and a real
Outlook paste, not only in code.

## 14. Timeline

No external deadline. Work was iterated against direct designer feedback. The real constraint is the backend and
authentication integration scoped in `docs/DEV_HANDOFF.md`, which is not estimated here.

## 15. To fold in later

The Retrieval Ticket Module (FR-003) will be added as its own section or a linked document: reasons and modes
and the path table, ticket creation and workspace, stages and statuses, communications and send flow, courier and
shipping, gate pass, post-retrieval charging, closure and the team member's record, offboarding checklists,
activity log and audit trail, and the retrieval simulation tools. Its current state is in
`retrieval-ticket-module/SESSION_HANDOFF.md`.
