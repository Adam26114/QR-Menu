"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useMutation } from "convex/react"
import { useConvexAuth } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import { ConvexClientProvider } from "@/components/ConvexClientProvider"
import { buttonVariants } from "@workspace/ui/components/button"

const key = "pending-invitation-token"
function safeMessage(error: unknown) {
    const text = error instanceof Error ? error.message.toLowerCase() : ""
    if (text.includes("email"))
        return "This invitation is for a different email address."
    if (text.includes("pending") || text.includes("expired"))
        return "This invitation has expired or is no longer available."
    if (text.includes("not found"))
        return "This invitation is no longer available."
    return "We could not accept this invitation. Ask the owner for a new link."
}
function readInvitation() {
    if (typeof window === "undefined") return { token: null, state: "loading" }
    const hash = window.location.hash
    if (hash)
        window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
        )
    let value: string | null = null
    if (hash.startsWith("#token=")) {
        try {
            value = decodeURIComponent(hash.slice(7))
        } catch {
            sessionStorage.removeItem(key)
            return { token: null, state: "invalid" }
        }
    }
    const stored = value || sessionStorage.getItem(key)
    if (value) sessionStorage.setItem(key, value)
    return { token: stored, state: stored ? "ready" : "invalid" }
}

function InviteContent() {
    const { isAuthenticated, isLoading } = useConvexAuth()
    const accept = useMutation(api.invitations.accept)
    const [{ token, state }, setInvitation] = useState<
        ReturnType<typeof readInvitation>
    >({ token: null, state: "loading" })
    const attempted = useRef(false)
    useEffect(() => {
        queueMicrotask(() => setInvitation(readInvitation()))
    }, [])
    useEffect(() => {
        if (isLoading || !isAuthenticated || !token || attempted.current) return
        attempted.current = true
        setInvitation((current) => ({ ...current, state: "accepting" }))
        void accept({ token })
            .then(() => {
                sessionStorage.removeItem(key)
                setInvitation((current) => ({ ...current, state: "success" }))
            })
            .catch((error) => {
                sessionStorage.removeItem(key)
                setInvitation((current) => ({
                    ...current,
                    state: safeMessage(error),
                }))
            })
    }, [accept, isAuthenticated, isLoading, token])
    if (state === "loading" || state === "accepting")
        return (
            <p className="text-sm text-muted-foreground">
                {state === "accepting"
                    ? "Accepting your invitation..."
                    : "Checking your invitation..."}
            </p>
        )
    if (state === "invalid")
        return (
            <p role="alert">
                This invitation link is missing or invalid. Ask the owner for a
                new link.
            </p>
        )
    if (!isAuthenticated)
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-semibold">
                    You have a restaurant invitation
                </h1>
                <p className="text-muted-foreground">
                    Sign in or create an account with the invited email to
                    accept it.
                </p>
                <div className="flex gap-2">
                    <Link
                        className={buttonVariants()}
                        href="/sign-in?redirect=%2Finvite"
                    >
                        Sign in
                    </Link>
                    <Link
                        className={buttonVariants({ variant: "outline" })}
                        href="/sign-up?redirect=%2Finvite"
                    >
                        Create account
                    </Link>
                </div>
            </div>
        )
    if (state === "success")
        return (
            <div className="space-y-4">
                <h1 className="text-2xl font-semibold">Invitation accepted</h1>
                <p className="text-muted-foreground">
                    Your restaurant access is ready.
                </p>
                <Link className={buttonVariants()} href="/dashboard">
                    Go to dashboard
                </Link>
            </div>
        )
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Invitation unavailable</h1>
            <p role="alert" className="text-muted-foreground">
                {state}
            </p>
            <Link
                className={buttonVariants({ variant: "outline" })}
                href="/dashboard"
            >
                Go to dashboard
            </Link>
        </div>
    )
}
export default function InvitePage() {
    return (
        <ConvexClientProvider>
            <main className="flex min-h-svh items-center justify-center p-6">
                <div className="w-full max-w-md rounded-lg border bg-card p-6">
                    <InviteContent />
                </div>
            </main>
        </ConvexClientProvider>
    )
}
