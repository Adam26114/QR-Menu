"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "convex/react"
import {
    BarChart3,
    ClipboardList,
    LayoutDashboard,
    Settings,
    Shield,
    Store,
    Users,
    Wallet,
    Utensils,
    Table2,
} from "lucide-react"
import { api } from "../../../convex/_generated/api"
import { cn } from "@workspace/ui/lib/utils"
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMobileTrigger,
    SidebarProvider,
    SidebarTrigger,
    useSidebar,
} from "@workspace/ui/components/sidebar"

const scopedNavigation = [
    ["Overview", "", LayoutDashboard],
    ["Orders", "/orders", ClipboardList],
    ["Menu", "/menu", Utensils],
    ["Tables", "/tables", Table2],
    ["Staff", "/staff", Users],
    ["Reports", "/reports", BarChart3],
    ["Settings", "/settings", Settings],
    ["Billing", "/billing", Wallet],
] as const

export function DashboardShell({
    children,
    role,
}: {
    children: React.ReactNode
    role: "admin" | "user"
}) {
    const pathname = usePathname()
    const slug =
        pathname === "/dashboard/new"
            ? undefined
            : pathname.match(/^\/dashboard\/([^/]+)/)?.[1]
    const restaurant = useQuery(
        api.restaurants.resolveSlug,
        slug ? { slug } : "skip"
    )
    const membership = useQuery(
        api.restaurants.getMembership,
        restaurant ? { restaurantId: restaurant._id } : "skip"
    )
    const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/")
    const isScoped = Boolean(slug)
    const base = slug ? `/dashboard/${slug}` : "/dashboard"
    const navigation =
        membership?.role === "staff"
            ? scopedNavigation.filter(
                  ([title]) => title === "Overview" || title === "Orders"
              )
            : scopedNavigation
    const items = isAdmin
        ? [["Admin", "/admin", Shield] as const]
        : isScoped
          ? navigation.map(
                ([title, suffix, icon]) =>
                    [title, `${base}${suffix}`, icon] as const
            )
          : [["Restaurants", "/dashboard", Store] as const]

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarHeader>
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                        <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                            R
                        </span>
                        <span className="md:group-data-[state=collapsed]/sidebar:hidden">
                            Resto desk
                        </span>
                    </Link>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>
                            {isScoped
                                ? (restaurant?.name ?? "Restaurant")
                                : "Restaurants"}
                        </SidebarGroupLabel>
                        <DashboardNavigation
                            pathname={pathname}
                            items={items}
                        />
                    </SidebarGroup>
                    {role === "admin" && !isAdmin && (
                        <SidebarGroup>
                            <SidebarGroupLabel>Platform</SidebarGroupLabel>
                            <DashboardNavigation
                                pathname={pathname}
                                items={[["Admin", "/admin", Shield]]}
                            />
                        </SidebarGroup>
                    )}
                </SidebarContent>
            </Sidebar>
            <SidebarInset>
                <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 md:px-6">
                    <SidebarTrigger className="hidden md:inline-flex" />
                    <SidebarMobileTrigger className="md:hidden" />
                    <div className="h-4 w-px bg-border md:hidden" />
                    <div className="truncate text-sm font-medium">
                        {isScoped
                            ? (restaurant?.name ?? "Restaurant workspace")
                            : isAdmin
                              ? "Admin"
                              : "Restaurants"}
                    </div>
                    <div className="ml-auto text-sm text-muted-foreground">
                        {isScoped
                            ? membership?.role === "staff"
                                ? "Staff access"
                                : "Owner workspace"
                            : role === "admin"
                              ? "Admin workspace"
                               : "Restaurant operations"}
                    </div>
                </header>
                <div className={cn("flex-1 p-4 md:p-6")}>{children}</div>
            </SidebarInset>
        </SidebarProvider>
    )
}

function DashboardNavigation({
    pathname,
    items,
}: {
    pathname: string
    items: readonly (readonly [
        string,
        string,
        React.ComponentType<{ className?: string }>,
    ])[]
}) {
    const { closeMobileSidebar } = useSidebar()
    return (
        <nav aria-label="Primary navigation">
            <SidebarMenu>
                {items.map(([title, href, Icon]) => {
                    const active =
                        pathname === href ||
                        (href !== "/dashboard" &&
                            pathname.startsWith(`${href}/`))
                    return (
                        <SidebarMenuItem key={title}>
                            <Link
                                href={href}
                                onClick={closeMobileSidebar}
                                aria-current={active ? "page" : undefined}
                                className="block rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            >
                                <SidebarMenuButton isActive={active}>
                                    <Icon
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    <span>{title}</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                    )
                })}
            </SidebarMenu>
        </nav>
    )
}
