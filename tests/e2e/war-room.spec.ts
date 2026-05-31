import { expect, test } from "@playwright/test"
import path from "node:path"
import { authSkipReason, hasAuthCredentials, loginViaUi } from "./helpers/auth"
import { mockWarRoomVisionApiResponse } from "./helpers/war-room-ai-mock"

test.describe("War Room chart upload & analyze", () => {
  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/war-room")
    await expect(page).toHaveURL(/\/auth\/login/)
  })

  test.describe("authenticated", () => {
    test.skip(!hasAuthCredentials, authSkipReason)

    test.beforeEach(async ({ page }) => {
      // Real AI only runs in staging/manual QA
      await page.route("**/api/strategy-brain/war-room-vision", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockWarRoomVisionApiResponse()),
        })
      })

      await loginViaUi(page, "/war-room")
    })

    test("loads Weekly War Room page", async ({ page }) => {
      await expect(page.getByRole("heading", { name: "Weekly War Room" })).toBeVisible({
        timeout: 15_000,
      })
      await expect(page.getByText(/Timeframe charts/i)).toBeVisible()
    })

    test("uploads a chart and enables analyze action", async ({ page }) => {
      await expect(page.getByRole("heading", { name: "Weekly War Room" })).toBeVisible({
        timeout: 15_000,
      })

      const addChartsButton = page.getByRole("button", { name: /Add charts/i }).first()
      await expect(addChartsButton).toBeVisible()

      const fileInput = page.locator('input[type="file"][accept*="image"]').first()
      const fixturePath = path.join(__dirname, "fixtures", "sample-chart.png")

      await fileInput.setInputFiles(fixturePath)
      await expect(page.getByAltText("Chart 1")).toBeVisible({ timeout: 15_000 })

      const analyzeButton = page.getByRole("button", { name: /Analyze & autofill/i }).first()
      await expect(analyzeButton).toBeEnabled()
      await analyzeButton.click()

      await expect(page.getByText(/Grade A/i).first()).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/EURUSD/i).first()).toBeVisible()
    })
  })
})
