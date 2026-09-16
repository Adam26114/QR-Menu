import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"

import { cn } from "@workspace/ui/lib/utils"
import { buttonVariants } from "@workspace/ui/components/button"

const AlertDialog = AlertDialogPrimitive.Root
const AlertDialogTrigger = AlertDialogPrimitive.Trigger
const AlertDialogPortal = AlertDialogPrimitive.Portal

/**
 * SOURCE OF TRUTH KEYWORDS: shadcn alert dialog, destructive confirmation, modal overlay
 * WHAT: Exposes themed AlertDialog primitives backed by Base UI.
 * WHY: Destructive actions need a reusable, accessible confirmation surface.
 * WHERE: ConfirmDialog composes these primitives for project deletion.
 */
function AlertDialogOverlay({
    className,
    ...props
}: AlertDialogPrimitive.Backdrop.Props) {
    return (
        <AlertDialogPrimitive.Backdrop
            className={cn(
                "fixed inset-0 z-50 bg-black/50 transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
                className
            )}
            {...props}
        />
    )
}

function AlertDialogContent({
    className,
    ...props
}: AlertDialogPrimitive.Popup.Props) {
    return (
        <AlertDialogPortal>
            <AlertDialogOverlay />
            <AlertDialogPrimitive.Popup
                className={cn(
                    "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-background p-6 shadow-lg transition-opacity outline-none data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
                    className
                )}
                {...props}
            />
        </AlertDialogPortal>
    )
}

function AlertDialogHeader({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "flex flex-col gap-2 text-center sm:text-left",
                className
            )}
            {...props}
        />
    )
}

function AlertDialogFooter({
    className,
    ...props
}: React.ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                className
            )}
            {...props}
        />
    )
}

function AlertDialogTitle({
    className,
    ...props
}: AlertDialogPrimitive.Title.Props) {
    return (
        <AlertDialogPrimitive.Title
            className={cn("text-lg font-semibold", className)}
            {...props}
        />
    )
}

function AlertDialogDescription({
    className,
    ...props
}: AlertDialogPrimitive.Description.Props) {
    return (
        <AlertDialogPrimitive.Description
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    )
}

function AlertDialogAction({
    className,
    ...props
}: AlertDialogPrimitive.Close.Props) {
    return (
        <AlertDialogPrimitive.Close
            className={cn(
                buttonVariants({ variant: "destructive" }),
                className
            )}
            {...props}
        />
    )
}

function AlertDialogCancel({
    className,
    ...props
}: AlertDialogPrimitive.Close.Props) {
    return (
        <AlertDialogPrimitive.Close
            className={cn(buttonVariants({ variant: "outline" }), className)}
            {...props}
        />
    )
}

export {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogOverlay,
    AlertDialogPortal,
    AlertDialogTitle,
    AlertDialogTrigger,
}
