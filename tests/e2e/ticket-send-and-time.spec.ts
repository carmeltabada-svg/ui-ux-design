import { test, expect, type Page } from '@playwright/test'

// Seed ticket 424 is a remote ticket waiting at Courier endorsement, a send step.
// Seed ticket 422 carries Activity Log entries stored as 2026-10-13T05:05:00Z.

async function openTicket(page: Page, number: number) {
  await page.goto(`/ticket-tracker/${number}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('h1')).toBeVisible({ timeout: 60000 })
}

test('a refused send changes nothing, and the same button retries it', async ({ page }) => {
  await openTicket(page, 424)
  const send = page.getByRole('button', { name: /Send Courier Endorsement/ })

  // Ask the mock mail server to refuse the next send (Simulation Control).
  await page.getByRole('button', { name: 'Simulate an employee record update' }).click()
  await page.getByRole('switch', { name: 'Fail the next email send' }).click()
  await page.keyboard.press('Escape')

  await send.click()
  await expect(send).toBeDisabled() // the Sending state
  const banner = page.locator('[role="alert"]', { hasText: 'Email not sent' }).first()
  await expect(banner).toContainText('Press Send again to retry')
  await expect(page.locator('[data-sent-banner]')).toHaveCount(0)

  await send.click()
  await expect(page.locator('[data-sent-banner]')).toContainText('Pickup endorsement sent')
  await expect(page.locator('[role="alert"]', { hasText: 'Press Send again to retry' })).toHaveCount(0)
})

for (const [timezoneId, expected] of [
  ['Asia/Manila', '1:05 PM'],
  ['UTC', '5:05 AM'],
  ['America/Los_Angeles', '10:05 PM']
] as const) {
  test(`stored times show in the viewer's time zone: ${timezoneId}`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId, locale: 'en-US' })
    const page = await context.newPage()
    await openTicket(page, 422)
    await page.locator('button[aria-haspopup="menu"]').last().click()
    await page.getByRole('menuitem', { name: /Activity Log/ }).click()
    await expect(page.getByRole('dialog')).toContainText(expected)
    await context.close()
  })
}
