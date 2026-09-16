import { cn } from "@workspace/ui/lib/utils"

/**
 * SOURCE OF TRUTH KEYWORDS: skeleton, loading placeholder, accessible loading UI
 * WHAT: Provides a themed animated loading placeholder.
 * WHY: Route and feature loading states should share consistent geometry.
 * WHERE: Dashboard loading states use this component.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn("animate-pulse rounded-md bg-muted", className)}
            {...props}
        />
    )
}

export { Skeleton }
