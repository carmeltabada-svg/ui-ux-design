# Handoff Docs — Read This First

Start with the doc for your role. Nothing else in this folder needs to be
read to start work.

| File | Who reads it | What it's for |
|---|---|---|
| **[PRD.md](./PRD.md)** | PM, stakeholders | Product requirements: problem statement, goals, user stories, prioritized requirements (P0/P1/P2), success metrics, open questions. |
| **[IMPLEMENTATION_PHASES.md](./IMPLEMENTATION_PHASES.md)** | Dev Lead, PM | Phase breakdown with dependency map, exit criteria per phase, known traps, risks, and key decisions. |
| **[DEV_HANDOFF.md](./DEV_HANDOFF.md)** | Developer | Full technical scoping: flow diagrams, known traps, out-of-scope items, packages/feasibility, and the full-stack implementation checklist by layer. |
| **[TICKET_WORKFLOW.md](./TICKET_WORKFLOW.md)** | Developer | The Ticket Tracker in detail: data model, deadline matrix, every stage, the 52 actions and what the server must enforce, list and create view, notifications, SMS. |
| **[TEMPLATES_SPEC.md](./TEMPLATES_SPEC.md)** | Developer | Templates and Master Data in detail: list, email and form models, builders, `/form-preview`, placeholders, template to ticket contracts, the checklist editor. |
| **[INTEGRATIONS.md](./INTEGRATIONS.md)** | Developer, PM | Email sending readiness and contract, the SMS decision, the R24 data list, time zone rules, e-signature recommendations, print to PDF, dark mode status. |
| **[DATA_CONTRACT.md](./DATA_CONTRACT.md)** | Developer (Laravel backend) | Proposed tables, enumerations, derived values that must not be stored, endpoints, response shapes, and how the temporary fixtures are organised so they can be swapped for the real backend. Draft for review. |
| **[BACKEND_SWAP.md](./BACKEND_SWAP.md)** | Developer (Laravel backend) | How the temporary data is separated, what is already behind the `app/api/` seam, what is not yet, and the steps to connect the real backend. |
| **[QA_HANDOFF.md](./QA_HANDOFF.md)** | QA | Test cases, priority regression checks, and sign-off checklist. |
| **[USER_GUIDE.html](./USER_GUIDE.html)** | Asset Team, template and form authors, master data admins, team members, PM | Interactive user guide, one page per role: tutorial, how-to, reference and why it works this way, plus an FAQ and what is not built. Open it in a browser, no setup. |
| **[HANDOFF_WALKTHROUGH.md](./HANDOFF_WALKTHROUGH.md)** | Developer, QA (presenter script) | An 8 minute script covering the flow diagram, Known Traps and Out of Scope. |
| **[DATA_EXPORT_GUIDE.md](./DATA_EXPORT_GUIDE.md)** | Designer (before zipping) | Optional — how to export test data from the Retrieval Forms builder (`localStorage`-only). |

## archive/

Older working notes from earlier build sessions (`HANDOFF.md`,
`HANDOFF_SUMMARY.md`, `PAGINATION_TOOLKIT_STUDY.md`, `SESSION_SUMMARY.md`).
Optional background reading only — everything a developer, QA, or PM
actually needs has already been extracted into the files above.
