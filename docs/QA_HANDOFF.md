# QA Documentation — GoTeam AMS Templates Builder

**Prototype:** Nuxt 4 + Nuxt UI v4 email-template and retrieval-forms builder.
**How to test:** run `pnpm install && pnpm dev`, open `http://localhost:3000`.
No login is required (no auth exists in this prototype). There is no
simulator/state-switcher navbar in this build — every state below is reached
by direct interaction (creating/editing a template or form, then navigating
to the relevant page).

**Reference:** [Dev Documentation](./DEV_HANDOFF.md) — every test case below
is tagged with the Dev Doc section it verifies.

## Table of contents
1. Known Traps (test priority)
2. Out of Scope
3. Numbered test cases
4. Responsive & Touch
5. Sign-off checklist
6. Full regression pass

---

## 1. Known Traps (test priority)

Verify these **first** — they represent behavior that has broken before.

1. Click an image inside the email/form editor → it must select
   (highlight), never navigate away or open a file dialog.
2. Click a button-link inside the email editor → it must select, and must
   **never** open a new tab / navigate to its target URL while editing.
3. Insert an image or button-link, then delete surrounding content until
   it's the only content on the page → the tab must **not** hang or freeze.
4. Insert a footer-role image at the end of a document → no extra blank
   paragraph should appear below it. Insert a non-image block at the end →
   a trailing blank paragraph **should** appear (this is intentional,
   opposite of the footer case).
5. Set a button-link's alignment (left/center/right) → export/copy the email
   → the alignment must survive into the exported HTML, not just the live
   editor view.
6. Upload a file into a form's file-upload field → confirm no native
   "no file chosen" / duplicate filename text appears alongside the custom
   upload UI.
7. Re-open a form that was already submitted → it must render **read-only**
   with a submitted/already-emailed indicator, and must not allow editing.

## 2. Out of Scope

Do not file bugs for the following — they are deliberate boundaries of this
prototype, not gaps:
- **No real email/notification is ever sent — this is by design, not a
  missing feature.** Actual sending is a separate feature that will live on
  its own tab in the real app; "send"/"submit" here only updates local/mock
  state to demonstrate the authoring/preview UX.
- No real backend — all data resets if `localStorage` is cleared or a
  different port/domain is used.
- No login, roles, or real recipient directory.
- No dark mode (forced light mode).
- No FormKit Pro inputs (autocomplete, datepicker, slider, etc.) — only core
  FormKit inputs exist.
- Mobile/tablet layout is not a supported target for this internal tool.
- Real OS print-to-PDF fidelity beyond the in-browser print preview has not
  been claimed as verified — flag differences for triage, not as a
  guaranteed regression.

## 3. Numbered test cases

### 3.1 Email Templates

| # | Steps | Expected | Bug if |
|---|---|---|---|
| 1 | Open Templates → create/open an email template → type body text, select it, click Align Center | Text visually centers, toolbar's center button shows active state | Text doesn't move, or wrong button highlights → Dev Doc §6.1 |
| 2 | Insert an image via the Insert Image popover, choose Header role | Image crops to 640×140 and snaps to the very top of the document, no gap left behind | Image distorted/stretched, or a blank paragraph remains above/below it → Dev Doc §3.4, §3.7 |
| 3 | Insert an image, choose Footer role | Image crops to 640×100 and snaps to the very bottom, no trailing blank paragraph | Trailing gap appears, or image doesn't move → Dev Doc §3.4, §3.5 |
| 4 | Click directly on an inserted image | Image shows a selection outline; toolbar align buttons reflect the image's current alignment | Image not selectable, or click does nothing → Dev Doc §3.2 |
| 5 | With an image selected, click Align Right | Image moves right, toolbar shows Align Right active | Image doesn't move, or text alignment changes instead → Dev Doc §6.1 |
| 6 | Insert a button-link, set a target URL, click directly on the rendered button in the editor | Button gets selected (highlighted), **no new tab opens, no navigation occurs** | Any navigation/new tab happens → **Known Trap #2, highest priority** |
| 7 | With the button-link selected, click Align Center, then Export/Copy to Outlook | Exported HTML's button is centered and contains a real, working `href` to the target URL | Alignment lost in export, or exported link is missing/broken → **Known Trap #5** |
| 8 | Drag an inserted image to a different position in the document | Image moves to the new position via drag-and-drop | Image drag does nothing, or triggers a generic browser image-drag instead | 
| 9 | Set a background color and a footer note on the template (edit page), save, reload | Background color and footer note persist after reload | Values reset or don't apply |
| 10 | Export/Copy a template with a table, colored callout, and highlighted text to Outlook (paste into a real Outlook client if available) | Table fill, callout background, and highlight color all render correctly in Outlook | Any fill/color is lost specifically in Outlook (not just the in-app preview) |

