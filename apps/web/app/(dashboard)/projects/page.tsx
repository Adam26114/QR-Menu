import { FeatureErrorBoundary } from "@/components/global/FeatureErrorBoundary"
import { ProjectsView } from "@/features/projects"

/**
 * SOURCE OF TRUTH KEYWORDS: projects page, projects entrypoint, thin route composition
 * WHAT: Composes the projects feature at the real /projects route.
 * WHY: Business logic and data access belong to the feature, not the route module.
 * WHERE: DashboardAuthBoundary in the parent layout mounts this page only after auth resolves.
 */
export default function ProjectsPage() {
    return (
        <FeatureErrorBoundary>
            <ProjectsView />
        </FeatureErrorBoundary>
    )
}
