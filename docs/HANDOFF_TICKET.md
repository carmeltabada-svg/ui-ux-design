# [AMS Retrieval Module] – Production Integration

*(The Atlassian connector is not authorized in this session, so nothing was filed.
Paste this into the real ticket as-is. It is one Epic covering the whole module, as decided;
the phases below map to Stories if the team wants to split it.)*

## Summary
Deliver a production-ready Retrieval Module for the GoTeam AMS — covering
email templates, retrieval forms/documents, retrieval ticket tracking,
offboarding checklists, and master data configuration — so the Asset Team
can digitally manage the full employee retrieval lifecycle.

## Rationale
The Asset Team currently has no unified system for managing employee
retrievals. Officers coordinate through spreadsheets, ad-hoc emails, and
manual tracking — leading to missed retrievals, inconsistent communications,
no audit trail, and no measurable process for charging unreturned assets.
A front-end prototype has validated the core interaction patterns; what
remains is production delivery with a real backend, database, and
authentication layer.

## Scope
**In:**
- Port the Tiptap-based email body editor and its Outlook-export pipeline
  (`app/utils/emailExportHtml.ts`)
- Port the Tiptap-based retrieval-forms document editor, its FormKit-backed
  field system, and its `pagedjs` print/PDF preview
- Replace `app/data/*.ts` reactive/localStorage stores with real API-backed
  persistence
- Add real authentication and a real recipient/team-member directory
- Deliver the ticket tracker (list, create, workspace with its 52 actions) and the offboarding
  checklists on the real backend, replacing `app/api/mock.ts` and `app/api/ticketActions.ts`
  with the server and running `app/api/http.ts` against it (see
  [BACKEND_SWAP.md](./BACKEND_SWAP.md) and [DATA_CONTRACT.md](./DATA_CONTRACT.md))
- Keep the text and spacing standard in the ported screens (Dev Doc §6.6)

**Out** (see Dev Doc §4 for full detail):
- **Real SMS sending, and delivery from the Templates builders, are not part of
  this ticket.** Sending the Ticket Tracker's stage emails is in scope for the
  developer: the front end and mock are built behind one send operation,
  `api().emails.send` (INTEGRATIONS.md section 1). SMS stays copy and confirm.
- A live employee-record (HRIS) connection, and real email, SMS or digest delivery,
  are separate work.
- E-signature legal certification, a phone-ready editor layout, and any
  FormKit Pro input are also explicitly not part of this port — scope
  separately if needed.

## Acceptance Criteria
*(Dev Doc §10, pasted verbatim — this prototype is front-end-only; every
item below is real, from-scratch full-stack work, not a config change)*

**Backend & API**
- [ ] Stand up a backend framework/runtime (none exists in this repo)
- [ ] Design API surface: CRUD for email templates, retrieval forms, form
      submissions, form version history
- [ ] Design/implement server-side versioning/history API
- [ ] Implement server-side validation for every form-field type (client
      FormKit validation alone is not sufficient in production)
- [ ] Sanitize all rich-text/HTML content from the Tiptap editors before
      storage/render
- [ ] Add rate limiting and standard API hardening

**Database & persistence**
- [ ] Design a real schema (templates, form fields, submissions, version
      history, users) based on `app/data/*.ts`'s current shape
- [ ] Replace all reactive-store reads/writes with real API calls
- [ ] Replace `localStorage` mirroring with server-persisted state
- [ ] Implement real file storage for uploads and captured signatures

**Auth & authorization**
- [ ] Add real authentication (none exists)
- [ ] Replace the static `teamMembers.ts` fixture with a real directory
- [ ] Design/implement roles/permissions and ownership checks on every
      endpoint

**Email sending: in scope for the Ticket Tracker, out of scope for the Templates builders**
(build the server side of `emails.send`, see INTEGRATIONS.md section 1; the builders only
hand over finished content)
- [ ] Define the data hand-off contract only: exported Outlook-safe HTML for
      email templates, submitted form values for retrieval forms
- [ ] Leave `RecipientsSection.vue` / the forms "emailed copy" notice as
      authoring/preview affordances, not real send triggers
- [ ] Re-verify Outlook export **HTML** fidelity against real Outlook
      clients (markup correctness only, independent of who eventually sends
      it)

**E-signature & compliance**
- [ ] Get a legal/compliance decision on signature certification
      requirements before treating `SignaturePad.vue` as production-ready

**Print/PDF**
- [ ] Independently spot-check real OS print-to-PDF output
- [ ] Decide whether server-side PDF generation is also required

**Front-end porting**
- [ ] Port the Tiptap email-body editor + extensions
- [ ] Port the Tiptap retrieval-forms editor + FormKit field system
- [ ] Port the Outlook export pipeline (`emailExportHtml.ts`) — encodes
      hard-won compatibility knowledge, don't rewrite blind
