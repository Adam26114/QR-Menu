"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import type { Doc, Id } from "../../../../convex/_generated/dataModel"
import { api } from "../../../../convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { ConfirmDialog } from "@/components/global/ConfirmDialog"

type Restaurant = Doc<"restaurants">
type Action = {
    kind: "revoke" | "remove" | "leave"
    id?: Id<"staffInvitations"> | Id<"restaurantMemberships">
}

function date(value: number) {
    return new Date(value).toLocaleDateString()
}
function errorMessage(error: unknown) {
    const text = error instanceof Error ? error.message.toLowerCase() : ""
    if (text.includes("owner access required")) return "Owner access required."
    if (text.includes("expired") || text.includes("revoked"))
        return "This invitation has expired or was revoked."
    if (text.includes("email")) return "The invitation email does not match."
    if (
        text.includes("final owner") ||
        text.includes("retain an active owner") ||
        text.includes("accepted")
    )
        return "This change is blocked to protect the restaurant."
    if (text.includes("invalid") || text.includes("validation"))
        return "The submitted information is invalid."
    return "Something went wrong. Please try again."
}

export function StaffWorkspace({ restaurant }: { restaurant: Restaurant }) {
    const [at, setAt] = useState(() => Date.now())
    useEffect(() => {
        const timer = window.setInterval(() => setAt(Date.now()), 60_000)
        return () => window.clearInterval(timer)
    }, [])
    const invitations = useQuery(api.invitations.list, {
        restaurantId: restaurant._id,
        at,
    })
    const memberships = useQuery(api.memberships.list, {
        restaurantId: restaurant._id,
    })
    const [inspectedId, setInspectedId] =
        useState<Id<"staffInvitations"> | null>(null)
    const inspected = useQuery(
        api.invitations.inspect,
        inspectedId ? { invitationId: inspectedId, at } : "skip"
    )
    const create = useMutation(api.invitations.create)
    const revoke = useMutation(api.invitations.revoke)
    const update = useMutation(api.memberships.update)
    const remove = useMutation(api.memberships.remove)
    const leave = useMutation(api.memberships.leave)
    const [email, setEmail] = useState("")
    const [role, setRole] = useState<"owner" | "staff">("staff")
    const [canMarkPaid, setCanMarkPaid] = useState(false)
    const [created, setCreated] = useState<{
        token: string
        invitationId: string
        url: string
    } | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)
    const [confirm, setConfirm] = useState<Action | null>(null)

    const run = async (operation: () => Promise<unknown>, success: string) => {
        setPending(true)
        setError(null)
        try {
            await operation()
            setMessage(success)
        } catch (e) {
            setError(errorMessage(e))
        } finally {
            setPending(false)
        }
    }
    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        setMessage(null)
        setError(null)
        setPending(true)
        try {
            const result = await create({
                restaurantId: restaurant._id,
                email,
                role,
                canMarkPaid: role === "owner" || canMarkPaid,
            })
            const url = `${window.location.origin}/invite#token=${encodeURIComponent(result.token)}`
            setCreated({
                token: result.token,
                invitationId: result.invitation._id,
                url,
            })
            setEmail("")
            setMessage(
                "Invitation created. Copy the link before dismissing this result."
            )
        } catch (e) {
            setError(errorMessage(e))
        } finally {
            setPending(false)
        }
    }
    const copy = async (url: string) => {
        await navigator.clipboard.writeText(url)
        setMessage("Invitation link copied.")
    }
    const confirmAction = async () => {
        if (!confirm) return
        if (confirm.kind === "revoke" && confirm.id)
            await run(
                () =>
                    revoke({
                        invitationId: confirm.id as Id<"staffInvitations">,
                    }),
                "Invitation revoked."
            )
        if (confirm.kind === "remove" && confirm.id)
            await run(
                () =>
                    remove({
                        membershipId: confirm.id as Id<"restaurantMemberships">,
                    }),
                "Member removed."
            )
        if (confirm.kind === "leave")
            await run(
                () => leave({ restaurantId: restaurant._id }),
                "You left the restaurant."
            )
    }
    return (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <header>
                <h1 className="text-3xl font-semibold tracking-tight">Staff</h1>
                <p className="mt-2 text-muted-foreground">
                    Manage restaurant owners, staff, and invitations.
                </p>
            </header>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            {message && (
                <p role="status" className="text-sm text-emerald-600">
                    {message}
                </p>
            )}
            <Card>
                <CardHeader>
                    <CardTitle>Invite someone</CardTitle>
                    <CardDescription>
                        Links expire after seven days and can only be used by
                        the invited email.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={submit}
                        className="grid gap-4 sm:grid-cols-[1fr_10rem_10rem_auto] sm:items-end"
                    >
                        <label className="grid gap-2 text-sm font-medium">
                            Email
                            <Input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </label>
                        <label className="grid gap-2 text-sm font-medium">
                            Role
                            <select
                                className="h-9 rounded-md border bg-background px-3 text-sm"
                                value={role}
                                onChange={(e) =>
                                    setRole(e.target.value as "owner" | "staff")
                                }
                            >
                                <option value="staff">Staff</option>
                                <option value="owner">Owner</option>
                            </select>
                        </label>
                        <label className="flex h-9 items-center gap-2 text-sm font-medium">
                            <input
                                type="checkbox"
                                checked={role === "owner" || canMarkPaid}
                                disabled={role === "owner"}
                                onChange={(e) =>
                                    setCanMarkPaid(e.target.checked)
                                }
                            />{" "}
                            Can mark paid
                        </label>
                        <Button type="submit" disabled={pending}>
                            {pending ? "Creating..." : "Create invite"}
                        </Button>
                    </form>
                    {created && (
                        <div className="mt-4 rounded-md border bg-muted/40 p-3 text-sm">
                            <p className="font-medium">
                                Copy this invitation link now
                            </p>
                            <Button
                                className="mt-2"
                                variant="outline"
                                onClick={() => copy(created.url)}
                            >
                                Copy link
                            </Button>
                            <Button
                                className="mt-2 ml-2"
                                variant="ghost"
                                onClick={() => setCreated(null)}
                            >
                                Dismiss
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Pending invitations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {invitations === undefined ? (
                        <p className="text-sm text-muted-foreground">
                            Loading invitations...
                        </p>
                    ) : invitations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No pending invitations.
                        </p>
                    ) : (
                        invitations.map((inv) => (
                            <div
                                key={inv._id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
                            >
                                <div>
                                    <p className="font-medium">{inv.email}</p>
                                    <p className="text-muted-foreground">
                                        {inv.role} - payment permission:{" "}
                                        {inv.canMarkPaid ? "yes" : "no"} -
                                        expires {date(inv.expiresAt)}
                                    </p>
                                    {inspectedId === inv._id && inspected && (
                                        <p className="mt-1 text-muted-foreground">
                                            Created {date(inspected.createdAt)}{" "}
                                            - status: {inspected.status}
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => setInspectedId(inv._id)}
                                    >
                                        Inspect metadata
                                    </Button>
                                    {created?.invitationId === inv._id && (
                                        <Button
                                            variant="outline"
                                            onClick={() => copy(created.url)}
                                        >
                                            Copy link
                                        </Button>
                                    )}
                                    <Button
                                        variant="destructive"
                                        disabled={pending}
                                        onClick={() =>
                                            setConfirm({
                                                kind: "revoke",
                                                id: inv._id,
                                            })
                                        }
                                    >
                                        Revoke
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Members</CardTitle>
                    <CardDescription>
                        Only active owners can change membership permissions.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {memberships === undefined ? (
                        <p className="text-sm text-muted-foreground">
                            Loading members...
                        </p>
                    ) : memberships.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No members found.
                        </p>
                    ) : (
                        memberships.map((member) => (
                            <MemberRow
                                key={member._id}
                                member={member}
                                pending={pending}
                                onUpdate={(r, paid) =>
                                    run(
                                        () =>
                                            update({
                                                membershipId: member._id,
                                                role: r,
                                                canMarkPaid: paid,
                                            }),
                                        "Member updated."
                                    )
                                }
                                onRemove={() =>
                                    setConfirm({
                                        kind: "remove",
                                        id: member._id,
                                    })
                                }
                            />
                        ))
                    )}
                </CardContent>
            </Card>
            <div>
                <Button
                    variant="destructive"
                    onClick={() => setConfirm({ kind: "leave" })}
                >
                    Leave restaurant
                </Button>
            </div>
            <ConfirmDialog
                open={confirm !== null}
                onOpenChange={(open) => {
                    if (!open) setConfirm(null)
                }}
                title={
                    confirm?.kind === "leave"
                        ? "Leave this restaurant?"
                        : confirm?.kind === "remove"
                          ? "Remove this member?"
                          : "Revoke this invitation?"
                }
                description="This action cannot be undone from this screen. The server will enforce owner safety rules."
                confirmLabel={
                    confirm?.kind === "leave"
                        ? "Leave"
                        : confirm?.kind === "remove"
                          ? "Remove"
                          : "Revoke"
                }
                cancelLabel="Cancel"
                pending={pending}
                onConfirm={confirmAction}
            />
        </section>
    )
}

function MemberRow({
    member,
    pending,
    onUpdate,
    onRemove,
}: {
    member: {
        _id: string
        email?: string
        role: "owner" | "staff"
        status: "active" | "revoked"
        canMarkPaid: boolean
    }
    pending: boolean
    onUpdate: (role: "owner" | "staff", paid: boolean) => void
    onRemove: () => void
}) {
    const [role, setRole] = useState(member.role)
    const [paid, setPaid] = useState(member.canMarkPaid)
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <div>
                <p className="font-medium">
                    {member.email ?? "Email unavailable"}
                </p>
                <p className="text-muted-foreground">{member.status}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <select
                    aria-label={`Role for ${member.email ?? "member"}`}
                    className="h-9 rounded-md border bg-background px-3"
                    value={role}
                    onChange={(e) =>
                        setRole(e.target.value as "owner" | "staff")
                    }
                >
                    <option value="staff">Staff</option>
                    <option value="owner">Owner</option>
                </select>
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={role === "owner" || paid}
                        disabled={role === "owner"}
                        onChange={(e) => setPaid(e.target.checked)}
                    />{" "}
                    Paid
                </label>
                <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => onUpdate(role, role === "owner" || paid)}
                >
                    Save
                </Button>
                <Button
                    variant="destructive"
                    disabled={pending}
                    onClick={onRemove}
                >
                    Remove
                </Button>
            </div>
        </div>
    )
}
