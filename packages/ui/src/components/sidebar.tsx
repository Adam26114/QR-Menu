"use client"

import * as React from "react"
import { Menu, PanelLeft, X } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"

type SidebarContextValue = {
  open: boolean
  mobileOpen: boolean
  mobileTriggerRef: React.RefObject<HTMLButtonElement | null>
  setOpen: (open: boolean) => void
  setMobileOpen: (open: boolean) => void
  closeMobileSidebar: () => void
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context)
    throw new Error("useSidebar must be used within a SidebarProvider")
  return context
}

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return

    const mediaQuery = window.matchMedia("(max-width: 767px)")
    const updateIsMobile = () => setIsMobile(mediaQuery.matches)
    updateIsMobile()

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", updateIsMobile)
    } else {
      mediaQuery.addListener?.(updateIsMobile)
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", updateIsMobile)
      } else {
        mediaQuery.removeListener?.(updateIsMobile)
      }
    }
  }, [])

  return isMobile
}

function SidebarProvider({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  const [open, setOpen] = React.useState(true)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const mobileTriggerRef = React.useRef<HTMLButtonElement>(null)
  const toggleSidebar = React.useCallback(() => setOpen((value) => !value), [])
  const closeMobileSidebar = React.useCallback(() => {
    setMobileOpen(false)
    mobileTriggerRef.current?.focus()
  }, [])
  return (
    <SidebarContext.Provider
      value={{
        open,
        mobileOpen,
        mobileTriggerRef,
        setOpen,
        setMobileOpen,
        closeMobileSidebar,
        toggleSidebar,
      }}
    >
      <div className={cn("flex min-h-svh w-full", className)}>{children}</div>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  const { open, mobileOpen, closeMobileSidebar } = useSidebar()
  const isMobile = useIsMobile()
  const sidebarRef = React.useRef<HTMLElement>(null)

  React.useEffect(() => {
    if (!isMobile || !mobileOpen) return

    const firstFocusableElement =
      sidebarRef.current?.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    firstFocusableElement?.focus({ preventScroll: true })
  }, [isMobile, mobileOpen])

  React.useEffect(() => {
    if (!mobileOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      closeMobileSidebar()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [closeMobileSidebar, mobileOpen])

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeMobileSidebar}
        />
      )}
      <aside
        ref={sidebarRef}
        id="dashboard-sidebar"
        aria-label="Sidebar"
        data-slot="sidebar"
        data-state={open ? "expanded" : "collapsed"}
        data-mobile-state={mobileOpen ? "open" : "closed"}
        inert={isMobile && !mobileOpen ? true : undefined}
        className={cn(
          "group/sidebar fixed inset-y-0 left-0 z-50 flex w-64 -translate-x-full flex-col border-r bg-sidebar text-sidebar-foreground transition-[width,transform] md:static md:z-auto md:translate-x-0",
          mobileOpen && "translate-x-0",
          !open && "md:w-16",
          className
        )}
      >
        {children}
      </aside>
    </>
  )
}

function SidebarHeader({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex h-16 items-center gap-2 border-b px-4", className)}
    >
      {children}
    </div>
  )
}

function SidebarContent({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-3",
        className
      )}
    >
      {children}
    </div>
  )
}

function SidebarFooter({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div data-slot="sidebar-footer" className={cn("border-t p-3", className)}>
      {children}
    </div>
  )
}

function SidebarGroup({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("flex flex-col gap-2", className)}
    >
      {children}
    </div>
  )
}

function SidebarGroupLabel({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "px-2 text-xs font-medium text-sidebar-foreground/60 md:group-data-[state=collapsed]/sidebar:hidden",
        className
      )}
    >
      {children}
    </div>
  )
}

function SidebarMenu({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
    >
      {children}
    </ul>
  )
}

function SidebarMenuItem({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("group/menu-item relative", className)}
    >
      {children}
    </li>
  )
}

function SidebarMenuButton({
  children,
  isActive,
  className,
  ...props
}: React.ComponentProps<"div"> & { isActive?: boolean }) {
  return (
    <div
      data-slot="sidebar-menu-button"
      data-active={isActive || undefined}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground md:group-data-[state=collapsed]/sidebar:justify-center md:group-data-[state=collapsed]/sidebar:[&>span]:hidden",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function SidebarTrigger({ className }: { className?: string }) {
  const { open, toggleSidebar } = useSidebar()
  return (
    <button
      type="button"
      aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
      aria-expanded={open}
      aria-controls="dashboard-sidebar"
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        className
      )}
      onClick={toggleSidebar}
    >
      <PanelLeft className="size-4" />
    </button>
  )
}

function SidebarMobileTrigger({ className }: { className?: string }) {
  const { mobileOpen, mobileTriggerRef, setMobileOpen } = useSidebar()
  return (
    <button
      type="button"
      ref={mobileTriggerRef}
      aria-label={mobileOpen ? "Close sidebar" : "Open sidebar"}
      aria-expanded={mobileOpen}
      aria-controls="dashboard-sidebar"
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
        className
      )}
      onClick={() => setMobileOpen(!mobileOpen)}
    >
      {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
    </button>
  )
}

function SidebarInset({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("flex min-w-0 flex-1 flex-col bg-background", className)}
    >
      {children}
    </main>
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarHeader,
  SidebarMobileTrigger,
  SidebarTrigger,
  useSidebar,
}
