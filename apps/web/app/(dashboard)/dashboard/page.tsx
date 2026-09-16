import { DashboardOverview } from "@/components/dashboard-overview"

/**
 * SOURCE OF TRUTH KEYWORDS: dashboard page, overview entrypoint, thin route composition
 * WHAT: Composes the dashboard overview at the real /dashboard route.
 * WHY: Feature pages have their own canonical routes while the dashboard remains the overview.
 * WHERE: DashboardAuthBoundary in the parent layout mounts this page only after auth resolves.
 */
export default function DashboardPage() {
    return <DashboardOverview />
}
