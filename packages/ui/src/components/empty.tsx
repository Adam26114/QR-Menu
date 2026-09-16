import { cn } from "@workspace/ui/lib/utils"

function Empty({ className, ...props }: React.ComponentProps<"div">) { return <div data-slot="empty" className={cn("flex min-w-0 flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center", className)} {...props} /> }
function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex max-w-sm flex-col items-center gap-2", className)} {...props} /> }
function EmptyTitle({ className, ...props }: React.ComponentProps<"h3">) { return <h3 className={cn("font-medium tracking-tight", className)} {...props} /> }
function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) { return <p className={cn("text-sm text-muted-foreground", className)} {...props} /> }
function EmptyContent({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-wrap items-center justify-center gap-2", className)} {...props} /> }
function EmptyMedia({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground", className)} {...props} /> }
export { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia }
