import { expect, test } from "@playwright/test"

test.describe("public smoke coverage", () => {
    test("landing page renders its primary call to action", async ({ page }) => {
        await page.goto("/")

        await expect(page.getByRole("main")).toBeVisible()
        await expect(
            page.getByRole("heading", { name: /make every service feel/i })
        ).toBeVisible()
        const landingCta = page.getByRole("link", { name: /open your restaurant desk/i })
        await expect(landingCta).toHaveAttribute("href", "/dashboard")
        expect(await landingCta.evaluate((element) => element.tabIndex)).toBeGreaterThanOrEqual(0)
        await landingCta.focus()
        await expect(landingCta).toBeFocused()
    })

    test("invalid QR route remains a public, unavailable menu response", async ({
        page,
        request,
    }) => {
        const response = await request.get("/s/invalid-restaurant/t/invalid-table")
        expect(response.status()).toBeLessThan(500)

        await page.goto("/s/invalid-restaurant/t/invalid-table")
        await expect(page.locator("body")).toBeVisible()
        await expect(page.locator("body")).not.toBeEmpty()
        await expect(page).toHaveURL(/\/s\/invalid-restaurant\/t\/invalid-table$/)
    })

    test("responsive public viewport keeps accessibility basics", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto("/")

        await expect(page.getByRole("main")).toBeVisible()
        await expect(
            page.getByRole("heading", { name: /make every service feel/i })
        ).toBeVisible()
        await expect(
            page.getByRole("link", { name: /open your restaurant desk/i })
        ).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    })
})
