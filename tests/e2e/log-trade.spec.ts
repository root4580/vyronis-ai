import { expect, test } from "@playwright/test"
import { authSkipReason, hasAuthCredentials, loginViaUi } from "./helpers/auth"

test.describe("Log trade flow", () => {
  test("redirects unauthenticated users from HQ to login", async ({ page }) => {
    await page.goto("/hq?action=new-trade")
    await expect(page).toHaveURL(/\/auth\/login/)
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
  })

  test.describe("authenticated", () => {
    test.skip(!hasAuthCredentials, authSkipReason)

    test.beforeEach(async ({ page }) => {
      await loginViaUi(page, "/hq?action=new-trade")
    })

    test("opens add trade modal from HQ deep link", async ({ page }) => {
      await expect(page.getByRole("dialog")).toBeVisible()
      await expect(page.getByRole("heading", { name: /Add Trade|Plan Setup|Log Result/ })).toBeVisible()
      await expect(page.getByRole("tablist", { name: "Trade journal mode" })).toBeVisible()
    })

    test("shows core trade form fields", async ({ page }) => {
      await expect(page.getByRole("dialog")).toBeVisible()
      await expect(page.getByText("Market Setup", { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: /Save trade|Save setup & score/ })).toBeVisible()
    })

    test("log trade save shows Vyronis score modal", async ({ page }) => {
      await expect(page.getByRole("dialog")).toBeVisible()
      await page.getByRole("tab", { name: "Log result" }).click()

      await page.getByRole("combobox").first().click()
      await page.getByRole("option", { name: "EURUSD" }).click()
      await page.getByRole("button", { name: "BUY" }).click()
      await page.getByRole("button", { name: "WIN", exact: true }).click()
      await page.getByPlaceholder("150.00").fill("120")

      await page.getByRole("button", { name: "Save trade" }).click()

      await expect(page.getByRole("dialog", { name: /Vyronis journal intelligence/i })).toBeVisible({
        timeout: 15_000,
      })
      await expect(page.getByRole("button", { name: "Share result" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Done" })).toBeVisible()
    })
  })
})
