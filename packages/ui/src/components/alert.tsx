import * as React from "react"
import { cn } from "@workspace/ui/lib/utils"

/**
 * SOURCE OF TRUTH KEYWORDS: shadcn alert, persistent feedback, accessible alert
 * WHAT: Provides a themed persistent alert primitive.
 * WHY: Page-level failures need a non-transient, accessible surface.
 * WHERE: Feature views and route error states compose this component.
 */
function Alert({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="alert" className={cn("relative w-full rounded-lg border bg-card p-4 text-sm", className)} {...props} />
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return <h5 className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export { Alert, AlertTitle, AlertDescription }
