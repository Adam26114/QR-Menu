"use client"

import { Toaster as Sonner, toast } from "sonner"
import { useTheme } from "next-themes"

/**
 * SOURCE OF TRUTH KEYWORDS: Sonner toaster, theme-aware toasts, global feedback
 * WHAT: Mounts the Sonner toast viewport using the active next-themes mode.
 * WHY: Async success and error feedback must be globally available and themed.
 * WHERE: The root Providers component renders one instance.
 */
function Toaster() {
  const { theme = "system" } = useTheme()
  return <Sonner theme={theme === "light" || theme === "dark" ? theme : "system"} className="toaster group" toastOptions={{ classNames: { toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border" } }} />
}

export { Toaster, toast }
