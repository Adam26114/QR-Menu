import { DashboardAuthBoundary } from "@/components/global/DashboardAuthBoundary"
import { ConvexClientProvider } from "@/components/ConvexClientProvider"

/**
 * SOURCE OF TRUTH KEYWORDS: dashboard layout, protected route, session boundary, route composition
 * WHAT: Provides the shared authenticated shell for dashboard routes.
 * WHY: Authentication is established once at the route boundary instead of in each feature page.
 * WHERE: Every route in the dashboard route group is protected by this layout.
 */
export default function DashboardLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <ConvexClientProvider>
            <DashboardAuthBoundary>{children}</DashboardAuthBoundary>
        </ConvexClientProvider>
    )
}
