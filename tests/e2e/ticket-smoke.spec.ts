import { test, expect, type Page } from '@playwright/test'

// Smoke test of the retrieval ticket's core flow, run against a running dev or preview server
// (PLAYWRIGHT_BASE_URL). A new browser context starts from the shipped demo data, so every run is
// independent:
//   1. create a ticket for a team member who has no open ticket,
//   2. reload the page and confirm the new ticket survived (it is kept by the data layer, not by the page),
//   3. confirm "Take over ticket" is disabled for the person who owns the ticket,
//   4. run one destructive action (Cancel retrieval) with its confirm modal: dismissing it changes
//      nothing, confirming it cancels the ticket.

async function pickTeamMember(page: Page, name: string) {
  const search = page.getByRole('combobox', { name: 'Find team member' })
  await search.click()
  await search.fill(name.split(' ')[0]!)
  await page.getByRole('option', { name: new RegExp(name) }).first().click()
  await expect(page.getByText(name).first()).toBeVisible()
}

async function fillEndorsementIfRequired(page: Page) {
  const endorsement = page.getByRole('textbox', { name: 'Authorizing endorsement' })
  if (!(await endorsement.isVisible())) return
  await endorsement.fill('P&C-END-2026-0001')
  // The Recorded Date must come before the Separation Date.
  const group = page.getByText('Endorsement Recorded Date').locator('xpath=ancestor::div[1]')
  await group.getByRole('spinbutton', { name: /month/i }).click()
  await page.keyboard.type('09012026')
}

async function openMoreOptions(page: Page) {
  await page.getByRole('button', { name: 'More options' }).click()
}

test('create a ticket, keep it across a reload, then cancel it with a confirm modal', async ({ page }) => {
  await page.goto('/ticket-tracker/create')
  await pickTeamMember(page, 'Kevin Ong')
  await fillEndorsementIfRequired(page)

  const create = page.getByRole('button', { name: 'Create Retrieval Ticket' })
  await expect(create).not.toHaveAttribute('aria-disabled', 'true', { timeout: 10000 })
  await create.click()
  await page.waitForURL(/\/ticket-tracker\/\d+$/, { timeout: 20000 })
  const ticketUrl = page.url()
  await expect(page.getByText('Kevin Ong').first()).toBeVisible()
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible()

  // Created data survives a reload.
  await page.reload()
  await expect(page).toHaveURL(ticketUrl)
  await expect(page.getByText('Kevin Ong').first()).toBeVisible({ timeout: 20000 })

  // The creator owns the ticket, so taking it over makes no sense and is disabled.
  await openMoreOptions(page)
  const takeOver = page.getByRole('menuitem', { name: /Take over ticket/ })
  await expect(takeOver).toHaveAttribute('aria-disabled', 'true')
  // The item is marked disabled for assistive technology but stays clickable on purpose, so a click
  // explains itself with a toast. Playwright waits for "enabled" unless the click is forced.
  await takeOver.click({ force: true })
  await expect(page.getByText('You are already the assignee of this ticket.').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Take over this ticket' })).toHaveCount(0)

  // Destructive action: dismissing the confirm modal changes nothing.
  await openMoreOptions(page)
  await page.getByRole('menuitem', { name: 'Cancel retrieval' }).click()
  const modal = page.getByRole('dialog')
  await expect(modal.getByRole('heading', { name: 'Cancel retrieval' })).toBeVisible()
  await modal.getByRole('button', { name: 'Keep ticket' }).click()
  await expect(modal).toHaveCount(0)
  await expect(page.getByText('Retrieval cancelled')).toHaveCount(0)

  // Confirming needs a note, then cancels the ticket and says so.
  await openMoreOptions(page)
  await page.getByRole('menuitem', { name: 'Cancel retrieval' }).click()
  const confirmModal = page.getByRole('dialog')
  await confirmModal.getByRole('button', { name: 'Cancel retrieval' }).click()
  await expect(confirmModal.getByText(/note/i).first()).toBeVisible()
  await confirmModal.getByRole('textbox').fill('Confirmed with the team member by phone')
  await confirmModal.getByRole('button', { name: 'Cancel retrieval' }).click()
  await expect(page.getByText('Retrieval cancelled').first()).toBeVisible({ timeout: 10000 })
})
