# Backend Swap Guide

How the prototype's temporary data and server rules are separated from the real thing, and
how to replace them. Read with [DATA_CONTRACT.md](./DATA_CONTRACT.md), which defines the
tables, endpoints and response shapes.

## The idea

Pages never fetch data. They read **stores** (reactive objects in `app/data/*.ts`)
synchronously, and they change data by calling functions in those same files. A store is a
client cache. Everything that touches the server goes through one module, `app/api/`, which
has two implementations:

- `mock` (default): fixtures in `app/mocks/*.json`, the rules the server will own in
  `app/api/ticketActions.ts` and `app/api/mock.ts`, and this browser's storage as the database.
- `http`: calls the backend (`app/api/http.ts`).

`apiMode` in `nuxt.config.ts` (`runtimeConfig.public`) picks one. Set
`NUXT_PUBLIC_API_MODE=http` and `NUXT_PUBLIC_API_BASE=/api` to use the backend. No page
changes. Every response passes through `camelizeKeys()` and every request body through
`snakeizeKeys()` (`app/api/keys.ts`), so pages never see snake_case.

`app/api/http.ts` follows the paths and shapes proposed in DATA_CONTRACT.md. It has not been
run against a real server, so treat it as a starting point to correct.

## Type checking

`npx vue-tsc --noEmit -p .` checks **nothing** in this project: the root `tsconfig.json` has
`"files": []` and only references other configs. Use
`npx vue-tsc --noEmit -p .nuxt/tsconfig.app.json` (run `npx nuxt prepare` first if `.nuxt/`
is missing). It reports 0 errors at the time of writing.

## What goes through the api layer

All of it starts at startup, in `app/plugins/00.masterData.ts`, before the first page renders.

| What | Where it lives | Fixture | Endpoints |
|---|---|---|---|
| Courier providers and branches | `COURIER_PROVIDERS`, `COURIER_BRANCHES` (`data/ticketTrackers.ts`) | `courier_providers.json`, `courier_branches.json` | `GET /courier-providers`, `GET /courier-branches` |
| Asset Team users | `ASSET_TEAM_MEMBERS` | `users.json` | `GET /asset-team` |
| HRIS team members | `HRIS_DIRECTORY` | `hris_directory.json` | `GET /hris/team-members` |
| Checklist templates | `data/checklistTemplates.ts` | `checklist_templates.json` | `GET`, `POST`, `PATCH`, `DELETE /checklist-templates` |
| Tickets | `TICKETS` | `tickets.json` | `GET /tickets`, `POST /tickets`, `POST /tickets/{n}/actions/{name}` |
| Notifications | `NOTIFICATIONS` | none (raised by actions) | `GET /notifications`, `POST /notifications/read` |
| Email templates | `TEMPLATE_RUNTIME`, `TEMPLATE_HISTORY`, `TEMPLATES` | `email_templates.json` | `GET /email-templates`, `PUT`, `DELETE /email-templates/{key}` |
| Retrieval forms | `RETRIEVAL_FORMS`, `RETRIEVAL_FORM_CONTENT`, `FORM_VERSIONS` | `retrieval_forms.json` | `GET /retrieval-forms`, `PUT`, `DELETE /retrieval-forms/{id}` |

There are three kinds of write.

### 1. A typed request that can be refused (checklist templates, creating a ticket)

```
page  ->  await saveChecklistTemplate(...)       (data/checklistTemplates.ts)
      ->  api().checklistTemplates.create(...)   (mock or http)
      ->  { ok: true, data }  or  { ok: false, error }
      ->  on ok: the store is reloaded from the API
```

The server owns the rules. The mock applies them today (unique names, one template per
path, the last template cannot be deleted; one open ticket per team member). A rejected
request returns the message the page shows as is. The real backend returns it in its 422
body and `http.ts` turns it into `{ ok: false, error }`.

Creating a ticket works the same way: the request carries only what the user entered. The
team member's dates, contact details and assets come from HRIS on the server. The ticket's
`id`, `ticket_number`, `reference`, `acknowledgment_token`, audit id, issued checklist and
first history lines are the server's.

### 2. A ticket action (everything an operator does to an open ticket)

```
page  ->  await confirmAssets(ticket)                          (data/ticketTrackers.ts)
      ->  api().tickets.act(ticketNumber, 'confirmAssets', {})  (mock or http)
      ->  { ok: true, data: { ticket, result } }  or  { ok: false, error }
      ->  the returned ticket is patched into the store, notifications are reloaded
```

- **The list of actions is the endpoint specification.** `TicketActionName` in
  `app/api/types.ts` names them, and the `ACTIONS` table at the bottom of
  `app/api/ticketActions.ts` lists each with the arguments it takes. 51 actions: checklist
  edits, stage moves, assets, IT lock, courier branch, sends, calls, reminders, evidence,
  charging, inspection, closing, reopening, taking over, cancelling, changing path.
