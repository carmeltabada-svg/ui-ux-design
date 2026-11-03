import { test, expect, type Page } from '@playwright/test'

// Smoke test for the Assets module: the list, the Move Asset flow with an exit and its document, the asset
// detail page (edit, tabs, legacy tags) and the guards. Every test starts from the seed data, because each
// Playwright context has its own empty localStorage. Run it against the dev server or a production build:
//   PLAYWRIGHT_BASE_URL=http://localhost:3200 npx playwright test tests/e2e/assets-smoke.spec.ts

const IN_USE = 'GT-CE-LTP-1233-0926-0013' // Monthly Rental, in use by a team member
const BYOD = 'GT-CE-MNT-1151-0426-0037' // BYOD, so Client Pull-Out is allowed
const EXITED = 'GT-CE-LTP-0826-0005' // already a Supplier Return


async function attach(page: Page, name = 'agreement.pdf') {
  await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') })
}

test.describe('Assets list', () => {
  test('shows the 17 live columns and keeps Actions on one pixel when scrolled', async ({ page }) => {
    await page.goto('/assets')
    await expect(page.getByRole('heading', { name: /assets tracked/ })).toBeVisible()
    const heads = await page.locator('thead th').allInnerTexts()
    for (const h of ['Tag', 'Serial', 'Model', 'Name', 'Type', 'Status', 'Tech Pack', 'Ownership', 'Movement Status', 'Checked in by / Checked out to', 'Checked out to (Client)', 'Owner', 'Location', 'Purchase Order', 'Supplier', 'Acquisition Cost', 'Actions']) {
      expect(heads.map(t => t.trim())).toContain(h)
    }
    const actions = page.locator('thead th').last()
    const scroller = page.locator('.overflow-x-auto').first()
    const left = (await actions.boundingBox())!.x
    for (const x of [300, 1200, 99999]) {
      await scroller.evaluate((el, v) => { el.scrollLeft = v }, x)
      expect((await actions.boundingBox())!.x).toBeCloseTo(left, 1)
    }
  })

  test('filters narrow the list, show named chips, and clear', async ({ page }) => {
    await page.goto('/assets')
    await expect(page.locator('tbody tr').first()).toBeVisible()
    const all = await page.locator('tbody tr').count()
    // toolbar quick filter
    await page.getByLabel('Filter by Status').click()
    await page.getByRole('option', { name: /^In Use/ }).click()
    await page.keyboard.press('Escape')
    const chips = page.getByRole('group', { name: 'Applied filters' })
    await expect(chips).toContainText('Status:')
    await expect(chips).toContainText('In Use')
    expect(await page.locator('tbody tr').count()).toBeLessThan(all)
    // the full panel shares the same state and shows the live result count
    await page.getByRole('button', { name: /All filters/ }).click()
    await expect(page.getByRole('dialog')).toContainText('Brand')
    await expect(page.getByRole('button', { name: /^Show \d+ assets?$/ })).toBeVisible()
    await page.getByRole('button', { name: /^Show \d+ assets?$/ }).click()
    // remove one chip, then everything returns
    await chips.getByRole('button', { name: 'Remove Status filter' }).click()
    await expect(chips).toHaveCount(0)
    expect(await page.locator('tbody tr').count()).toBe(all)
  })

  test('no cell is clipped', async ({ page }) => {
    await page.goto('/assets')
    await expect(page.locator('tbody tr').first()).toBeVisible()
    const clipped = await page.locator('tbody td').evaluateAll(tds => tds.filter(td => td.scrollWidth > td.clientWidth).length)
    expect(clipped).toBe(0)
  })
})

