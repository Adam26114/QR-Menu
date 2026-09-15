"use client"

import { Component, type ReactNode, useRef, useState } from "react"
import { useAction, useMutation, useQuery } from "convex/react"
import { QRCodeSVG } from "qrcode.react"
import {
    Archive,
    Copy,
    Download,
    ExternalLink,
    Link2,
    Pencil,
    Printer,
    RotateCcw,
    ShieldCheck,
} from "lucide-react"
import { api } from "../../../../convex/_generated/api"
import type { Doc, Id } from "../../../../convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"

type Props = { restaurant: Doc<"restaurants"> }
type Table = Pick<
    Doc<"restaurantTables">,
    | "_id"
    | "_creationTime"
    | "restaurantId"
    | "name"
    | "active"
    | "archived"
    | "createdAt"
    | "updatedAt"
>

function friendlyError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message.toLowerCase() : ""
    if (message.includes("name")) return "Use a table name before saving."
    if (message.includes("owner") || message.includes("forbidden"))
        return "Only the restaurant owner can make this change."
    return fallback
}

function QueryErrorBoundary({ children }: { children: ReactNode }) {
    return <QueryErrorBoundaryImpl>{children}</QueryErrorBoundaryImpl>
}

class QueryErrorBoundaryImpl extends Component<
    { children: ReactNode },
    { hasError: boolean }
> {
    state = { hasError: false }
    static getDerivedStateFromError() {
        return { hasError: true }
    }
    render() {
        return this.state.hasError ? (
            <Card className="mx-auto max-w-3xl">
                <CardHeader>
                    <CardTitle>Tables are unavailable</CardTitle>
                    <CardDescription>
                        We could not load your tables. Refresh the page and try
                        again.
                    </CardDescription>
                </CardHeader>
            </Card>
        ) : (
            this.props.children
        )
    }
}

function publicUrl(slug: string, token: string) {
    if (typeof window === "undefined") return `/s/${slug}/t/${token}`
    return `${window.location.origin}/s/${slug}/t/${token}`
}

function TableLink({ slug, token }: { slug: string; token: string }) {
    const url = publicUrl(slug, token)
    const qrRef = useRef<SVGSVGElement>(null)
    const [copied, setCopied] = useState(false)
    const [printError, setPrintError] = useState<string>()

    async function copy() {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1800)
        } catch {
            setCopied(false)
        }
    }

    function downloadQr() {
        const svg = qrRef.current
        if (!svg) return

        const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" })
        const downloadUrl = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = downloadUrl
        link.download = "table-order-qr.svg"
        link.click()
        URL.revokeObjectURL(downloadUrl)
    }

    function print() {
        setPrintError(undefined)
        const printWindow = window.open("", "_blank")
        if (!printWindow) {
            setPrintError("Unable to open the print preview. Allow pop-ups and try again.")
            return
        }
        const qrMarkup = qrRef.current?.outerHTML
        if (!qrMarkup) {
            printWindow.close()
            setPrintError("Unable to prepare the QR code for printing. Try again.")
            return
        }
        const escapedUrl = url.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        printWindow.document.write(
            `<title>Table link</title><main style="font-family: sans-serif; padding: 32px; text-align: center"><h1>Scan to order</h1>${qrMarkup}<p style="font-family: monospace; overflow-wrap: anywhere">${escapedUrl}</p></main>`
        )
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
    }

    return (
        <div className="grid gap-3 rounded-lg border border-dashed bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
                <Link2 className="size-4 text-primary" aria-hidden="true" />
                Public ordering link
            </div>
            <div className="flex flex-wrap items-center gap-4 rounded-md bg-background p-3">
                <div className="shrink-0 rounded-md border bg-white p-2">
                    <QRCodeSVG
                        ref={qrRef}
                        value={url}
                        size={176}
                        bgColor="#ffffff"
                        fgColor="#111827"
                        level="M"
                        role="img"
                        aria-label={`QR code for the ${slug} table ordering link`}
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="break-all rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
                        {url}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Guests can scan this code to open the table ordering page.
                    </p>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                This preview uses the restaurant slug and a private table token.
                No internal IDs are exposed.
            </p>
            <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={copy}>
                    <Copy aria-hidden="true" /> {copied ? "Copied" : "Copy link"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={downloadQr}>
                    <Download aria-hidden="true" /> Download QR
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={print}>
                    <Printer aria-hidden="true" /> Print
                </Button>
                <a
                    className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[0.8rem] font-medium text-primary hover:underline"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                >
                    <ExternalLink className="size-3.5" aria-hidden="true" /> Open
                </a>
            </div>
            {printError && <p role="alert" className="text-sm text-destructive">{printError}</p>}
        </div>
    )
}

