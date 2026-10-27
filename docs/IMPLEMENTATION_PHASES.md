# Implementation Phases — AMS Retrieval Module

**Last updated:** 2026-10-12
**Companion docs:** [PRD](./PRD.md) · [Dev Documentation](./DEV_HANDOFF.md) · [QA Documentation](./QA_HANDOFF.md)

---

## Dependency Map

```
Phase 0 (Foundation)
  ├── Backend/API       ──┐
  ├── Database/Schema   ──┼── all later phases depend on these
  └── Auth/Permissions  ──┘
         │
Phase 1 (Templates)          Phase 2 (Master Data)
  ├── Email builder            ├── Retrieval paths
  ├── Forms builder            ├── Offboarding checklists
  └── Versioning + PDF         └── Courier providers
         │                     │
         └──── both feed ──────┘
                    │
              Phase 3 (Ticket Tracker)
                ├── List / create / detail
                └── Comms / logistics / closure
                    │
              Phase 4 (Integration)
                ├── Theming reconciliation
                ├── Data hand-off contracts
                └── Testing / security / rollout
```

**Phases 1 and 2 can run in parallel** with different developers.
Phase 3 depends on both because tickets reference templates (for communications) and master data (for paths/checklists).
Phase 4 is cross-cutting and runs last.

---

## Phase 0 — Foundation

**Goal:** Deliver working API endpoints, a real database, and authentication. No front-end porting happens until this phase is complete.

**Why this is first:** The prototype has zero server-side code — no `server/` directory, no API routes, no database, no auth. Everything else is front-end porting work that needs API endpoints to call.

### Scope

**Backend framework and API skeleton**
- Choose and stand up a backend framework/runtime
- Design API surface: CRUD for email templates, retrieval forms, form submissions, retrieval tickets, form version history, master data entities
- Implement input sanitization for all rich-text/HTML content from Tiptap editors (XSS boundary does not exist)
- Add rate limiting, CORS, and standard API hardening
- *Reference: Dev Doc §10.1*

**Database schema and persistence layer**
- Design schema for: templates, form fields, submissions, version history, tickets (status/lifecycle/history), master data (paths, checklists, courier providers), users
- Authoritative reference for data shape: `app/data/retrievalForms.ts`, `app/data/templateRuntime.ts`, `app/data/templates.ts`
- Implement file storage for uploads and captured signatures (currently in-memory/data-URL only)
- *Reference: Dev Doc §10.2*

**Authentication and authorization**
- Add real authentication (no login flow exists)
- Replace static `app/data/teamMembers.ts` fixture with real directory
- Design roles/permissions: who can create/edit templates, who can view/fill/submit forms, who can manage tickets, who can view submission history
- Session/ownership checks on every endpoint
- *Reference: Dev Doc §10.3*

### Key Decision (blocking)

| Decision | Options | Who decides |
|---|---|---|
| Backend framework | Nuxt server routes (`server/api/`), separate Node/Express service, integrate with existing GoTeam backend | Dev Lead |
| Database engine | PostgreSQL, MySQL, existing GoTeam database | Dev Lead |
| Auth provider | SSO with GoTeam auth, LDAP, standalone JWT | Dev Lead + PM |

### Exit Criteria
- [ ] API endpoints respond to CRUD operations for all entities
- [ ] Database schema is deployed and seeded with test data
- [ ] A user can log in, and unauthenticated requests are rejected
- [ ] API tests cover the happy path for each entity

---

## Phase 1 — Templates Builder

**Goal:** Port the email template builder and retrieval forms builder to production, backed by real persistence.

**Why this is Phase 1:** These are the most complex front-end components (two separate Tiptap editor instances with custom extensions, FormKit integration, Outlook export pipeline, print/PDF pipeline) and the most independent from the ticket tracker. Getting them working first de-risks the hardest porting work.

### Scope

**Email template builder — editor and export pipeline**
- Port the Tiptap email-body editor and custom extensions (`tiptapExtensions.ts`: EmailImage, ButtonLink, Callout, MessageBanner, QuoteCommand, TableHeaderStyled, FontSize, EmailTrailingNode)
- Port the context-aware toolbar (`BlockToolbar.vue`)
- Port the Outlook export pipeline (`emailExportHtml.ts`) as-is — do not rewrite blind; it encodes hard-won compatibility knowledge
- Replace template reactive-store reads/writes with real API calls
- Wire template list/create/edit/preview views to backend persistence
- Re-verify Outlook export HTML fidelity against real Outlook clients (desktop + web)
- *Reference: Dev Doc §6.1, §10.7*

