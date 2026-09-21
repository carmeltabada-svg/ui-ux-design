import { test, expect, type Locator } from '@playwright/test'

// Regression coverage for two real bugs in duplicating a form:
//
// 1. duplicateForm() used to copy only the legacy `sections` record, never
//    the form document canvas's own real content (`RETRIEVAL_FORM_CONTENT`)
//    - so the duplicate opened with an empty canvas instead of a copy of
//    what was actually on screen.
// 2. Even after fixing that, a duplicate made *without first opening the
//    source form's own editor* in that browser session still came out
//    empty - the sections->document migration only ran from inside
//    edit.vue's own setup, so a form nobody had opened yet in this session
//    had nothing in RETRIEVAL_FORM_CONTENT to copy. See ensureFormContent()
//    in app/utils/formContentMigration.ts, which now backstops every read
//    site, not just edit.vue.
//
// Exercised here via the edit page's own "Duplicate form" menu action - the
// row-level Duplicate on the templates list *also* goes through the same
// duplicateForm() call, but its icon is a hover-revealed row action (only
// interactive on real pointer hover), which is a separate, flakier thing to
// automate reliably and isn't what this regression is actually about.

// tiptap-pagination-plus briefly toggles its own `rm-with-pagination` class
// off and back on during its async re-measurement pass, so two separate
// `expect()` calls against the same locator can race that toggle - one
// `toContainText` checking for both strings in a single poll avoids
// re-querying the DOM in between.
async function expectRealContent(doc: Locator) {
  await expect(doc).toContainText(/Acknowledgment of Responsibilities[\s\S]*Complete Delivery Address/, { timeout: 30000 })
}

test('duplicating a form carries over its real document content, not an empty canvas', async ({ page }) => {
  await page.goto('/templates/forms/aof-commitment/edit?mode=edit')
  await expectRealContent(page.locator('.ProseMirror.rm-with-pagination').first())

  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByText('Duplicate form', { exact: true }).click()

  await expect(page.getByText(/Form duplicated/i).first()).toBeVisible()
  // duplicateThisForm() navigates straight into the new copy's own editor.
  await expect(page).toHaveURL(/\/templates\/forms\/(?!aof-commitment)[^/]+\/edit/, { timeout: 15000 })

  await expectRealContent(page.locator('.ProseMirror.rm-with-pagination').first())
})

test('duplicating a form from the templates list (without ever opening its own editor first) still carries over its real content', async ({ page }) => {
  // A fresh browser context/page never visited this form's own editor, so
  // this exercises the second bug above specifically - the migration has
  // to run lazily off the *list* entry point, not only edit.vue's.
  await page.goto('/templates?tab=forms')
  await expect(page.getByText('Asset Deployment Acknowledgement & Commitment Form')).toBeVisible()

  const link = page.getByRole('link', { name: /^Asset Deployment Acknowledgement & Commitment Form /, exact: false }).first()
  const row = link.locator('xpath=..')
  await row.hover()
  // The row's action icons are opacity-0 until hover (a Tailwind `group`
  // reveal). Real hover + a couple of retried clicks is more reliable here
  // than a single `force: true` click - this specific hover-reveal timing
  // has been flaky under automation even with force, in a way it isn't for
  // a plain always-visible button elsewhere in this app.
  const duplicateBtn = row.getByRole('button', { name: 'Duplicate' }).first()
  await expect(duplicateBtn).toBeVisible({ timeout: 10000 })
  await duplicateBtn.click({ force: true })

  const copyLink = page.getByRole('link', { name: /^Asset Deployment Acknowledgement & Commitment Form \(copy\)/ }).first()
  const appeared = await copyLink.isVisible({ timeout: 8000 }).catch(() => false)
  if (!appeared) {
    // The click didn't register the first time - retry once for real
    // rather than fail on what's demonstrably a hover-timing flake, not a
    // functional bug (see the other test above, and this same flow
    // verified manually).
    await row.hover()
    await duplicateBtn.click({ force: true })
  }
  await expect(copyLink).toBeVisible({ timeout: 15000 })

  await copyLink.click()
  await expectRealContent(page.locator('.ProseMirror.rm-with-pagination').first())
})
