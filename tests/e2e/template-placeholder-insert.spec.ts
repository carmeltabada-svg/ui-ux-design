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

const drawerTitle = (page: Page) => page.getByText('Placeholder Library')
const tokenRow = (page: Page, name: string) => page.getByRole('button', { name: new RegExp(name) }).first()

test('a refused insert is never marked Added', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('button', { name: 'Insert placeholder', exact: true }).click()
  await tokenRow(page, 'Team member full name').click()
  await expect(noCursorToast(page)).toBeVisible()
  await expect(page.getByText(/\d+ added\./)).toHaveCount(0)
  await expect(page.getByText('Added', { exact: true })).toHaveCount(0)
})

test('subject by keyboard: focus stays on the token row, so Enter inserts again', async ({ page }) => {
  await openEditor(page)
  await subjectInput(page).fill('AB')
  await subjectInput(page).press('Home')
  await subjectInput(page).press('ArrowRight')
  await subjectInput(page).press('Shift+Tab')
  await page.keyboard.press('Enter')
  await expect(drawerTitle(page)).toBeVisible()
  await tokenRow(page, 'Team member full name').focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await expect(subjectInput(page)).toHaveValue('A{{TM_FULL_NAME}}{{TM_FULL_NAME}}B')
  await expect(tokenRow(page, 'Team member full name')).toBeFocused()
})

test('added text meets contrast and the counts agree', async ({ page }) => {
  await openEditor(page)
  await subjectInput(page).click()
  await subjectInput(page).press('End')
  await page.getByRole('button', { name: 'Insert placeholder into the subject line' }).click()
  const header = page.locator('span').filter({ hasText: 'Used in this template' })
  const chip = page.getByRole('button', { name: /Used in template/ })
  const before = (await chip.innerText()).replace(/\D/g, '')
  await tokenRow(page, 'Contact number').click()
  const status = page.getByRole('status').filter({ hasText: 'added.' })
  await expect(status).toBeVisible()
  // the 600-shade green (#007f45) on white is above 4.5:1
  await expect(status).toHaveCSS('color', 'rgb(0, 127, 69)')
  expect((await chip.innerText()).replace(/\D/g, '')).toBe(before)
  expect((await header.locator('xpath=following-sibling::*').first().innerText()).trim()).toBe(before)
})

test('Escape closes the drawer from inside it; the trigger gets focus back', async ({ page }) => {
  await openEditor(page)
  const trigger = page.getByRole('button', { name: 'Insert placeholder into the subject line' })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(drawerTitle(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawerTitle(page)).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('subject button tooltip says the same as its label', async ({ page }) => {
  await openEditor(page)
  await page.getByRole('button', { name: 'Insert placeholder into the subject line' }).focus()
  await expect(page.getByText('Insert placeholder into the subject line', { exact: true }).first()).toBeVisible()
})

test('phone: the drawer is a bottom sheet and the subject stays clickable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await openEditor(page)
  await subjectInput(page).fill('AB')
  await page.getByRole('button', { name: 'Insert placeholder into the subject line' }).click()
  await expect(drawerTitle(page)).toBeVisible()
  const box = await page.locator('[role="dialog"]').boundingBox()
  expect(box!.y).toBeGreaterThan(300)
  expect(box!.width).toBeGreaterThan(320)
  // The author scrolls the field into the free area above the sheet, then clicks it.
  await subjectInput(page).evaluate(el => el.scrollIntoView({ block: 'start' }))
  await subjectInput(page).click()
  await subjectInput(page).press('End')
  await tokenRow(page, 'Employee ID').click()
  await expect(subjectInput(page)).toHaveValue('AB{{EMPLOYEE_ID}}')
})
