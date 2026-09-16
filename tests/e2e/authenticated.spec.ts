import { expect, test } from "@playwright/test"

const ownerAuthState = process.env.E2E_OWNER_AUTH_STATE
const staffAuthState = process.env.E2E_STAFF_AUTH_STATE
const adminAuthState = process.env.E2E_ADMIN_AUTH_STATE
const userAuthState = process.env.E2E_USER_AUTH_STATE
const restaurantSlug = process.env.E2E_RESTAURANT_SLUG
const otherRestaurantSlug = process.env.E2E_OTHER_RESTAURANT_SLUG
const ownerFixtureReady = Boolean(ownerAuthState && restaurantSlug)
const staffFixtureReady = Boolean(staffAuthState && restaurantSlug)
const adminFixtureReady = Boolean(adminAuthState)
const userFixtureReady = Boolean(userAuthState)

function requireAuthenticatedFixture(
    ready: boolean,
    variables: string[],
    journey: string,
    requiredInCi = true
) {
    if (ready) return

    const message = `Missing ${variables.join(" and ")} for ${journey}.`
    if (process.env.CI && requiredInCi) {
        throw new Error(`${message} CI must provide this authenticated fixture.`)
    }

    test.skip(true, `${message} Set the variable${variables.length === 1 ? "" : "s"} locally to run this coverage.`)
}

test.describe("admin role journey", () => {
    test.use({ storageState: adminAuthState })

    test("admin platform controls are reachable", async ({ page }) => {
        requireAuthenticatedFixture(adminFixtureReady, ["E2E_ADMIN_AUTH_STATE"], "admin platform-controls journey")
        await page.goto("/admin")
        await expect(page.getByRole("heading", { name: "Platform controls" })).toBeVisible()
        await expect(page.getByText("These controls change subscription policy only.")).toBeVisible()
        for (const sensitiveField of [
            "tokenIdentifier",
            "externalCustomerId",
            "externalSubscriptionId",
            "phone",
            "address",
            "email",
            "revenue",
            "orders",
            "staff",
        ]) {
            await expect(page.locator("body")).not.toContainText(sensitiveField)
        }
    })
})

test.describe("non-admin platform access", () => {
    test.use({ storageState: userAuthState })

    test("non-admin users are redirected away from platform controls", async ({ page }) => {
        requireAuthenticatedFixture(userFixtureReady, ["E2E_USER_AUTH_STATE"], "non-admin redirect coverage", false)
        await page.goto("/admin")
        await expect(page).not.toHaveURL(/\/admin(?:\/|$)/)
    })
})

test.describe("owner reports journey", () => {
    test.use({ storageState: ownerAuthState })

    test.beforeEach(async ({ page }) => {
        requireAuthenticatedFixture(
            ownerFixtureReady,
            ["E2E_OWNER_AUTH_STATE", "E2E_RESTAURANT_SLUG"],
            "owner reports coverage"
        )
        await page.goto("/dashboard")
    })

    test("owner can navigate to restaurant reports", async ({ page }) => {
        await page.goto(`/dashboard/${restaurantSlug}/reports`)
        await expect(page).toHaveURL(new RegExp(`/dashboard/${restaurantSlug}/reports`))
        await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible()
        await expect(page.getByRole("link", { name: "Reports" })).toHaveAttribute("aria-current", "page")
    })

    test("tenant-isolation navigation does not stay on another tenant route", async ({ page }) => {
        test.skip(
            !otherRestaurantSlug || otherRestaurantSlug === restaurantSlug,
            "Set E2E_OTHER_RESTAURANT_SLUG to a distinct tenant fixture to run isolation coverage."
        )
        await page.goto(`/dashboard/${otherRestaurantSlug}/reports`)
        await expect(page).not.toHaveURL(new RegExp(`/dashboard/${otherRestaurantSlug}/reports`))
    })
})

test.describe("staff orders journey", () => {
    test.use({ storageState: staffAuthState })

    test.beforeEach(async ({ page }) => {
        requireAuthenticatedFixture(
            staffFixtureReady,
            ["E2E_STAFF_AUTH_STATE", "E2E_RESTAURANT_SLUG"],
            "staff orders coverage"
        )
        await page.goto("/dashboard")
    })

    test("staff can navigate to restaurant orders", async ({ page }) => {
        await page.goto(`/dashboard/${restaurantSlug}/orders`)
        await expect(page).toHaveURL(new RegExp(`/dashboard/${restaurantSlug}/orders`))
        await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible()
        await expect(page.getByRole("link", { name: "Orders" })).toHaveAttribute("aria-current", "page")
    })
})
