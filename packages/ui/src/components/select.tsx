import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const Select = SelectPrimitive.Root
function SelectTrigger({ className, children, ...props }: SelectPrimitive.Trigger.Props) { return <SelectPrimitive.Trigger className={cn("flex h-8 min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50", className)} {...props}>{children}<ChevronDown className="size-4 opacity-50" /></SelectPrimitive.Trigger> }
function SelectValue({ ...props }: SelectPrimitive.Value.Props) { return <SelectPrimitive.Value {...props} /> }
function SelectContent({ className, children, ...props }: SelectPrimitive.Popup.Props) { return <SelectPrimitive.Portal><SelectPrimitive.Positioner className="z-50" sideOffset={4}><SelectPrimitive.Popup className={cn("max-h-(--available-height) min-w-(--anchor-width) overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md outline-none", className)} {...props}>{children}</SelectPrimitive.Popup></SelectPrimitive.Positioner></SelectPrimitive.Portal> }
function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) { return <SelectPrimitive.Item className={cn("relative flex cursor-default items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50", className)} {...props}>{children}<SelectPrimitive.ItemIndicator className="absolute right-2"><Check className="size-4" /></SelectPrimitive.ItemIndicator></SelectPrimitive.Item> }
const SelectGroup = SelectPrimitive.Group
function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) { return <SelectPrimitive.GroupLabel className={cn("px-2 py-1.5 text-xs text-muted-foreground", className)} {...props} /> }
function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) { return <SelectPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} /> }

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectSeparator }
