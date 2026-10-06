# [AMS Templates] – Integrate email/forms builder prototype into production AMS

*(No live Jira instance is connected to this project — paste this into a real
ticket as-is.)*

## Summary
Integrate the standalone Nuxt 4 prototype (email-template builder +
retrieval-forms/document builder with Outlook export and print/PDF pipeline)
into the real GoTeam AMS application, replacing its mock data layer with real
persistence.

## Rationale
The prototype was built to validate the editing UX, Outlook-export fidelity,
and document pagination approach before committing engineering time to a
production build. All core interaction patterns (image/button alignment,
form-field validation, version history, Outlook export, print pagination)
are implemented and verified in-browser; what remains is production
plumbing — backend, auth, and real send/submit integrations.

## Scope
**In:**
- Port the Tiptap-based email body editor and its Outlook-export pipeline
  (`app/utils/emailExportHtml.ts`)
- Port the Tiptap-based retrieval-forms document editor, its FormKit-backed
  field system, and its `pagedjs` print/PDF preview
- Replace `app/data/*.ts` reactive/localStorage stores with real API-backed
  persistence
- Add real authentication and a real recipient/team-member directory

**Out** (see Dev Doc §4 for full detail):
- **Real email/notification sending is not part of this ticket at all** —
  it's a separate feature that will live on its own tab in the real app.
  This ticket only needs to expose the finished content (exported Outlook
  HTML, submitted form data) for that other feature to consume later.
- E-signature legal certification, dark mode, mobile layout, and any
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

**Email sending — OUT OF SCOPE for this ticket** (separate feature, separate
tab in the real app; do not build an SMTP/API integration here)
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
- [ ] Scope dark mode / mobile support as separate design work if required

**Testing & rollout**
- [ ] Run `tests/e2e/` (Playwright) and `npx vue-tsc --noEmit -p .` clean
- [ ] Add real backend/API tests (none exist today)
- [ ] Load-test and security-review before production rollout

Full detail and rationale for each item: [Dev Doc §10](./DEV_HANDOFF.md#10-implementation-checklist).

## Known Traps (top 3)
1. `ButtonLink`'s editor-DOM anchor intentionally has no live `href` (only
   `data-href`) to prevent in-editor navigation — the exported HTML re-adds
   a real `href`. Don't "fix" this without re-solving the navigation issue.
2. Image/button auto-move-to-edge logic must insert before stripping empty
   paragraphs, or it reintroduces a real infinite-loop tab hang.
3. Image sizing must use the real canvas pixel crop (`cropImageToAspect()`)
   — CSS `object-fit` visibly distorts images in real Outlook.

Full list: [Dev Doc §3](./DEV_HANDOFF.md#3-known-traps).

## Out of Scope (top 3)
1. No real backend/persistence exists yet — everything is `localStorage` +
   in-memory state today.
2. No auth, roles, or real recipient directory exists yet.
3. No FormKit Pro inputs/license — only free/core FormKit inputs are used.

Full list: [Dev Doc §4](./DEV_HANDOFF.md#4-out-of-scope).

## References
- [Dev Documentation](./DEV_HANDOFF.md)
- [QA Documentation](./QA_HANDOFF.md)
- Prior session notes (background only, not required reading):
  [archive/HANDOFF.md](./archive/HANDOFF.md),
  [archive/HANDOFF_SUMMARY.md](./archive/HANDOFF_SUMMARY.md),
  [archive/PAGINATION_TOOLKIT_STUDY.md](./archive/PAGINATION_TOOLKIT_STUDY.md),
  [archive/SESSION_SUMMARY.md](./archive/SESSION_SUMMARY.md)
- No Figma file or live prototype URL is connected to this project — the
  running prototype itself (`pnpm dev`) is the reference.