- **The functions above that table are the rules the server owns.** Each takes a ticket,
  changes it, writes its history line (attributed to the signed in user), and may refuse.
  In the prototype they live in `app/api/ticketActions.ts` and are deleted with it.
- **The wrappers keep their old names.** The functions pages call (`confirmAssets`,
  `releaseGate`, ...) are now `async` and sit at the bottom of `data/ticketTrackers.ts`.
  They send the request and apply the answer.
- **A refused action throws a `TicketActionError`**, except the actions that always returned
  `{ ok, error }` (`finalizeChecklist`, `changeReasonAndMode`, `takeOverTicket`,
  `cancelRetrieval`), which still return that value.
- **The browser no longer writes history or notifications.** It used to call `pushHistory()`
  and `raiseNotification()` itself. Those are now only called by the server rules.
- **Draft edits** (the charging case's dates, amounts and notes, a dismissed reminder) go
  through one action, `updateTicketFields`, which accepts a fixed list of fields and refuses
  anything else. The form shows the edit at once, typed text is sent shortly after typing
  stops, and the server's answer never overwrites the fields just sent. This is the
  contract's `PATCH /tickets/{ticket_number}`.
- **Wire format.** `POST /tickets/{ticket_number}/actions/{action-name}` with the arguments
  as the body, answered with `{ "data": { "ticket": {...}, "result": ... } }`. The developer
  may prefer one route per action: only `app/api/http.ts` changes.

### 3. Editors that save as you work (email templates, retrieval forms)

The two editors change their stores in place and autosave, as they always did.
`app/data/recordSync.ts` watches the stores, works out which **records** changed since the
last save, and sends only those: a `PUT` for each changed form or template and a `DELETE`
for each removed one. `app/data/syncedStores.ts` says which stores make up a record, and
`app/plugins/recordSync.client.ts` starts it once the stores are loaded. A save that fails is
tried again on the next change.

- The id of a new form or template is a UUID chosen by the browser. `PUT` with that id
  creates it. The server may prefer to assign ids; that is a change in `syncedStores.ts`.
- A record carries everything the editor holds: for a form, its fields, its document (HTML),
  its legacy sections and its saved versions; for a template, its content and settings and
  its saved versions. Versions are inside the record in the prototype. In the database they
  are their own table (DATA_CONTRACT.md section 4.5), so the server will likely split and
  append them.
- `system` is set by the server on a record that ships with the product. The browser never
  sends it.
- A change made just before the page closes is sent from a `beforeunload` handler. A browser
  may not wait for the answer. Real requests should use `keepalive` or a beacon.

## Prototype only (delete at handoff)

Never a requirement. See DATA_CONTRACT.md section 3.4.

- `app/api/mock.ts`, `app/api/ticketActions.ts`, `app/mocks/`.
- The simulator bar (`app/components/shared/SimulatorBar.vue`), `app/utils/demoSettings.ts`,
  the persona switch (`ams:demo:currentUser`, `setCurrentUser`) and "Viewing as".
- The demo events: `simulateHrisLwdUpdate`, `simulateBranchReply`, `pushDemoNotification`,
  `pushDemoNotificationSet`, `clearAllTickets`.
- The timed jobs that the browser runs only because there is no server: `scanTicketAlerts`
  (raises overdue and due-soon alerts) and the morning digest functions. They belong on the
  server. The browser should only call `GET /notifications` on a timer.
- The mock database for tickets and notifications (`plugins/ticketStorage.client.ts`,
  `utils/ticketStorage.ts`, `utils/defineStorageSyncPlugin.ts`) and the repair code that goes
  with it, `repairRestoredTicket`.
- Two read helpers that quietly change a ticket as they read it because there was no server
  to do it: `currentStageKey()` (skips stages that do not apply) and
  `syncTicketAssetsFromRegister()` (adds equipment HRIS has since assigned). A server should
  do both when it returns the ticket.
- `viewing a stage` actions (`goBackStage`, `goForwardStage`, `jumpToStage`) move the
  ticket's current-stage pointer and write a `navigation` history line. Decide whether the
  server should store that at all (DATA_CONTRACT.md section 4.3 says not).

## Steps to connect the real backend

1. Create the tables from DATA_CONTRACT.md section 4 and build the endpoints in section 7
   and the action list in `ticketActions.ts`.
2. Seed the database from `app/mocks/*.json` (a seeder reading the same files), and check
   the rows in phpMyAdmin or Workbench.
3. Correct `app/api/http.ts` to match the real routes and envelope.
4. Set `NUXT_PUBLIC_API_MODE=http`.
5. Delete `app/api/mock.ts`, `app/api/ticketActions.ts` and `app/mocks/`, remove the
   `./mock` branch in `app/api/index.ts`, and remove the prototype-only code above.

If the app is server rendered in production, load data per request rather than into module
level stores, or turn off server rendering for authenticated routes. The stores are shared
across requests on the server, so per user data must not be loaded into them there.
