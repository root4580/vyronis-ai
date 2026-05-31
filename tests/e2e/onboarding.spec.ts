import { expect, test } from "@playwright/test"
import { authSkipReason, hasAuthCredentials, loginViaUi } from "./helpers/auth"

test.describe("Onboarding war room", () => {
  test("redirects unauthenticated users from HQ to login", async ({ page }) => {
    await page.goto("/hq")
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test.describe("authenticated", () => {
    test.skip(!hasAuthCredentials, authSkipReason)

    test.beforeEach(async ({ page }) => {
      await loginViaUi(page, "/hq")
    })

    test("shows first-run setup or dashboard shell", async ({ page }) => {
      const firstRunHeading = page.getByRole("heading", { name: "Account size" })
      const dashboardShell = page.getByLabel("Today").or(page.getByText("Welcome to Vyronis HQ"))

      await expect(firstRunHeading.or(dashboardShell)).toBeVisible({ timeout: 15_000 })
    })

    test("completes first-run setup steps when onboarding modal is shown", async ({ page }) => {
      const firstRunHeading = page.getByRole("heading", { name: "Account size" })
      if (!(await firstRunHeading.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip(true, "Onboarding already completed for this account.")
      }

      await expect(page.getByText("Step 1 of 3")).toBeVisible()
      await page.getByRole("button", { name: "Continue" }).click()

      await expect(page.getByRole("heading", { name: "Max risk per trade" })).toBeVisible()
      await expect(page.getByText("Step 2 of 3")).toBeVisible()
      await page.getByRole("button", { name: "Continue" }).click()

      await expect(page.getByRole("heading", { name: "Preferred session" })).toBeVisible()
      await expect(page.getByText("Step 3 of 3")).toBeVisible()
      await expect(page.getByRole("button", { name: "Set up War Room" })).toBeVisible()
      await expect(page.getByRole("button", { name: "Skip for now" })).toBeVisible()
    })

    test("can open War Room from onboarding finish action", async ({ page }) => {
      const firstRunHeading = page.getByRole("heading", { name: "Account size" })
      if (!(await firstRunHeading.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip(true, "Onboarding already completed for this account.")
      }

      await page.getByRole("button", { name: "Continue" }).click()
      await page.getByRole("button", { name: "Continue" }).click()
      await page.getByRole("button", { name: "Set up War Room" }).click()

      await expect(page).toHaveURL(/\/war-room/)
      await expect(page.getByRole("heading", { name: "Weekly War Room" })).toBeVisible({
        timeout: 15_000,
      })
    })
  })
})
