"use client"

import Link from "next/link"
import {
    Component,
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react"
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
import { ConfirmDialog } from "@/components/global/ConfirmDialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@workspace/ui/components/dialog"

type Props = { restaurant: Doc<"restaurants"> }
type Table = Pick<
    Doc<"restaurantTables">,
    | "_id"
    | "_creationTime"
    | "restaurantId"
    | "name"
    | "area"
    | "serviceStatus"
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
    const [actionError, setActionError] = useState<string>()

    async function copy() {
        setActionError(undefined)
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1800)
        } catch {
            setCopied(false)
            setActionError("Unable to copy the ordering link. Try again.")
        }
    }

    function downloadQr() {
        setActionError(undefined)
        const svg = qrRef.current
        if (!svg) {
            setActionError("Unable to download the QR code. Try again.")
            return
        }

        let downloadUrl: string | undefined
        try {
            const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" })
            downloadUrl = URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = downloadUrl
            link.download = "table-order-qr.svg"
            link.click()
        } catch {
            setActionError("Unable to download the QR code. Try again.")
        } finally {
            if (downloadUrl) URL.revokeObjectURL(downloadUrl)
        }
    }

    function print() {
        setActionError(undefined)
        try {
            const printWindow = window.open("", "_blank")
            if (!printWindow) {
                setActionError(
                    "Unable to open the print preview. Allow pop-ups and try again."
                )
                return
            }
            const qrMarkup = qrRef.current?.outerHTML
            if (!qrMarkup) {
                printWindow.close()
                setActionError(
                    "Unable to prepare the QR code for printing. Try again."
                )
                return
            }
            const escapedUrl = url
                .replaceAll("&", "&amp;")
                .replaceAll("<", "&lt;")
                .replaceAll(">", "&gt;")
            printWindow.document.write(
                `<title>Table link</title><main style="font-family: sans-serif; padding: 32px; text-align: center"><h1>Scan to order</h1>${qrMarkup}<p style="font-family: monospace; overflow-wrap: anywhere">${escapedUrl}</p></main>`
            )
            printWindow.document.close()
            printWindow.focus()
            printWindow.print()
        } catch {
            setActionError("Unable to print the QR code. Try again.")
        }
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
                    <p className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs break-all text-muted-foreground">
                        {url}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Guests can scan this code to open the table ordering
                        page.
                    </p>
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                This preview uses the restaurant slug and a private table token.
                No internal IDs are exposed.
            </p>
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={copy}
                >
                    <Copy aria-hidden="true" />{" "}
                    {copied ? "Copied" : "Copy link"}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={downloadQr}
                >
                    <Download aria-hidden="true" /> Download QR
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={print}
                >
                    <Printer aria-hidden="true" /> Print
                </Button>
                <a
                    className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[0.8rem] font-medium text-primary hover:underline"
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                >
                    <ExternalLink className="size-3.5" aria-hidden="true" />{" "}
                    Open
                </a>
            </div>
            {actionError && (
                <p role="alert" className="text-sm text-destructive">
                    {actionError}
                </p>
            )}
        </div>
    )
}

