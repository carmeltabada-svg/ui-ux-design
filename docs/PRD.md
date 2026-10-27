# Product Requirements Document — AMS Retrieval Module Production Integration

**Author:** Carmel Tabada
**Status:** Draft
**Last updated:** 2026-10-12
**Prototype:** https://ams-retrieval-demo.netlify.app
**Source:** https://github.com/carmeltabada-svg/ui-ux-design (`main` is the source of truth; `retrieval` and `templates` are backups)

---

## Problem Statement

The GoTeam Asset Management System (AMS) currently has no digital workflow for managing employee retrieval processes — tracking which company assets a departing employee holds, which templates/forms to send, and what the status of each retrieval case is. Asset Team officers rely on manual coordination, disconnected spreadsheets, and ad-hoc email chains, leading to missed retrievals, delayed closures, and no audit trail.

The cost of not solving this: continued manual tracking, no visibility into retrieval status for management, no standardized communication templates, no compliance-ready document trail, and no measurable process for charging unreturned assets.

---

## Goals

1. **Eliminate manual retrieval tracking** — all retrieval cases are managed as tickets with a defined lifecycle (creation → communications → logistics → closure), replacing spreadsheets and ad-hoc coordination.
2. **Standardize communications** — Asset Team officers use pre-built, Outlook-safe email templates with placeholder guardrails that block sending if any variable is unresolved, ensuring consistent and complete outreach.
3. **Digitize retrieval forms and documents** — retrieval forms with typed fields, e-signatures, version history, and print/PDF output replace paper-based or unstructured document processes.
4. **Centralize configuration** — master data (retrieval paths, offboarding checklists, courier providers, policies, contact details) is managed in one place, referenced everywhere, so a single change propagates across all templates and tickets.
5. **Provide an audit trail** — every action on a ticket (status changes, communications sent, forms submitted, assets charged) is logged with timestamp and actor, supporting compliance and management reporting.

---

## Non-Goals

1. **Real SMS and notification delivery.** Real email delivery from the Ticket Tracker (notice, reminders, courier endorsement, charging notice, closure copy) is in scope for the backend developer (INTEGRATIONS.md section 1): the front end and mock are built behind one send operation, `api().emails.send`. The Templates builders stay free of delivery and only expose finished content (Outlook safe HTML, submitted form data). SMS stays copy and confirm. A "Mark as sent outside the system" path and Download EML exist. (Earlier drafts called all sending a separate feature on its own tab; that is no longer the decision.) *Rationale: sending involves SMTP/API integration, delivery tracking, and bounce handling — a distinct engineering effort with its own requirements.*
2. **E-signature legal certification** — `SignaturePad.vue` captures a drawn signature image only. Legal/compliance must decide what "signed" means for this business (timestamp? identity verification? audit trail?) before this is production-ready. *Rationale: premature implementation risks building the wrong certification model.*
3. **Dark mode is not a Non-Goal any more.** Dark mode is built (Light, Dark or System from the navbar toggle; documents and print output stay light). Remaining work is a screen reader and keyboard pass (see WCAG_DARK_AUDIT.md) and reconciling the tokens with the real app. (It was once forced to light mode.) *Rationale: Nuxt UI's `oklch()` tokens and the Outlook export pipeline both have light-mode assumptions baked in.*
4. **Mobile/tablet layout** — this is an internal, desktop-oriented AMS tool used by Asset Team staff at workstations. The builder UI (multi-pane toolbars, side-by-side editor/preview) assumes a desktop viewport. *Rationale: no user need identified; designing for mobile is separate design + build work.*
5. **FormKit Pro inputs** — only free/core FormKit inputs are used (text, number, checkbox, file, signature). Pro inputs (autocomplete, datepicker, slider, rating, repeater, etc.) require `@formkit/pro` plus a paid Pro key. *Rationale: license cost and dependency scope — add only if a specific input type is requested.*

---

## User Stories

### Asset Team Officer (primary user)

- As an Asset Team officer, I want to create a retrieval ticket for a departing employee so that I can track the full retrieval process from start to closure in one place.
- As an Asset Team officer, I want to select a departure reason (resignation, immediate resignation, end of contract, recalled, unexplained absence) and retrieval mode (onsite vs. remote) when creating a ticket so that the correct workflow and templates are applied automatically.
- As an Asset Team officer, I want to send pre-built email templates from within a ticket so that I can communicate consistently with departing employees without composing emails from scratch.
- As an Asset Team officer, I want the system to block sending an email template if any placeholder is unresolved so that I never send an incomplete or incorrect communication.
- As an Asset Team officer, I want to attach a retrieval form to a ticket and have the departing employee fill and e-sign it so that I have a documented record of what was acknowledged and returned.
- As an Asset Team officer, I want to view the full activity log for any ticket so that I can see who did what and when for audit and handover purposes.
- As an Asset Team officer, I want to close a retrieval ticket once the evidence stage is complete and any charging case is resolved so that the case is finalized with a complete record. (Linking a submitted retrieval form to the ticket is a backend requirement the prototype does not build.)
- As an Asset Team officer, I want to manage post-retrieval charging (for unreturned or damaged assets) from within the ticket so that the financial resolution is part of the same case record.
- As an Asset Team officer, I want to arrange courier pickups and track shipping for remote retrievals so that physical asset collection is managed within the same case.

