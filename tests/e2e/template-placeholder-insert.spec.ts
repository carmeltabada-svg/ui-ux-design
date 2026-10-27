import { test, expect, type Page } from '@playwright/test'

// Placeholder insertion in the email template editor:
// 1. the subject line has its own Insert placeholder button,
// 2. a placeholder goes at the author's cursor (not the end of the body),
// 3. with no cursor placed, nothing is inserted and a toast says so,
// 4. the drawer stays open so several placeholders can be inserted in a row.

const subjectInput = (page: Page) => page.getByRole('textbox', { name: 'Subject line' })

const noCursorToast = (page: Page) => page.locator('[data-slot="title"]', { hasText: 'No active cursor' })

const URL = '/templates/email/t1/edit?mode=edit'

async function openEditor(page: Page) {
  await page.goto(URL)
  await expect(subjectInput(page)).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 30000 })
}


test('subject line: no cursor means no insert and a toast; with a cursor it inserts at the cursor, several in a row', async ({ page }) => {
  await openEditor(page)
  await subjectInput(page).fill('Hello world')
  // Leave the field without ever clicking into it again this session: reload edit mode to reset the cursor state.
  await openEditor(page)
  const original = await subjectInput(page).inputValue()

  await page.getByRole('button', { name: 'Insert placeholder into the subject line' }).click()
  await page.getByText('Team member full name', { exact: true }).first().click()
  await expect(noCursorToast(page)).toBeVisible()
  expect(await subjectInput(page).inputValue()).toBe(original)

  // Place a cursor after "Notice" (or at the end if the subject is shorter), then insert two in a row.
  await page.locator('button[aria-label="Close"]:not([data-slot="close"])').click()
  await subjectInput(page).fill('AB')
  await subjectInput(page).press('Home')
  await subjectInput(page).press('ArrowRight')
  await page.getByRole('button', { name: 'Insert placeholder into the subject line' }).click()
  await page.getByText('Team member full name', { exact: true }).first().click()
  await page.getByText('Employee ID', { exact: true }).first().click()
  await expect(subjectInput(page)).toHaveValue('A{{TM_FULL_NAME}}{{EMPLOYEE_ID}}B')
  // The drawer is still open after inserting.
  await expect(page.getByText('Placeholder Library')).toBeVisible()
})

test('body: a placeholder lands at the cursor, not at the end', async ({ page }) => {
  await openEditor(page)
  const body = page.locator('.ProseMirror').first()
  await body.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('FirstSecond')
  // Put the cursor between "First" and "Second".
  await page.keyboard.press('Home')
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')

  await page.getByRole('button', { name: 'Insert placeholder', exact: true }).click()
  await page.getByText('Team member full name', { exact: true }).first().click()
  await page.getByText('Employee ID', { exact: true }).first().click()

  await expect(body).toContainText('First{{TM_FULL_NAME}}{{EMPLOYEE_ID}}Second')
  await expect(page.getByText('Placeholder Library')).toBeVisible()
})

test('body: with no cursor placed, nothing is inserted and a toast says so', async ({ page }) => {
  await openEditor(page)
  const body = page.locator('.ProseMirror').first()
  const before = await body.innerText()

  await page.getByRole('button', { name: 'Insert placeholder', exact: true }).click()
  await page.getByText('Team member full name', { exact: true }).first().click()

  await expect(noCursorToast(page)).toBeVisible()
  expect(await body.innerText()).toBe(before)
})

test('subject: undo and redo work after inserting a placeholder', async ({ page }) => {
  await openEditor(page)
  await subjectInput(page).fill('AB')
  await subjectInput(page).press('Home')
  await subjectInput(page).press('ArrowRight')
  await page.getByRole('button', { name: 'Insert placeholder into the subject line' }).click()
  await page.getByText('Team member full name', { exact: true }).first().click()
  await expect(subjectInput(page)).toHaveValue('A{{TM_FULL_NAME}}B')

  // Undo takes the placeholder back out (a couple of presses at most, depending on how the browser groups the edit).
  for (let i = 0; i < 3 && (await subjectInput(page).inputValue()) !== 'AB'; i++) await page.keyboard.press('ControlOrMeta+z')
  await expect(subjectInput(page)).toHaveValue('AB')

  // Redo puts it back.
  for (let i = 0; i < 3 && (await subjectInput(page).inputValue()) !== 'A{{TM_FULL_NAME}}B'; i++) await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(subjectInput(page)).toHaveValue('A{{TM_FULL_NAME}}B')
})
