import { Field } from "@base-ui/react/field"

import { cn } from "@workspace/ui/lib/utils"

/**
 * SOURCE OF TRUTH KEYWORDS: shadcn label, form label, accessible label, field control
 * WHAT: Styles the shared Base UI label primitive.
 * WHY: Forms need consistent accessible labels without raw label styling.
 * WHERE: FormField consumers use Label through FormLabel and direct fields.
 */
function Label({ className, ...props }: Field.Label.Props) {
  return <Field.Label data-slot="label" className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
}

export { Label }