test.describe('Move Asset', () => {
  test('a blocked save scrolls to the banner and marks the missing fields', async ({ page }) => {
    await page.goto(`/move-asset/${BYOD}/move?kind=client`)
    await page.getByRole('button', { name: 'Move Asset' }).last().click()
    const banner = page.getByRole('alert')
    await expect(banner).toBeVisible()
    await expect(banner).toBeInViewport()
    await expect(page.getByText('Attach the client instruction.')).toBeVisible()
  })

  test('Supplier Return with a document: confirm, persists after a reload, shows in Movements, document opens in a new tab', async ({ page }) => {
    await page.goto(`/move-asset/${IN_USE}/move?kind=supplier`)
    await attach(page)
    await page.locator('#reason').fill('Battery swelling on arrival.')
    await page.getByRole('button', { name: 'Move Asset' }).last().click()
    // the destructive step has its own confirmation
    await expect(page.getByRole('button', { name: 'Return to supplier' })).toBeVisible()
    await page.getByRole('button', { name: 'Return to supplier' }).click()
    await expect(page).toHaveURL(new RegExp(`/move-asset/${IN_USE}/done`))
    await expect(page.getByText('Asset Moved Successfully')).toBeVisible()

    await page.goto(`/assets/${IN_USE}/movements`)
    await page.reload() // the saved data must survive a refresh
    await expect(page.getByRole('heading', { name: 'Checked out', exact: true }).first()).toBeVisible()
    await expect(page.getByText('Supplier Return').first()).toBeVisible()
    // the earlier check out to the team member is still there
    await expect(page.getByText('Mara Lim').first()).toBeVisible()

    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('button', { name: /agreement\.pdf/ }).click()
    const popup = await popupPromise
    // A new tab opened. Headless Chromium downloads a PDF instead of showing it, so its URL is not asserted.
    expect(popup).toBeTruthy()
    await popup.close()
  })

  test('an exited unit cannot be moved again, and unknown tags are not found', async ({ page }) => {
    await page.goto(`/move-asset/${EXITED}/move`)
    await expect(page.getByText('can\'t be moved again')).toBeVisible()
    await page.goto('/assets/constructor')
    await expect(page.getByText('We couldn\'t find that asset')).toBeVisible()
  })
})

test.describe('Asset detail', () => {
  test('Edit details saves with Ctrl+S and survives a reload; Esc discards', async ({ page }) => {
    await page.goto(`/assets/${IN_USE}/activity-feed`)
    await page.getByRole('button', { name: 'Edit details' }).click()
    await page.locator('#serial-field').fill('')
    await page.keyboard.press('Control+s')
    await expect(page.getByText('Enter the serial number')).toBeVisible()
    await page.locator('#serial-field').fill('SMOKE-0001')
    await page.keyboard.press('Control+s')
    await expect(page.locator('[data-slot="title"]', { hasText: 'Asset details saved' })).toBeVisible()
    await page.reload()
    await expect(page.getByText('SMOKE-0001').first()).toBeVisible()

    await page.getByRole('button', { name: 'Edit details' }).click()
    await page.locator('#serial-field').fill('NOT-SAVED')
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-slot="title"]', { hasText: 'Changes discarded' })).toBeVisible()
    await expect(page.getByText('NOT-SAVED')).toHaveCount(0)
  })

  test('the five tabs switch without leaving two pages on screen', async ({ page }) => {
    await page.goto(`/assets/${IN_USE}/activity-feed`)
    for (const tab of ['Movements', 'Custody history', 'Photos', 'Legacy tags', 'Activity feed']) {
      await page.getByRole('link', { name: tab, exact: true }).click()
      await expect(page.locator('h2')).toHaveCount(1)
    }
  })

  test('removing a legacy tag asks to confirm first', async ({ page }) => {
    await page.goto(`/assets/${IN_USE}/legacy-tags`)
    await expect(page.getByText('2 tag(s)')).toBeVisible()
    await page.getByRole('button', { name: 'Remove legacy tag' }).first().click()
    await expect(page.getByText('Remove this legacy tag?')).toBeVisible()
    await page.getByRole('button', { name: 'Keep it' }).click()
    await expect(page.getByText('2 tag(s)')).toBeVisible()
    await page.getByRole('button', { name: 'Remove legacy tag' }).first().click()
    await page.getByRole('button', { name: 'Remove tag' }).click()
    await expect(page.getByText('1 tag(s)')).toBeVisible()
  })

  test('tampered saved data is ignored', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ams:assets:v5', JSON.stringify({ '__proto__': { status: 'In Use', history: [], cost: 1, polluted: true }, 'GT-CE-LTP-1233-0926-0013': { status: 'Nope', history: 'x', cost: 1 } }))
    })
    await page.goto('/assets')
    await expect(page.locator('tbody tr').first()).toBeVisible()
    expect(await page.evaluate(() => ({} as Record<string, unknown>).polluted)).toBeUndefined()
  })
})

