import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import { cn } from "@workspace/ui/lib/utils"

const Sheet = DrawerPrimitive.Root
const SheetTrigger = DrawerPrimitive.Trigger
const SheetClose = DrawerPrimitive.Close

function SheetPortal({ ...props }: DrawerPrimitive.Portal.Props) {
    return <DrawerPrimitive.Portal {...props} />
}

function SheetOverlay({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
    return (
        <DrawerPrimitive.Backdrop
            className={cn(
                "fixed inset-0 z-50 bg-black/50 data-ending-style:opacity-0 data-starting-style:opacity-0",
                className
            )}
            {...props}
        />
    )
}

function SheetContent({
    className,
    side = "right",
    children,
    ...props
}: DrawerPrimitive.Content.Props & {
    side?: "top" | "right" | "bottom" | "left"
}) {
    return (
        <SheetPortal>
            <SheetOverlay />
            <DrawerPrimitive.Popup
                className={cn(
                    "fixed z-50 flex max-h-screen flex-col gap-4 border bg-background p-6 shadow-lg outline-none data-ending-style:opacity-0 data-starting-style:opacity-0",
                    side === "right" &&
                        "inset-y-0 right-0 w-3/4 border-l sm:max-w-sm",
                    side === "left" &&
                        "inset-y-0 left-0 w-3/4 border-r sm:max-w-sm",
                    side === "top" && "inset-x-0 top-0 border-b",
                    side === "bottom" && "inset-x-0 bottom-0 border-t",
                    className
                )}
                {...props}
            >
                {children}
            </DrawerPrimitive.Popup>
        </SheetPortal>
    )
}
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("flex flex-col gap-2", className)} {...props} />
}
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "mt-auto flex flex-col gap-2 sm:flex-row sm:justify-end",
                className
            )}
            {...props}
        />
    )
}
function SheetTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
    return (
        <DrawerPrimitive.Title
            className={cn("text-lg font-semibold", className)}
            {...props}
        />
    )
}
function SheetDescription({
    className,
    ...props
}: DrawerPrimitive.Description.Props) {
    return (
        <DrawerPrimitive.Description
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        />
    )
}

export {
    Sheet,
    SheetTrigger,
    SheetContent,
    SheetHeader,
    SheetFooter,
    SheetTitle,
    SheetDescription,
    SheetClose,
    SheetPortal,
    SheetOverlay,
}
