# Exporting Your Test Data (Optional, For You, Before You Zip)

This prototype has **no backend**. Anything you saved while clicking around (tickets, form
and email template edits, checklist templates, test submissions) lives only in **your
browser's `localStorage`**, scoped to the exact origin and port you tested on (for example
`localhost:3000`). It is not a file, so it is **not included** in the handoff zip no matter
what: a zip can only carry files on disk.

What is kept in the browser (all keys start with `ams:`):

| Key | What it holds |
|---|---|
| `ams:tickets:v1` | The tickets you created or changed |
| `ams:mock:retrievalForms` | Edited and created forms, as `{ records, deleted }` |
| `ams:mock:emailTemplates` | Edited and created email templates, as `{ records, deleted }` |
| `ams:checklistTemplates:v2` | Offboarding checklist templates |
| `ams:formSubmissions:v1` | Test form submissions (only a signed at time today) |

The shipped content itself (the 20 email templates, the 5 forms, the sample tickets and
people) is in `app/mocks/*.json`, which **is** in the zip. See `docs/retrieval/DEV_HANDOFF.md`
(Known Limitations) for why the browser copy is only a stand in for a database.

If you want to preserve something you built or tested, do this **before** re-zipping, in the
actual browser tab you used for testing (not a fresh one).

## 1. Export (run in that browser's DevTools console)

Open DevTools (F12), then the Console tab, paste this and press Enter:

```js
const keys = [
  'ams:tickets:v1',
  'ams:mock:retrievalForms',
  'ams:mock:emailTemplates',
  'ams:checklistTemplates:v2',
  'ams:formSubmissions:v1'
]
const dump = Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)]))
copy(JSON.stringify(dump, null, 2))
console.log('Copied to clipboard. Paste into a new file: local-data-snapshot.json')
```

If `copy()` isn't available in your browser, replace the last two lines with
`console.log(JSON.stringify(dump, null, 2))` and copy the printed output by hand.

## 2. Save it

Paste the copied JSON into a new file at `docs/retrieval/local-data-snapshot.json` in this project,
then re-create the handoff zip. This is a point in time reference for the dev, not something
to import into a production system as is.

## 3. Tell the dev what it is

The snapshot is **only sample or reference data** while the dev builds the real backend and
schema. It shows real shapes of saved records. It should **not** be imported into a real
database; the dev's schema (see `docs/retrieval/DATA_CONTRACT.md` and `docs/retrieval/DEV_HANDOFF.md` §10.2) is
the source of truth for the real data model.

## About the snapshot already in `docs/retrieval/local-data-snapshot.json`

It was captured earlier, in an older storage format (`{ forms, sections }`), and mentions a
seed form called `aof-commitment` that no longer exists. The shipped forms are now
`return-ack-onsite`, `return-ack-remote`, `atd-loss-damage-non-return`,
`atd-settlement-transfer` and `notice-assessment-quotation-pending`, in
`app/mocks/retrieval_forms.json`. Treat the old file as a rough example of a saved form only,
and regenerate it with the script above if the exact shape matters.

## If you don't need to preserve anything

Skip all of this. The app works for the dev to explore with just the shipped data in
`app/mocks/*.json`.
