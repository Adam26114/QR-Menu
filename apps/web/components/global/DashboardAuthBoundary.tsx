"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import { authClient } from "@/lib/auth-client"
import { DashboardShell } from "@/components/dashboard-shell"

/**
 * SOURCE OF TRUTH KEYWORDS: dashboard auth boundary, Better Auth session, protected queries, redirect
 * WHAT: Resolves the Better Auth session before mounting protected dashboard children.
 * WHY: Convex queries must never execute for an unresolved or unauthenticated dashboard visitor.
 * WHERE: The dashboard route layout wraps all protected feature pages with this boundary.
 */
export function DashboardAuthBoundary({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, isPending } = authClient.useSession()
  const authUser = useQuery(
    api.auth.getAuthUser,
    !isPending && session ? {} : "skip",
  )
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/")
  const adminAuthorization = useQuery(
    api.auth.isAdmin,
    !isPending && session && isAdminRoute ? {} : "skip",
  )

  useEffect(() => {
    if (!isPending && !session) router.replace("/sign-in")
  }, [isPending, router, session])

  useEffect(() => {
    if (!isPending && session && authUser === null) router.replace("/sign-in")
  }, [authUser, isPending, router, session])

  useEffect(() => {
    if (
      !isPending &&
      session &&
      isAdminRoute &&
      adminAuthorization?.authorized === false
    ) {
      router.replace("/dashboard")
    }
  }, [adminAuthorization, isAdminRoute, isPending, router, session])

  if (
    isPending ||
    !session ||
    authUser === undefined ||
    authUser === null ||
    (isAdminRoute && adminAuthorization?.authorized !== true)
  )
    return (
      <div className="flex min-h-svh items-center justify-center p-6 text-sm text-muted-foreground">
        Loading your workspace...
      </div>
    )
  return <DashboardShell role={authUser.role}>{children}</DashboardShell>
}
