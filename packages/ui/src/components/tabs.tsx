import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@workspace/ui/lib/utils"

const Tabs = TabsPrimitive.Root
function TabsList({ className, ...props }: TabsPrimitive.List.Props) { return <TabsPrimitive.List className={cn("inline-flex h-9 items-center gap-1 rounded-lg bg-muted p-1", className)} {...props} /> }
function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) { return <TabsPrimitive.Tab className={cn("inline-flex h-7 items-center justify-center rounded-md px-2.5 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-active:bg-background data-active:text-foreground data-active:shadow-sm", className)} {...props} /> }
function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) { return <TabsPrimitive.Panel className={cn("mt-2 outline-none", className)} {...props} /> }
export { Tabs, TabsList, TabsTrigger, TabsContent }
