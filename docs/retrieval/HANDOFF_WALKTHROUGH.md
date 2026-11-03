# Handoff walkthrough: GoTeam AMS Retrieval Module

**Length:** 8 minutes live, or recorded. **Covers only** the three places a written doc is most likely to be skimmed past: the flow diagram, the Known Traps and Out of Scope. Everything else is in the [Dev Doc](./DEV_HANDOFF.md) and the [QA Doc](./QA_HANDOFF.md).

**Have open:** the running app, the Dev Doc at section 2 (flow diagrams), and the Dev Doc at sections 3 and 4.

## 1. Flow diagram (about 3 minutes)

Open the **Ticket lifecycle** diagram in Dev Doc section 2 (`docs/retrieval/diagrams/ticket-lifecycle.png`, editable as `.excalidraw`). Follow the blue path left to right and top to bottom; dashed boxes are remote only and the red path is charging.

- A ticket starts in **Create**, which allows only one open ticket per team member.
- It runs through the **checklist** (Complete checklist needs every required task), the **IT access notice** (a notice, never a gate), **asset confirmation**, then the **notice** and **call confirmation**, then **reminders**.
- **Remote** tickets add the branch and courier stages before the notice, and **Confirm in transit** after the reminders. Onsite tickets skip them.
- Every ticket then waits in **Awaiting return**. From there it goes one of two ways: **Receipt and evidence** when the equipment is received, or straight to **Post-retrieval charging** when it will not be returned.
- **Post-retrieval charging** also happens when evidence shows damage. After it, returned items go to **Returned item check and routing**; not returned or settlement goes to **Closure**.
- At any time while a ticket is open it can be **cancelled** (recorded, not deleted) or **taken over** (blocked for the current assignee).
- Say plainly: the server owns which stage comes next. In this build those rules are mock-server code.

Then show the email editor flow diagram: edit, insert nodes, export to Outlook. The export path builds Outlook-safe HTML; nothing here sends email.

## 2. Known Traps (about 3 minutes)

Read these eight in order. They are the same eight in the Dev Doc (3.1), the QA Doc (1.1) and, as the top three, in the Jira ticket.

1. **[All]** The type check command in the old docs checks nothing. Use `npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json`.
2. **[Data layer]** The stage rules for the 52 ticket actions are mock-server code in `api/ticketActions.ts`. The server must own them. Do not add page-side writes of history or notifications.
3. **[Data layer]** Ticket actions are not serialized per ticket. In http mode two quick actions can overwrite each other. Serialize or send a version.
4. **[Ticket Tracker]** The browser ticket mirror is the mock's database only and is switched off in http mode. Do not turn it on against a real backend.
5. **[Ticket Tracker, Data layer]** Date-only strings parse as UTC. Use `parseLocalDate` and `localISO`. Two real bugs came from this.
6. **[Ticket Tracker]** Take over ticket for the assignee is `aria-disabled`, not `disabled`, on purpose: a click explains why. The server still refuses it.
7. **[All]** Helper text, placeholders and empty values have their own colors with their own reasons. Do not tidy them back to Nuxt UI defaults.
8. **[Templates]** The email subject at 16px and the form editor's document labels are intentional overrides.

## 3. Out of Scope (about 2 minutes)

**Deferred or boundary.** Say each one so nobody builds it unasked:
- Real SMS and notification delivery and the morning digest. Real email from the Ticket Tracker is the developer's work behind the existing send operation.
- A live employee-record connection (the directory is a fixture).
- Timed jobs: the alert scan and the digest run in the browser today and belong on the server.
- Evidence and quotation file upload (browser files today).
- Roles and permissions, authentication, a real directory.
- E-signature legal certification, FormKit Pro inputs, a phone-ready editor layout.
- Real OS print-to-PDF beyond the in-browser preview.

**Anticipated but not wanted:**
- Merging the email editor and the forms editor.
- CSS `object-fit` image scaling in the email export.
- A live `href` on the in-editor button link.
- Page-side stage rules, ticket numbers or references.
- The text "(optional)" or uppercase field labels.
- **[Ticket Tracker]** Don't make the IT access lock (stage A4) a gate, and don't add a scheduling or execution confirmation. Locking access is IT's job. The stage is a notice to IT, with "Continue without notifying IT" as an equal way on.
- **[Master Data, Ticket Tracker]** Don't bring back a reviewer step, a reviewer note or the word "review" on the offboarding checklist. The button is "Complete checklist". The `noteText` argument on `finalizeChecklist` is an unused leftover; the real server should not accept or store a reviewer note.
- **[Ticket Tracker]** Don't restore a date limit on the Endorsement Recorded Date. It was removed on purpose.
- **[Ticket Tracker]** Don't add J&T Express. JRS and LBC are the couriers.
- **[All]** Don't add the dashboard to the retrieval module's branches. It lives on its own branch and is not part of this handoff.

## Close

- The simulator strip at the top of the app is scaffolding. Use it to reach every state, then leave it out of production.
- Open items are in Dev Doc section 15, with the cost of leaving each one.
- Where to start: [BACKEND_SWAP.md](./BACKEND_SWAP.md).
