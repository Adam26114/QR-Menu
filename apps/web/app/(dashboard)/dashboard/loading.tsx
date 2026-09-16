import { Skeleton } from "@workspace/ui/components/skeleton"

/** SOURCE OF TRUTH KEYWORDS: dashboard loading, route loading, skeleton
 * WHAT: Provides the dashboard route loading UI.
 * WHY: Navigation gets immediate stable feedback before feature data resolves.
 * WHERE: Next.js renders this while dashboard segments load.
 */
export default function Loading() {
    return (
        <div>
            <div className="mx-auto grid max-w-3xl gap-4">
                <Skeleton className="h-12 w-48" />
                <Skeleton className="h-28" />
                <Skeleton className="h-24" />
            </div>
        </div>
    )
}
