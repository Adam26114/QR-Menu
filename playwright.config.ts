import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000"
const useExternalServer = Boolean(process.env.PLAYWRIGHT_BASE_URL)

export default defineConfig({
    testDir: "./tests/e2e",
    timeout: 30_000,
    expect: { timeout: 10_000 },
    fullyParallel: true,
    reporter: "list",
    use: {
        baseURL,
        trace: "on-first-retry",
        ...devices["Desktop Chrome"],
    },
    webServer: useExternalServer
        ? undefined
        : {
              command: "bun run --cwd apps/web dev",
              url: baseURL,
              reuseExistingServer: true,
              timeout: 120_000,
          },
})