- [ ] Port the print/PDF preview + pagedjs wiring
- [ ] Reconcile this prototype's theming with the real app's design system,
      if one already exists
- [ ] Scope `@formkit/pro` + license cost if any Pro input is requested
- [ ] Dark mode is built; scope mobile support as separate design work if required

**Testing & rollout**
- [ ] Run `tests/e2e/` (Playwright) and `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json` clean
- [ ] Add real backend/API tests (none exist today)
- [ ] Load-test and security-review before production rollout

**Ticket tracker, master data and data layer**
- [ ] Replace `api/mock.ts` and `api/ticketActions.ts` with the real backend; keep `api/types.ts`, `keys.ts` and `mappers.ts`
- [ ] Run `app/api/http.ts` against the real server and correct its paths and envelopes
- [ ] Serialize ticket actions per ticket, or add a version check
- [ ] Confirm the ten default assumptions in DATA_CONTRACT section 10
- [ ] Move the alert scan and the digest to the server
- [ ] Replace browser object-URL files with multipart upload
- [ ] Delete the demo-only code (Dev Doc §12)
- [ ] Keep the text and spacing standard when porting
- [ ] Run `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json`, `npx nuxt build` and `tests/e2e/ticket-smoke.spec.ts` clean

Full detail and rationale for each item: [Dev Doc §10](./DEV_HANDOFF.md#10-implementation-checklist).

## Known Traps (top 3)
1. **[Data layer]** The stage rules for the 52 ticket actions live in
   `api/ticketActions.ts`, which is mock-server code. The server must own them;
   do not re-add page-side writes of ticket fields, history or notifications.
2. **[Data layer]** Ticket actions are not serialized per ticket. In http mode two
   quick actions can overwrite each other; serialize or send a version (ETag).
3. **[All]** `npx vue-tsc --noEmit -p .` checks nothing. Use
   `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json`.

Full list: [Dev Doc §3](./DEV_HANDOFF.md#3-known-traps).

## Out of Scope (top 3)
1. **[All]** Real SMS and notification delivery are not built here. Real email sending
   from the Ticket Tracker is the developer's work behind the existing send operation
   (INTEGRATIONS.md section 1).
2. **[Ticket Tracker, Data layer]** No live employee-record (HRIS) connection;
   the directory is a fixture and the timed jobs run in the browser today.
3. **[All]** No auth, roles or real recipient directory, and no FormKit Pro inputs.

Full list: [Dev Doc §4](./DEV_HANDOFF.md#4-out-of-scope).

## Implementation Phases

This work is phased to manage dependencies and allow parallel streams.
Full breakdown: [Implementation Phases](./IMPLEMENTATION_PHASES.md).

| Phase | Focus | Depends on |
|---|---|---|
| **0 — Foundation** | Backend API, database schema, auth | Nothing |
| **1 — Templates Builder** | Email editor + Outlook export, forms editor + FormKit fields, version history, print/PDF | Phase 0 |
| **2 — Master Data** | Retrieval paths, offboarding checklists, config screens | Phase 0 |
| **3 — Ticket Tracker** | List/create/detail, communications/send, logistics, closure | Phases 1 + 2 |
| **4 — Integration** | Theming, data contracts, testing, security, rollout | Phase 3 |

Phases 1 and 2 can run in parallel with different developers.

## References
- [Product Requirements Document (PRD)](./PRD.md)
- [Implementation Phases](./IMPLEMENTATION_PHASES.md)
- [Dev Documentation](./DEV_HANDOFF.md)
- [QA Documentation](./QA_HANDOFF.md)
- [Data Contract](./DATA_CONTRACT.md) and [Backend Swap](./BACKEND_SWAP.md)
- [Token Data Mapping](./TOKEN_DATA_MAPPING.html): the 66 placeholders, which come from production (14), which this module creates (37) and which are still open (15)
- [User Guide](./USER_GUIDE.html) (interactive, one page per role) and [Handoff walkthrough](./HANDOFF_WALKTHROUGH.md)
- PRD requirements fulfilled: the Must-Have list in the PRD (backend, database, auth, front end porting, testing); the prototype fulfils the front end behavior only
- Live prototype: https://ams-retrieval-demo.netlify.app (a static build of `main`)
- Source code: https://github.com/carmeltabada-svg/ui-ux-design (`main` is the source of truth; `retrieval` and `templates` are kept as backups)
- Prior session notes (background only, not required reading):
  [archive/HANDOFF.md](./archive/HANDOFF.md),
  [archive/HANDOFF_SUMMARY.md](./archive/HANDOFF_SUMMARY.md),
  [archive/PAGINATION_TOOLKIT_STUDY.md](./archive/PAGINATION_TOOLKIT_STUDY.md),
  [archive/SESSION_SUMMARY.md](./archive/SESSION_SUMMARY.md)
