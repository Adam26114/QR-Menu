import { cn } from "@workspace/ui/lib/utils"

/**
 * SOURCE OF TRUTH KEYWORDS: shadcn label, form label, accessible label, field control
 * WHAT: Styles the shared standalone native HTML label.
 * WHY: Forms need consistent accessible labels without requiring field context.
 * WHERE: FormField consumers use Label through FormLabel and direct fields; context-bound Field parts remain separate.
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
    return (
        <label
            data-slot="label"
            className={cn(
                "text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                className
            )}
            {...props}
        />
    )
}

export { Label }
