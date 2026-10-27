# Exporting Your Test Data (Optional, For You — Before You Zip)

This prototype has **no backend** — anything you "saved" while clicking
around the Retrieval Forms builder (form edits, and any test submissions)
lives only in **your browser's `localStorage`**, scoped to the exact
`origin + port` you tested on (e.g. `localhost:3000`). It is not a file, so
it is **not included** in the handoff zip no matter what — a zip can only
carry files on disk.

Email templates are not affected by this — their real content already lives
in `app/data/templates.ts` as source code, which *is* in the zip. See
`docs/DEV_HANDOFF.md` (Known Traps #… / Known Limitations) for why.

If you want to preserve whatever you personally built/tested in the forms
builder, do this **before** re-zipping, in the actual browser tab you used
for testing (not a fresh one):

## 1. Export (run in that browser's DevTools console)

Open DevTools (F12) → Console tab → paste this → Enter:

```js
const dump = {
  forms: localStorage.getItem('ams:mock:retrievalForms'),
  submissions: localStorage.getItem('ams:formSubmissions:v1')
}
copy(JSON.stringify(dump, null, 2))
console.log('Copied to clipboard. Paste into a new file: local-data-snapshot.json')
```

If `copy()` isn't available in your browser, replace the last two lines
with `console.log(JSON.stringify(dump, null, 2))` and copy the printed
output manually.

## 2. Save it

Paste the copied JSON into a new file at
`docs/local-data-snapshot.json` in this project, then re-run the zip step.
This is just a point-in-time reference for the dev — not something meant to
be re-imported into a production system as-is.

## 3. Tell the dev what it is

This snapshot is **only useful as sample/reference data** while the dev is
building the real backend and schema — it shows real shapes of form
structures and (if any) test submissions. It should **not** be imported
as-is into any real database; the dev's schema design (see `docs/DEV_HANDOFF.md`
§10.2) is the source of truth for what the real data model should look like.

## A snapshot is already included (`docs/local-data-snapshot.json`)

This was captured during a design/testing session and contains:

- `aof-commitment` — the **seed** form. Its `content` field is **blank** in
  this snapshot (an in-browser edit overwrote it locally) — this does
  **not** reflect the real seeded content, which is defined properly in
  `app/data/retrievalForms.ts` / `RETRIEVAL_FORM_CONTENT`. Don't treat this
  snapshot's blank value as authoritative.
- `49b9e332-...` (the "(copy)" form) — this one is **scratch/test content**
  from UI experimentation (placeholder strings, an empty test section, a
  random-character stress-test paragraph). It's useful only for seeing the
  *shape* of a saved form (sections, field types, table markup) — not as
  real content to preserve or migrate.
- `submissions: null` — no test submissions were captured.

**Net effect: nothing of real value was at risk here** — this snapshot is
kept only as an example of the JSON shape a saved form takes, for whoever
designs the real schema.

## If you don't need to preserve anything

Skip all of this — the app works perfectly well for the dev to explore with
just the seed data already in `app/data/*.ts`. This export is only worth
doing if you specifically built/tested something in the forms builder that
you don't want to lose.