### 3.2 Retrieval Forms

| # | Steps | Expected | Bug if |
|---|---|---|---|
| 11 | Open/create a retrieval form → insert a text field, a checkbox field, and a file-upload field | Each renders as a real interactive FormKit input inline in the document | Field doesn't render, or renders as a plain HTML input with no validation | 
| 12 | Leave a required text field empty and attempt to submit | Validation error shows on that field, submission is blocked | Submission succeeds anyway, or no error shown → Dev Doc §5 |
| 13 | Upload a file into the file-upload field | Custom upload UI (outline button + preview) shows the file; no native "no file chosen" text appears | Native file input text overlaps/duplicates the custom UI → **Known Trap #6** |
| 14 | Draw a signature in the signature field, save | Signature image is captured and persists on reload | Signature lost, or pad doesn't respond to drawing |
| 15 | Fill and submit a form as a "recipient" (via `/form-preview`) | Form locks to read-only, shows a submitted/"emailed copy" confirmation | Form remains editable after submission, or no confirmation shown → **Known Trap #7** |
| 16 | Re-open the same already-submitted form | Renders read-only immediately, does not allow re-editing or re-submitting | Form is editable again |
| 17 | Add several fields, scroll/type until content spans multiple pages | On-screen page breaks appear at reasonable points as you type | Page count doesn't update, or content visibly overlaps a page break |
| 18 | Open `/form-preview` and trigger the print/PDF view | pagedjs renders the document paginated with real page breaks matching print margins | Content is cut off mid-field, or a field/row is split awkwardly across a page break |
| 19 | Duplicate an existing form template | The duplicate carries over its real content (not blank/placeholder content) | Duplicate is empty or missing fields — this exact case has an existing Playwright test (`tests/e2e`), re-run it |
| 20 | Make an edit, save a new version, open Version History | Diff view shows what changed between the two versions | Diff shows nothing, or shows unrelated/incorrect changes |

## 4. Responsive & Touch

This is an internal desktop tool — **not** built or claimed to support
mobile/tablet. Do not file mobile-layout bugs as regressions; instead confirm
the following baseline only:

- **No horizontal scroll** at common desktop widths (1280px, 1440px, 1920px).
- **Text stays readable** without zoom at normal desktop widths.
- If accessed on a narrower viewport (tablet/mobile), it's acceptable for
  layout to be visually broken — log as a feature request for future
  responsive work, not a bug against this build.

## 5. Sign-off checklist

- [ ] All Known Traps (§1, 7 items) verified
- [ ] All Email Templates test cases (§3.1, 10 cases) pass
- [ ] All Retrieval Forms test cases (§3.2, 10 cases) pass
- [ ] Existing Playwright suite (`tests/e2e`) passes
- [ ] `npx vue-tsc --noEmit -p .` runs clean
- [ ] No Out-of-Scope item (§2) has been mistakenly filed as a bug

## 6. Full regression pass

Quick re-run list after any fix, before re-sign-off:
1. Image insert/select/align (Header, Footer, Plain roles)
2. Button-link insert/select/align/export
3. Trailing-paragraph behavior (footer vs. non-footer end-of-doc)
4. Outlook export round-trip (table, callout, highlight, button)
5. Form field insert/validate/submit for each field type
6. Already-submitted read-only state
7. Print/PDF preview pagination
8. Form duplication content carryover