### Template/Form Author (may be the same person or a lead)

- As a template author, I want to create and edit email templates using a rich-text editor so that I can design professional, branded communications without knowing HTML.
- As a template author, I want to export an email template as Outlook-safe HTML so that it renders correctly when pasted into Outlook (desktop and web) without formatting loss.
- As a form author, I want to build retrieval forms with typed fields (short text, paragraph, number, checkbox, file upload, signature, button link) using a document editor so that I can create structured forms without a developer.
- As a form author, I want version history with diff comparison so that I can see what changed between form versions and revert if needed.
- As a form author, I want to preview and print/PDF a form with proper pagination so that I can verify the printed output before distributing it.

### Master Data Administrator

- As an administrator, I want to manage retrieval paths in one place so that every template, checklist, and ticket references the same path definitions. (Not built yet: the paths are defined in code today, and only Offboarding Checklists is a live Master Data card.)
- As an administrator, I want to configure offboarding checklists and assign them to specific retrieval paths so that the correct checklist applies automatically based on the departing employee's situation.
- As an administrator, I want to manage courier provider details in Master Data so that these values update everywhere they are referenced without editing individual templates.
- As an administrator, I want role-based access so that only authorized personnel can create templates, manage tickets, or modify master data.

---

## Requirements

### Must-Have (P0)

These represent the minimum viable version. The module cannot ship without them.

**Backend & API**
- [ ] Backend framework/runtime stands up with API routes (none exists today)
- [ ] CRUD API for email templates, retrieval forms, form submissions, retrieval tickets, form version history, master data entities
- [ ] Server-side validation for every form-field type (client-side FormKit validation alone is insufficient)
- [ ] Input sanitization for all rich-text/HTML content from Tiptap editors before storage/render (XSS boundary)
- [ ] Rate limiting and standard API hardening

**Database & Persistence**
- [ ] Schema designed for: templates, form fields, submissions, version history, tickets (status/lifecycle/history), master data, users
- [ ] All reactive-store reads/writes replaced with real API calls
- [ ] localStorage mirroring replaced with server-persisted state
- [ ] File storage for uploads and captured signatures

**Auth & Authorization**
- [ ] Real authentication (no login flow exists)
- [ ] Static `teamMembers.ts` fixture replaced with real user/team directory
- [ ] Roles, permissions, and ownership checks on every endpoint

**Front-End Porting**
- [ ] Tiptap email-body editor + extensions ported
- [ ] Tiptap retrieval-forms editor + FormKit field system ported
- [ ] Outlook export pipeline (`emailExportHtml.ts`) ported as-is (encodes hard-won compatibility knowledge)
- [ ] Print/PDF preview + pagedjs wiring ported
- [ ] Ticket Tracker views (list, detail, create) with status lifecycle and closure workflow ported
- [ ] Master Data screens (retrieval paths, offboarding checklists) ported
- [ ] Theming reconciled with the real app's design system

**Testing**
- [ ] Playwright e2e tests and `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json` pass clean (the bare `vue-tsc --noEmit` checks nothing)
- [ ] Backend/API tests added
- [ ] Security review completed before production rollout

### Nice-to-Have (P1)

The core use case works without these, but they significantly improve the experience.

- [ ] Version history with server-side diff storage (vs. client-side `microdiff` only)
- [ ] Server-side PDF generation (currently client-side `window.print()` only)
- [ ] Communications send flow with template selection from within tickets
- [ ] Courier/shipping logistics section in ticket detail
- [ ] Post-retrieval charging forms within tickets
- [ ] Courier Providers master data configuration
- [ ] Outlook export re-verified against real Outlook clients (desktop + web)
- [ ] Load testing for concurrent multi-user editing

### Future Considerations (P2)

Out of scope for v1, but design decisions should not make these harder later.

- [ ] Real SMS and notification delivery (real email sending from the Ticket Tracker is P0 backend work, see Non-Goal 1)
- [ ] E-signature legal certification (pending legal/compliance decision)
- [ ] FormKit Pro inputs (autocomplete, datepicker, etc.) if requested
- [x] Dark mode (built; a screen reader and keyboard pass remains)
- [ ] Mobile/responsive layout
- [ ] Multi-tenant concurrent editing awareness ("someone else is editing this")
- [ ] Data export and reporting dashboards
- [ ] Integration with existing HR/payroll systems for employee data

