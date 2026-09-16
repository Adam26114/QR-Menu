import * as React from "react"
import { Field as FieldPrimitive } from "@base-ui/react/field"
import { cn } from "@workspace/ui/lib/utils"

const Field = FieldPrimitive.Root
function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("grid gap-1.5", className)} {...props} />
}
function FieldTitle({ className, ...props }: React.ComponentProps<"label">) {
    return <label className={cn("text-sm font-medium", className)} {...props} />
}
function FieldLabel({ className, ...props }: FieldPrimitive.Label.Props) {
    return (
        <FieldPrimitive.Label
            className={cn("text-sm font-medium", className)}
            {...props}
        />
    )
}
function FieldDescription({
    className,
    ...props
}: FieldPrimitive.Description.Props) {
    return (
        <FieldPrimitive.Description
            className={cn("text-xs text-muted-foreground", className)}
            {...props}
        />
    )
}
function FieldError({ className, ...props }: FieldPrimitive.Error.Props) {
    return (
        <FieldPrimitive.Error
            className={cn("text-xs text-destructive", className)}
            {...props}
        />
    )
}
function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("grid gap-4", className)} {...props} />
}
function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
    return <fieldset className={cn("grid gap-4", className)} {...props} />
}
function FieldLegend({ className, ...props }: React.ComponentProps<"legend">) {
    return (
        <legend className={cn("text-sm font-medium", className)} {...props} />
    )
}
function FieldSeparator({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            role="separator"
            className={cn("h-px bg-border", className)}
            {...props}
        />
    )
}
export {
    Field,
    FieldLabel,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldSet,
    FieldLegend,
    FieldSeparator,
    FieldContent,
    FieldTitle,
}