**Retrieval forms builder — document editor and field system**
- Port the Tiptap document editor (`FormDocumentEditor.vue`) with `tiptap-pagination-plus` for on-screen pagination
- Port custom form-field node system (`formFieldNode.ts`, `FormFieldNodeView.vue`) with FormKit inputs (text, number, checkbox, file, signature)
- Port field properties panel (`FormFieldPropertiesPanel.vue`)
- Port background/theme pickers
- Replace form reactive-store reads/writes with real API calls
- Implement server-side validation for every form-field type
- *Reference: Dev Doc §6.2, §10.7*

**Version history and print/PDF**
- Port version history (`FormHistoryTab.vue`, `versionDiff.ts` using `microdiff`)
- Design/implement server-side versioning API — decide full-document snapshots vs. field-level diffs
- Port print/PDF preview page (`form-preview.vue`) and pagedjs wiring
- Spot-check real OS print-to-PDF output
- *Reference: Dev Doc §10.6*

### Known Traps (read before starting)

1. **ButtonLink's `data-href`** — editor anchor intentionally has no live `href` to prevent in-editor navigation. Export HTML re-adds real `href`. Don't "fix" this. *(Dev Doc §3.2 item 3)*
2. **Image/button auto-move-to-edge** — must insert before stripping empty paragraphs, or infinite-loop tab hang. *(Dev Doc §3.2 item 4)*
3. **Image sizing** — must use canvas pixel crop (`cropImageToAspect()`), not CSS `object-fit`. Outlook ignores `object-fit`. *(Dev Doc §3.2 item 7)*
4. **Two separate Tiptap instances** — email and forms builders use separate extension sets and pagination strategies. Do not merge them. *(Dev Doc §1, §4)*
5. **`tiptap-pagination-plus` is NOT the print engine** — it provides on-screen editing pagination only (CSS illusion). `pagedjs` is the print/PDF engine. *(Dev Doc §8.5)*

### Key Decision

| Decision | Options | Who decides |
|---|---|---|
| Server-side PDF generation needed? | Client-side `window.print()` only, or also server-side (for email attachments, archival) | Dev Lead + PM |

### Exit Criteria
- [ ] A user can create, edit, save, and retrieve an email template via the API
- [ ] A user can create, edit, save, and retrieve a retrieval form via the API
- [ ] Outlook export produces valid HTML that renders in Outlook desktop and web
- [ ] Form fields validate on both client and server
- [ ] Version history shows diffs between saved versions from the database
- [ ] Print/PDF preview renders with correct pagination

---

## Phase 2 — Master Data

**Goal:** Port the Master Data configuration screens so that templates and tickets reference centrally managed values.

**Why this is Phase 2 (parallel with Phase 1):** Master data is simpler to port (mostly CRUD config screens) and can be done by a different developer simultaneously. It must be in place before Phase 3 because tickets reference retrieval paths and offboarding checklists.

### Scope

- Port the Master Data landing page (four cards, only Offboarding Checklists is wired; the others toast "isn't wired up yet")
- Build Retrieval Paths configuration (not built: paths are defined in code, in the reason by mode matrix in `ticketTrackers.ts`)
- Port Offboarding Checklists (checklist management with check all/uncheck all, template-to-path assignments, path assignment badges, empty states)
- Build Courier Providers configuration (not built: couriers and branches are fixtures in `app/mocks`)
- Wire all master data entities to backend persistence
- *Reference: Dev Doc §10.7, AMS_PRODUCT.md Master Data section*

### Exit Criteria
- [ ] Retrieval paths can be created, edited, and deleted via the UI and API
- [ ] Offboarding checklists can be managed and assigned to paths
- [ ] Changes to master data values propagate to templates and tickets that reference them
- [ ] Courier providers can be managed via the UI and API

---

## Phase 3 — Retrieval Ticket Tracker

**Goal:** Port the ticket tracker module, connecting it to the templates (Phase 1) and master data (Phase 2) already in place.