function TableRow({ table, slug }: { table: Table; slug: string }) {
    const updateDetails = useMutation(api.tables.updateDetails)
    const archive = useMutation(api.tables.archive)
    const restore = useMutation(api.tables.restore)
    const getToken = useAction(api.tables.getToken)
    const regenerate = useAction(api.tables.regenerateToken)
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(table.name)
    const [area, setArea] = useState(table.area ?? "Main floor")
    const [serviceStatus, setServiceStatus] = useState<"available" | "reserved">(table.serviceStatus ?? "available")
    const [active, setActive] = useState(table.active)
    const [token, setToken] = useState<string>()
    const [qrOpen, setQrOpen] = useState(false)
    const [confirmArchive, setConfirmArchive] = useState(false)
    const [confirmRegenerate, setConfirmRegenerate] = useState(false)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string>()
    const revealRequest = useRef(0)
    const mounted = useRef(true)

    const closeQr = useCallback(() => {
        revealRequest.current += 1
        setQrOpen(false)
        setToken(undefined)
    }, [])

    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
            revealRequest.current += 1
        }
    }, [])

    async function run(action: () => Promise<unknown>) {
        if (pending) return false
        setPending(true)
        setError(undefined)
        try {
            await action()
        } catch (cause) {
            closeQr()
            setError(
                friendlyError(cause, "Unable to update this table. Try again.")
            )
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
        const saved = await run(() => updateDetails({ restaurantId: table.restaurantId, tableId: table._id, name: name.trim(), area: area.trim() || "Main floor", serviceStatus, active }))
        if (saved) setEditing(false)
    }

    const hiddenLink = table.archived || !active
    const revealLink = async () => {
        if (pending || !active || table.archived) return
        const request = ++revealRequest.current
        setPending(true)
        setError(undefined)
        try {
            const nextToken = await getToken({ tableId: table._id })
            if (
                mounted.current &&
                request === revealRequest.current &&
                active &&
                !table.archived
            ) {
                setToken(nextToken)
                setQrOpen(true)
            }
        } catch (cause) {
            if (mounted.current && request === revealRequest.current) {
                setToken(undefined)
                setQrOpen(false)
                setError(friendlyError(cause, "Unable to reveal this ordering link. Try again."))
            }
        } finally {
            if (mounted.current) setPending(false)
        }
    }
    return (
        <article
            className={`grid gap-4 rounded-xl border p-4 ${table.archived ? "bg-muted/20 opacity-80" : "bg-card"}`}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    {editing ? (
                        <form
                            className="flex flex-wrap gap-2"
                            onSubmit={saveName}
                        >
                        <Input
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                aria-label={`Name for ${table.name}`}
                                className="h-8 w-48"
                                autoFocus
                            />
                            <Input value={area} onChange={(event) => setArea(event.target.value)} aria-label={`Area for ${table.name}`} className="h-8 w-36" />
                            <select className="h-8 rounded-md border bg-background px-2 text-sm" value={serviceStatus} onChange={(event) => setServiceStatus(event.target.value as "available" | "reserved")} aria-label="Service status"><option value="available">Available</option><option value="reserved">Reserved</option></select>
                            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => { const nextActive = event.target.checked; setActive(nextActive); if (!nextActive) { closeQr() } }} /> Active</label>
                            <Button type="submit" size="sm" disabled={pending}>
                                {pending ? "Saving..." : "Save"}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditing(false)}
                                disabled={pending}
                            >
                                Cancel
                            </Button>
                        </form>
                     ) : (
                         <h3 className="flex items-center gap-2 font-semibold tracking-tight">
                             {table.name}
                            {table.archived && (
                                <span className="text-xs font-normal text-muted-foreground">
                                    Archived
                                </span>
                             )}
                         </h3>
                     )}
                    {!editing && (
                        <p className="mt-1 flex flex-wrap gap-2 text-sm text-muted-foreground">
                            <span className="rounded-full bg-muted px-2 py-0.5">
                                Area: {table.area ?? "Main floor"}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-0.5">
                                Service status: {table.serviceStatus === "reserved" ? "Reserved" : "Available"}
                            </span>
                        </p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">
                        {table.archived
                            ? "Archived and not available for ordering."
                            : active
                              ? "Active for guest ordering."
                              : "Inactive; guest ordering is paused."}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {!table.archived && (
                        <>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setEditing((value) => !value)}
                                disabled={pending}
                            >
                                <Pencil aria-hidden="true" />{" "}
                                {editing ? "Close" : "Rename"}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setEditing(true)}
                                disabled={pending}
                            >
                                Edit status
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => setConfirmArchive(true)}
                                disabled={pending}
                            >
                                <Archive aria-hidden="true" /> Archive
                            </Button>
                        </>
                    )}
                    {table.archived && (
                        <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                                void run(() => restore({ tableId: table._id }))
                            }
                            disabled={pending}
                        >
                            <RotateCcw aria-hidden="true" /> Restore
                        </Button>
                    )}
                </div>
            </div>
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            {!hiddenLink && (
                <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    {token ? (
                        <Button type="button" size="sm" variant="secondary" onClick={() => setQrOpen(true)}>QR dialog open</Button>
                    ) : (
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                             onClick={() => void revealLink()}
                            disabled={pending}
                        >
                            <Link2 aria-hidden="true" />{" "}
                            {pending
                                ? "Loading link..."
                                : "Reveal ordering link"}
                        </Button>
                    )}
                 </div>
             )}
              <Dialog open={qrOpen} onOpenChange={(open) => !open && closeQr()}>
                  <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                         <div>
                             <DialogTitle>{table.name} ordering QR</DialogTitle>
                             <DialogDescription>Share this private ordering link with guests.</DialogDescription>
                         </div>
                         <Button type="button" variant="ghost" onClick={closeQr}>Close</Button>
                      </div>
                       {qrOpen && token && (
                           <>
                               <TableLink slug={slug} token={token} />
                               <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setError(undefined)
                                        closeQr()
                                        setConfirmRegenerate(true)
                                    }}
                                   disabled={pending}
                               >
                                   Regenerate token
                               </Button>
                           </>
                       )}
                  </DialogContent>
              </Dialog>
              <ConfirmDialog
                  open={confirmRegenerate}
                  onOpenChange={(open) => {
                      setConfirmRegenerate(open)
                      if (!open) closeQr()
                  }}
                 title={`Regenerate ${table.name}'s ordering token?`}
                 description="The current ordering link will stop working immediately. You will need to reveal the replacement link again after confirmation."
                  confirmLabel="Regenerate token"
                  cancelLabel="Cancel"
                  pending={pending}
                  errorMessage={error}
                  onConfirm={() => run(() => regenerate({ tableId: table._id }))}
              />
             <ConfirmDialog
                open={confirmArchive}
                 onOpenChange={(open) => {
                     setConfirmArchive(open)
                     if (!open) closeQr()
                 }}
                title={`Archive ${table.name}?`}
                description="You can restore this table later."
                confirmLabel="Archive"
                 cancelLabel="Cancel"
                 pending={pending}
                 errorMessage={error}
                  onConfirm={async () => {
                     const succeeded = await run(() => archive({ tableId: table._id }))
                     if (!succeeded) throw new Error("Unable to complete this action.")
                     closeQr()
                     setConfirmArchive(false)
                 }}
            />
            {hiddenLink && (
                <p
                    role="status"
                    className="border-t pt-3 text-xs text-muted-foreground"
                >
                    {table.archived
                        ? "Restore this table to manage its ordering link."
                        : "Activate this table to manage its ordering link."}
                </p>
            )}
        </article>
    )
}

