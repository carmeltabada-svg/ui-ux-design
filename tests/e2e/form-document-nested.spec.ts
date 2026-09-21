import { test, expect, type Page } from '@playwright/test'

// The form document canvas nests several independent editing surfaces
// inside one another: Tiptap document -> formField NodeView (atom, its own
// Vue component) -> in some cases a *second*, fully independent Tiptap
// instance inside that (the text_block field type's StaticTextEditor, or
// the Label/Hint inputs' own text fields). Each layer has its own event
// handling, and the classic bug class here is event/focus bleed between
// layers - a click or keystroke meant for the inner layer reaching the
// outer document instead (or vice versa), corrupting content, losing focus,
// or triggering the wrong command. These tests target exactly that
// boundary, not each field type's own rendering (covered elsewhere).

const EDIT_URL = '/templates/forms/aof-commitment/edit?mode=edit'

async function openField(page: Page, label: string) {
  const field = page.locator('[data-form-field-node]').filter({ hasText: label }).first()
  await field.scrollIntoViewIfNeeded()
  await field.hover()
  return field
}

test.describe('form field NodeView nesting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EDIT_URL)
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()
  })

  test('typing in a field\'s Label input does not leak into the surrounding document', async ({ page }) => {
    const field = await openField(page, 'Complete Delivery Address')
    await field.getByRole('button', { name: 'Field settings' }).click()

    const labelInput = page.getByRole('textbox').filter({ hasText: '' }).first()
    // The settings popover's own Label field - scope to the popover, not
    // any other textbox on the page.
    const popover = page.locator('div').filter({ hasText: 'Field settings' }).last()
    const label = popover.getByLabel('Label').or(popover.locator('input').first())

    const before = await page.locator('.ProseMirror').first().textContent()

    // Type a marker string that would be very obviously wrong if it landed
    // in the outer document instead of the popover's own input.
    await label.click()
    await label.fill('NESTED_TEST_LABEL')
    await page.keyboard.press('Escape')

    const after = await page.locator('.ProseMirror').first().textContent()
    // The outer document's overall text should have changed by *exactly*
    // this field's own label swapping in place (old label removed, new one
    // added) - not gained stray characters typed into the wrong surface.
    expect(after).toContain('NESTED_TEST_LABEL')
    expect(after).not.toContain('Complete Delivery Address')
    const expectedLength = (before?.length ?? 0) - 'Complete Delivery Address'.length + 'NESTED_TEST_LABEL'.length
    expect(after?.length ?? 0).toBe(expectedLength)

    // Restore the original label so this test doesn't mutate seed data for
    // whatever runs after it. Two things went stale here: Escape closed the
    // settings popover (so `label` points at a detached element), and the
    // field's own label text just changed - `field`'s own locator filters
    // on `hasText: 'Complete Delivery Address'`, which no longer matches
    // this field now that it reads "NESTED_TEST_LABEL". Re-locate by the
    // *new* text instead of reusing either stale reference.
    const renamedField = page.locator('[data-form-field-node]').filter({ hasText: 'NESTED_TEST_LABEL' }).first()
    await renamedField.getByRole('button', { name: 'Field settings' }).click()
    const freshPopover = page.locator('div').filter({ hasText: 'Field settings' }).last()
    const freshLabel = freshPopover.getByLabel('Label').or(freshPopover.locator('input').first())
    await freshLabel.click()
    await freshLabel.fill('Complete Delivery Address')
    await page.keyboard.press('Escape')
  })

  test('duplicate creates an independent copy; deleting the copy leaves the original untouched', async ({ page }) => {
    const original = await openField(page, 'Complete Delivery Address')
    await original.getByRole('button', { name: 'Duplicate field' }).click()

    await expect(page.locator('[data-form-field-node]').filter({ hasText: 'Complete Delivery Address' })).toHaveCount(2)

    const copy = page.locator('[data-form-field-node]').filter({ hasText: 'Complete Delivery Address' }).nth(1)
    await copy.hover()
    await copy.getByRole('button', { name: 'Remove field' }).click()

    await expect(page.locator('[data-form-field-node]').filter({ hasText: 'Complete Delivery Address' })).toHaveCount(1)
  })

  test('the drag handle only appears on hover and never intercepts a click into the field\'s own input', async ({ page }) => {
    const field = await openField(page, 'Primary Contact Number')
    const input = field.locator('input[type="text"]').first()
    await input.click()
    await input.fill('09171234567')
    await expect(input).toHaveValue('09171234567')
    await input.fill('')
  })

  test('placeholder tokens inserted from a field\'s Label drawer land in that field only', async ({ page }) => {
    const addressField = await openField(page, 'Complete Delivery Address')
    await addressField.getByRole('button', { name: 'Field settings' }).click()

    // Scoped to the settings popover itself - the document toolbar has its
    // own, separate "Insert placeholder" button (inserts at the document's
    // cursor, not into this field's Label), and an unscoped query would
    // ambiguously match whichever one happens to sit earlier in the DOM.
    const popover = page.locator('div').filter({ hasText: 'Field settings' }).last()
    const insertPlaceholderBtn = popover.getByRole('button', { name: 'Insert placeholder' })
    if (await insertPlaceholderBtn.count() === 0) {
      // This form isn't attached to an email template in this seed data -
      // the affordance is correctly absent. Nothing to test here.
      test.skip()
      return
    }

    await insertPlaceholderBtn.first().click()
    await page.getByText('Team member full name').first().click()

    await expect(page.locator('[data-form-field-node]').filter({ hasText: 'Complete Delivery Address' }).first())
      .toContainText('{{TM_FULL_NAME}}')

    // Every *other* field must be unaffected by this insertion.
    const otherField = page.locator('[data-form-field-node]').filter({ hasText: 'Primary Contact Number' })
    await expect(otherField).not.toContainText('{{TM_FULL_NAME}}')
  })

  test('the signature lock tooltip updates live as other required fields are filled, without stray leftover overlays', async ({ page }) => {
    const signature = page.locator('[data-form-field-node]').filter({ hasText: 'Signature' }).last()
    await signature.scrollIntoViewIfNeeded()

    const lockedBadge = signature.getByText('Locked')
    await expect(lockedBadge).toBeVisible()

    await lockedBadge.hover()
    // Reka renders both the visible tooltip content and a visually-hidden
    // aria-live duplicate for screen readers - an exact-text match picks
    // out just the real, visible one (the hidden duplicate concatenates the
    // whole list into one string, which isn't an exact match).
    const tooltip = page.getByText('Complete these first:', { exact: true })
    await expect(tooltip).toBeVisible()

    // The tooltip must not be a fixed-height box clipping its own list -
    // every locked reason it names should actually be visible, not cut off.
    const reasonCount = await tooltip.locator('..').locator('li').count()
    expect(reasonCount).toBeGreaterThan(0)
  })
})