**Why this is Phase 3:** Tickets are the orchestrating layer — they reference templates (to send communications), master data (for paths and checklists), and forms (for closure). Both must be working first.

### Scope

**Core views**
- Port ticket list view with filtering, status badges, sidebar count
- Port ticket create flow with departure reason and retrieval mode selection
- Port ticket detail view: status lifecycle, assigned assets, communications history, activity log
- Wire ticket CRUD to backend persistence with status lifecycle management

**Communications, logistics, closure**
- Port communications/send flow with email template selection and placeholder guardrails
- Port courier/shipping logistics section
- Port post-retrieval charging forms and workflows
- Port closure workflow — finalizing ticket with retrieval form submission
- Wire audit trail / activity log to real persistence
- *Reference: TICKET_WORKFLOW.md*

### Exit Criteria
- [ ] A ticket can be created, progress through status stages, and be closed
- [ ] Communications can be drafted from templates within a ticket
- [ ] Placeholder guardrail blocks sending if any variable is unresolved
- [ ] Closure requires the evidence stage to be complete and any charging case resolved (linking a submitted form to the ticket is a backend requirement)
- [ ] Activity log records all actions with timestamp and actor
- [ ] Ticket list shows correct counts and status badges

---

## Phase 4 — Integration, Polish, and Handoff

**Goal:** Cross-cutting work that spans all modules — theming, contracts, testing, security, rollout.

**Why this is last:** These items are only meaningful once all modules are integrated and working together.

### Scope

**Theming reconciliation and page transitions**
- Reconcile prototype's Nuxt UI / Tailwind v4 theming (`app.config.ts`, `main.css`) with real app's design system
- Port unified page transitions (60ms enter / 40ms leave, overlap with z-index layering)
- Scope `@formkit/pro` + license cost if any Pro input is requested
- Dark mode is built; scope mobile support as separate design work if required

**Data hand-off contracts**
- Define the data contract for the separate "Send" feature: exported Outlook-safe HTML for email templates, submitted form values for retrieval forms
- Leave `RecipientsSection.vue` and forms "emailed copy" notice as authoring/preview affordances until Send feature exists
- Get legal/compliance decision on e-signature certification requirements

**Testing, security review, and rollout**
- Run Playwright e2e tests and `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json` clean
- Add backend/API tests
- Security review: input sanitization, XSS boundaries, CSRF, auth checks on every endpoint
- Load-test for concurrent multi-user editing
- Production rollout plan
- *Reference: Dev Doc §10.8, §8.9*

### Exit Criteria
- [ ] All views use the real app's design system tokens (or documented exceptions)
- [ ] Page transitions are consistent across all views
- [ ] Data hand-off contract is documented and validated
- [ ] All tests pass (e2e, API, typecheck)
- [ ] Security review completed with no critical findings
- [ ] Rollout plan approved by Dev Lead and PM

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Phase 0 scope uncertainty — greenfield backend is the most unpredictable work | High — delays everything | Timebox backend tech selection to 1 week; prototype API routes before committing to framework |
| Outlook export regression during porting | High — hard-won compatibility knowledge is encoded in `emailExportHtml.ts` | Port the pipeline as-is, do not rewrite; test against real Outlook clients before sign-off |
| Two separate Tiptap editors accidentally merged | Medium — breaks both builders in ways that are hard to debug | Dev Doc §1 and §4 explicitly warn against this; code review gate |
| E-signature legal requirements surface late | Medium — may require re-architecture of signature capture | Decouple legal certification from v1 launch; ship signature capture as "drawn image only" with upgrade path |
| Concurrent editing conflicts (no multi-user awareness) | Low for v1 — internal tool with small team | Document as known limitation; add optimistic locking or real-time awareness as P2 |

---

## Out of Scope for All Phases

1. Real SMS and notification delivery (real email sending from the Ticket Tracker is in scope behind the existing send operation, INTEGRATIONS.md section 1)
2. E-signature legal certification (pending legal decision)
3. Further dark mode work beyond the built toggle (a screen reader pass, token reconciliation)
4. Mobile/tablet layout (desktop-only internal tool)
5. FormKit Pro inputs (license cost, add only if specific type requested)
6. Merging the two Tiptap editors (intentionally separate)