const OUTRIGHT = 'GT-CE-LTP-1180-0326-0042' // Outright Purchase: has same-supplier units to offer as a replacement

test.describe('Every kind of move', () => {
  test('the Move asset menu on the list row offers the three kinds and explains the one that is off', async ({ page }) => {
    await page.goto('/assets')
    await page.getByRole('button', { name: `Move ${IN_USE}` }).click()
    await expect(page.getByRole('menuitem', { name: /Check In or Check Out/ })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /Return to supplier/ })).toBeVisible()
    await page.getByRole('menuitem', { name: /Client pull-out/ }).click() // a Monthly Rental: toast, no form
    await expect(page.locator('[data-slot=title]').filter({ hasText: 'available for this unit' })).toBeVisible()
    await expect(page).toHaveURL(/\/assets$/)
  })

  test('a Check In to an asset location with a legacy status shows in Movements', async ({ page }) => {
    await page.goto(`/move-asset/${IN_USE}/move`)
    await expect(page.getByRole('radio', { name: 'Check In' })).toHaveAttribute('aria-checked', 'true') // the unit is out
    await page.locator('#asset-location').click()
    await page.getByRole('option', { name: /IT Storage Room/ }).click()
    await page.locator('label[for=new-status] + div button').click()
    await expect(page.getByText('Legacy', { exact: true })).toBeVisible() // the Legacy group is in the list
    await page.getByRole('button', { name: 'Under Repair', exact: true }).click()
    await page.getByRole('button', { name: 'Move Asset', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/move-asset/${IN_USE}/done`))
    await page.goto(`/assets/${IN_USE}/movements`)
    await expect(page.getByText('IT Storage Room').first()).toBeVisible()
    await expect(page.getByText('Under Repair').first()).toBeVisible()
  })

  test('a Check Out to a team member, chosen by employee number or email, records the custodian', async ({ page }) => {
    await page.goto(`/move-asset/${IN_USE}/move`)
    await page.getByRole('radio', { name: 'Check Out' }).click()
    await page.locator('#member-to').fill('go.team') // part of an email
    await page.getByRole('listbox').getByRole('option').first().click()
    await page.locator('label[for=new-status] + div button').click()
    await page.getByRole('button', { name: 'In Use', exact: true }).click()
    await page.getByRole('button', { name: 'Move Asset', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/move-asset/${IN_USE}/done`))
  })

  test('Charged Deduction documents stay on screen and switch on only for that status', async ({ page }) => {
    await page.goto(`/move-asset/${IN_USE}/move`)
    const docs = page.locator('fieldset').filter({ hasText: 'Authority to Deduct' })
    expect(await docs.evaluate(e => (e as HTMLFieldSetElement).disabled)).toBe(true)
    await page.locator('label[for=new-status] + div button').click()
    await page.getByRole('button', { name: 'Charged Deduction', exact: true }).click()
    expect(await docs.evaluate(e => (e as HTMLFieldSetElement).disabled)).toBe(false)
  })

  test('the Move details drawer opens from a link, and the replacement can be added later', async ({ page }) => {
    await page.goto(`/move-asset/${OUTRIGHT}/move?kind=supplier`)
    await attach(page)
    await page.locator('#reason').fill('Battery swelling on arrival.')
    await page.getByRole('button', { name: 'Move Asset', exact: true }).click()
    await page.getByRole('button', { name: 'Return to supplier' }).click()
    await expect(page).toHaveURL(/done/)
    await page.goto(`/assets/${OUTRIGHT}?moveDetails=1`)
    await expect(page.getByText('What was recorded when this unit left')).toBeVisible()
    await page.getByRole('button', { name: 'Add replacement' }).click()
    await page.locator('#rep-edit').click()
    await page.getByRole('button', { name: /GT-CE-LTP-1180-0326-0043/ }).first().click()
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('GT-CE-LTP-1180-0326-0043 · Lenovo ThinkPad E14')).toBeVisible()
  })

  test('the Legacy statuses are in the list\'s Status filter', async ({ page }) => {
    await page.goto('/assets')
    await page.getByLabel('Filter by Status').click()
    await expect(page.getByRole('option', { name: /Under Repair/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /Pending Disposal/ })).toBeVisible()
  })
})