function TableRow({ table, slug }: { table: Table; slug: string }) {
    const rename = useMutation(api.tables.rename)
    const setActive = useMutation(api.tables.setActive)
    const archive = useMutation(api.tables.archive)
    const restore = useMutation(api.tables.restore)
    const getToken = useAction(api.tables.getToken)
    const regenerate = useAction(api.tables.regenerateToken)
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(table.name)
    const [token, setToken] = useState<string>()
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string>()

    async function run(action: () => Promise<unknown>) {
        if (pending) return false
        setPending(true)
        setError(undefined)
        try {
            await action()
        } catch (cause) {
            setError(friendlyError(cause, "Unable to update this table. Try again."))
            return false
        } finally {
            setPending(false)
        }
        return true
    }

    async function saveName(event: React.FormEvent) {
        event.preventDefault()
        if (!name.trim()) {
            setError("Use a table name before saving.")
            return
        }
        const saved = await run(() => rename({ tableId: table._id, name: name.trim() }))
        if (saved) setEditing(false)
    }

    const hiddenLink = table.archived || !table.active
    return (
        <article className={`grid gap-4 rounded-xl border p-4 ${table.archived ? "bg-muted/20 opacity-80" : "bg-card"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    {editing ? (
                        <form className="flex flex-wrap gap-2" onSubmit={saveName}>
                            <Input
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                aria-label={`Name for ${table.name}`}
                                className="h-8 w-48"
                                autoFocus
                            />
                            <Button type="submit" size="sm" disabled={pending}>
                                {pending ? "Saving..." : "Save"}
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
                                Cancel
                            </Button>
                        </form>
                    ) : (
                        <h3 className="flex items-center gap-2 font-semibold tracking-tight">
                            {table.name}
                            {table.archived && <span className="text-xs font-normal text-muted-foreground">Archived</span>}
                        </h3>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                        {table.archived ? "Archived and not available for ordering." : table.active ? "Active for guest ordering." : "Inactive; guest ordering is paused."}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {!table.archived && (
                        <>
                            <Button type="button" size="sm" variant="outline" onClick={() => setEditing((value) => !value)} disabled={pending}>
                                <Pencil aria-hidden="true" /> {editing ? "Close" : "Rename"}
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => void run(() => setActive({ tableId: table._id, active: !table.active }).then(() => { if (!table.active) setToken(undefined) }))} disabled={pending}>
                                {table.active ? "Deactivate" : "Activate"}
                            </Button>
                            <Button type="button" size="sm" variant="destructive" onClick={() => { if (window.confirm(`Archive ${table.name}? You can restore it later.`)) void run(() => archive({ tableId: table._id }).then(() => setToken(undefined))) }} disabled={pending}>
                                <Archive aria-hidden="true" /> Archive
                            </Button>
                        </>
                    )}
                    {table.archived && (
                        <Button type="button" size="sm" onClick={() => void run(() => restore({ tableId: table._id }))} disabled={pending}>
                            <RotateCcw aria-hidden="true" /> Restore
                        </Button>
                    )}
                </div>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {!hiddenLink && (
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    {token ? (
                        <TableLink slug={slug} token={token} />
                    ) : (
                        <Button type="button" size="sm" variant="secondary" onClick={() => void run(async () => setToken(await getToken({ tableId: table._id })))} disabled={pending}>
                            <Link2 aria-hidden="true" /> {pending ? "Loading link..." : "Reveal ordering link"}
                        </Button>
                    )}
                    {token && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => void run(async () => { setToken(undefined); const result = await regenerate({ tableId: table._id }); setToken(result.token) })} disabled={pending}>
                            {pending ? "Regenerating..." : "Regenerate token"}
                        </Button>
                    )}
                </div>
            )}
            {hiddenLink && <p role="status" className="border-t pt-3 text-xs text-muted-foreground">{table.archived ? "Restore this table to manage its ordering link." : "Activate this table to manage its ordering link."}</p>}
        </article>
    )
}

function TablesWorkspaceContent({ restaurant }: Props) {
    const tables = useQuery(api.tables.list, { restaurantId: restaurant._id, includeArchived: true })
    const create = useAction(api.tables.create)
    const [name, setName] = useState("")
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string>()
    const [created, setCreated] = useState<{ tableId: Id<"restaurantTables">; token: string }>()

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (!name.trim() || pending) {
            setError("Use a table name before creating a table.")
            return
        }
        setPending(true)
        setError(undefined)
        try {
            setCreated(await create({ restaurantId: restaurant._id, name: name.trim() }))
            setName("")
        } catch (cause) {
            setError(friendlyError(cause, "Unable to create this table. Try again."))
        } finally {
            setPending(false)
        }
    }

    if (tables === undefined) return <p role="status">Loading tables...</p>
    return (
        <section className="mx-auto grid w-full max-w-6xl gap-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">Service floor</p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">Tables & ordering links</h1>
                    <p className="mt-2 max-w-2xl text-muted-foreground">Create one private ordering link per table. Keep links hidden while a table is inactive or archived.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" aria-hidden="true" /> Owner workspace</div>
            </header>
            {created && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardHeader><CardTitle className="text-base">Table created</CardTitle><CardDescription>Keep this link handy. You can reveal it again from the table below.</CardDescription></CardHeader>
                    <CardContent><TableLink slug={restaurant.slug} token={created.token} /></CardContent>
                </Card>
            )}
            <Card>
                <CardHeader><CardTitle>Add a table</CardTitle><CardDescription>New tables start active and ready for guest ordering.</CardDescription></CardHeader>
                <CardContent>
                    <form className="flex flex-wrap gap-2" onSubmit={submit}>
                        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Table name, e.g. Patio 1" aria-label="New table name" className="max-w-sm" disabled={pending} />
                        <Button type="submit" disabled={pending}>{pending ? "Creating..." : "Create table"}</Button>
                    </form>
                    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
                </CardContent>
            </Card>
            {tables.length === 0 ? (
                <Card className="border-dashed"><CardHeader><CardTitle>No tables yet</CardTitle><CardDescription>Create your first table above to start sharing guest ordering links.</CardDescription></CardHeader></Card>
            ) : (
                <div className="grid gap-3">{tables.map((table) => <TableRow key={table._id} table={table} slug={restaurant.slug} />)}</div>
            )}
        </section>
    )
}

export function TablesWorkspace({ restaurant }: Props) {
    return <QueryErrorBoundary><TablesWorkspaceContent restaurant={restaurant} /></QueryErrorBoundary>
}
