"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { FolderKanban, LayoutDashboard, Shield } from "lucide-react"
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

const navigation = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderKanban },
]

export function DashboardShell({
  children,
  role,
}: {
  children: React.ReactNode
  role: "admin" | "user"
}) {
  const pathname = usePathname()
  const isProjects =
    pathname === "/projects" || pathname.startsWith("/projects/")
  const context = isProjects ? "Projects" : "Dashboard"

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none md:group-data-[state=collapsed]/sidebar:[&>span:last-child]:hidden"
          >
            <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              S
            </span>{" "}
            <span>Starterkit</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <DashboardNavigation pathname={pathname} role={role} />
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-3 border-b px-4 md:px-6">
          <SidebarTrigger className="hidden md:inline-flex" />
          <SidebarMobileTrigger className="md:hidden" />
          <div className="h-4 w-px bg-border md:hidden" />
          <div className="text-sm font-medium">{context}</div>
          <div className="ml-auto text-sm text-muted-foreground">
            {role === "admin" ? "Admin workspace" : "Workspace"}
          </div>
        </header>
        <div className={cn("flex-1 p-4 md:p-6")}>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function DashboardNavigation({
  pathname,
  role,
}: {
  pathname: string
  role: "admin" | "user"
}) {
  const { closeMobileSidebar } = useSidebar()
  const items = role === "admin"
    ? [...navigation, { title: "Admin", href: "/admin", icon: Shield }]
    : navigation

  return (
    <nav aria-label="Primary navigation">
      <SidebarMenu>
        {items.map((item) => {
          const Icon = item.icon
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <SidebarMenuItem key={item.title}>
              <Link
                href={item.href}
                aria-label={item.title}
                title={item.title}
                className="block rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
                aria-current={active ? "page" : undefined}
                onClick={closeMobileSidebar}
              >
                <SidebarMenuButton isActive={active}>
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </nav>
  )
}