function TablesWorkspaceContent({ restaurant }: Props) {
    const tables = useQuery(api.tables.list, {
        restaurantId: restaurant._id,
        includeArchived: true,
    })
    const create = useAction(api.tables.create)
    const [name, setName] = useState("")
    const [area, setArea] = useState("Main floor")
    const [serviceStatus, setServiceStatus] = useState<"available" | "reserved">("available")
    const [areaFilter, setAreaFilter] = useState("All")
    const [statusFilter, setStatusFilter] = useState<"all" | "available" | "reserved">("all")
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string>()
    const [createdTableId, setCreatedTableId] =
        useState<Id<"restaurantTables">>()

    async function submit(event: React.FormEvent) {
        event.preventDefault()
        if (!name.trim() || pending) {
            setError("Use a table name before creating a table.")
            return
        }
        setPending(true)
        setError(undefined)
        try {
            const result = await create({
                restaurantId: restaurant._id,
                name: name.trim(),
                area,
                serviceStatus,
            })
            setCreatedTableId(result.tableId)
            setName("")
        } catch (cause) {
            setError(
                friendlyError(cause, "Unable to create this table. Try again.")
            )
        } finally {
            setPending(false)
        }
    }

    if (tables === undefined) return <p role="status">Loading tables...</p>
    const areas = ["All", ...Array.from(new Set(tables.map((table) => table.area)))]
    const visibleTables = tables.filter((table) => (areaFilter === "All" || table.area === areaFilter) && (statusFilter === "all" || table.serviceStatus === statusFilter))
    return (
        <section className="mx-auto grid min-w-0 w-full max-w-6xl gap-6 overflow-x-hidden break-words font-sans">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
                        Service floor
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                        Tables & ordering links
                    </h1>
                    <p className="mt-2 max-w-2xl text-muted-foreground">
                        Create one private ordering link per table. Keep links
                        hidden while a table is inactive or archived.
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck
                        className="size-4 text-primary"
                        aria-hidden="true"
                    />{" "}
                    Owner workspace
                </div>
            </header>
            <div>
                <Link
                    className="inline-flex h-8 items-center justify-center rounded-md border border-input px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                    href={`/dashboard/${restaurant.slug}/menu`}
                >
                    Menu
                </Link>
            </div>
            {createdTableId && (
                <Card className="border-primary/30 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="text-base">
                            Table created
                        </CardTitle>
                        <CardDescription>
                            Your table is ready. Reveal its ordering link from
                            the table below when you need it.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            The private QR secret is only shown while its dialog
                            is open.
                        </p>
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardHeader>
                    <CardTitle>Add a table</CardTitle>
                    <CardDescription>
                        New tables start active and ready for guest ordering.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="flex flex-wrap gap-2" onSubmit={submit}>
                            <Input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Table name, e.g. Patio 1"
                            aria-label="New table name"
                            className="max-w-sm"
                            disabled={pending}
                        />
                        <Input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Area" aria-label="New table area" className="max-w-xs" disabled={pending} />
                        <select value={serviceStatus} onChange={(event) => setServiceStatus(event.target.value as "available" | "reserved")} className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="New table service status"><option value="available">Available</option><option value="reserved">Reserved</option></select>
                        <Button type="submit" disabled={pending}>
                            {pending ? "Creating..." : "Create table"}
                        </Button>
                    </form>
                    {error && (
                        <p
                            role="alert"
                            className="mt-2 text-sm text-destructive"
                        >
                            {error}
                        </p>
                    )}
                </CardContent>
            </Card>
            <div className="flex flex-wrap items-center gap-2" aria-label="Table filters"><span className="text-sm font-medium">Areas:</span>{areas.map((value) => <Button key={value} type="button" size="sm" variant={areaFilter === value ? "default" : "outline"} onClick={() => setAreaFilter(value)}>{value}</Button>)}<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-8 rounded-md border bg-background px-2 text-sm" aria-label="Service status filter"><option value="all">All service status</option><option value="available">Available</option><option value="reserved">Reserved</option></select></div>
             {tables.length > 0 && visibleTables.length === 0 ? (
                 <Card className="border-dashed">
                     <CardHeader>
                         <CardTitle>No tables match these filters</CardTitle>
                         <CardDescription>
                             Try changing the area or service status filters.
                         </CardDescription>
                     </CardHeader>
                 </Card>
             ) : tables.length === 0 ? (
                 <Card className="border-dashed">
                    <CardHeader>
                        <CardTitle>No tables yet</CardTitle>
                        <CardDescription>
                            Create your first table above to start sharing guest
                            ordering links.
                        </CardDescription>
                    </CardHeader>
                </Card>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleTables.map((table) => (
                        <TableRow
                            key={`${table._id}-${table.active ? "active" : "inactive"}-${table.archived ? "archived" : "current"}`}
                            table={table}
                            slug={restaurant.slug}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}

export function TablesWorkspace({ restaurant }: Props) {
    return (
        <QueryErrorBoundary>
            <TablesWorkspaceContent restaurant={restaurant} />
        </QueryErrorBoundary>
    )
}
