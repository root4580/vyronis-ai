import type { Page } from "@playwright/test"

export const E2E_EMAIL = process.env.E2E_EMAIL ?? ""
export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? ""
export const hasAuthCredentials = Boolean(E2E_EMAIL && E2E_PASSWORD)

export const authSkipReason =
  "Set E2E_EMAIL and E2E_PASSWORD to run authenticated smoke tests."

export async function loginViaUi(page: Page, nextPath = "/hq") {
  await page.goto(`/auth/login?next=${encodeURIComponent(nextPath)}`)
  await page.getByLabel("Email").fill(E2E_EMAIL)
  await page.getByLabel("Password").fill(E2E_PASSWORD)
  await page.getByRole("button", { name: "Access Dashboard" }).click()
  await page.waitForURL(new RegExp(nextPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
}