---

## Success Metrics

### Leading Indicators (days to weeks post-launch)

| Metric | Target | Stretch | Measurement |
|---|---|---|---|
| Adoption rate | 80% of Asset Team officers create at least one ticket within 2 weeks | 95% within 1 week | Backend analytics: unique users creating tickets |
| Template usage rate | 60% of outbound retrieval communications use a pre-built template | 80% | Count of template exports per ticket |
| Task completion rate | 90% of started tickets reach closure | 95% | Ticket status lifecycle data |
| Time to first send | Officers send their first communication within 10 minutes of ticket creation | 5 minutes | Timestamp delta: ticket created → first template exported |
| Error rate on forms | < 5% of form submissions fail validation | < 2% | Server-side validation error logs |

### Lagging Indicators (weeks to months)

| Metric | Target | Stretch | Measurement |
|---|---|---|---|
| Average retrieval cycle time | 20% reduction from pre-AMS baseline | 35% reduction | Ticket created → ticket closed duration |
| Missed retrieval rate | < 5% of departing employees have no retrieval ticket | < 2% | Cross-reference HR departure list with AMS tickets |
| Support ticket reduction | 30% fewer internal questions about retrieval status | 50% | Support/helpdesk ticket count tagged "retrieval" |
| Charging recovery rate | 15% improvement in recovery of unreturned asset charges | 25% | Financial data: charges raised vs. collected |
| Audit readiness | 100% of closed tickets have a complete activity log | 100% | Automated check: closed tickets with ≥ 1 log entry per stage |

---

## Implementation Phases

See `docs/IMPLEMENTATION_PHASES.md` for full phase breakdown with dependencies.

| Phase | Focus | Depends on | Can parallelize with |
|---|---|---|---|
| **Phase 0** | Foundation — backend API, database schema, auth | Nothing | Nothing |
| **Phase 1** | Templates Builder — email editor, forms editor, version history, print/PDF | Phase 0 | Phase 2 |
| **Phase 2** | Master Data — retrieval paths, offboarding checklists, config screens | Phase 0 | Phase 1 |
| **Phase 3** | Retrieval Ticket Tracker — list/create/detail, communications, logistics, closure | Phases 1 + 2 | Nothing |
| **Phase 4** | Integration — theming, data contracts, testing, security, rollout | Phase 3 | Nothing |

---

## Open Questions

| Question | Owner | Blocking? |
|---|---|---|
| Which backend framework/runtime? (Nuxt server routes, separate service, existing GoTeam backend?) | Dev Lead | Yes — blocks Phase 0 |
| Which database engine? (PostgreSQL, MySQL, existing GoTeam DB?) | Dev Lead | Yes — blocks Phase 0 |
| Auth provider? (SSO with existing GoTeam auth, LDAP, standalone?) | Dev Lead + PM | Yes — blocks Phase 0 |
| What does "signed" need to mean legally for the e-signature pad? | Legal/Compliance | No — can launch without e-signature certification, add later |
| Server-side PDF generation needed, or client-side `window.print()` sufficient? | Dev Lead + PM | No — can launch with client-side only |
| Will the real AMS app have its own design system to reconcile with? | Design + Dev Lead | No — can port as-is and reconcile later |
| Is concurrent multi-user editing a launch requirement or a fast follow? | PM | No — prototype has no concept of this |
| Timeline for the separate "Send" feature (email delivery tab)? | PM | No — this module only defines the data contract |

---

## Timeline Considerations

- **No hard deadline identified** — this is an internal tool improvement, not a contractual or regulatory commitment.
- **Phase 0 is the critical path** — no front-end porting can begin until backend, database, and auth are in place. Estimate this phase carefully; it is the most uncertain (greenfield backend work).
- **Phases 1 and 2 can run in parallel** if different developers work on them, cutting the total timeline.
- **Phase 3 has the most dependencies** — it needs both templates (for communications from tickets) and master data (for paths/checklists referenced by tickets) to be working.
- **Phase 4 is intentionally last** — theming reconciliation and security review are cross-cutting and should run against the complete, integrated module.

---

## References

- [Dev Documentation](./DEV_HANDOFF.md) — full technical detail: flow diagrams, known traps, edge cases, packages, implementation checklist
- [QA Documentation](./QA_HANDOFF.md) — test scenarios and verification procedures
- [Implementation Phases](./IMPLEMENTATION_PHASES.md) — detailed phase breakdown with dependencies and risks
- Live prototype: https://ams-retrieval-demo.netlify.app
- Source code: https://github.com/carmeltabada-svg/ui-ux-design (`main` is the source of truth; `retrieval` and `templates` are backups)
