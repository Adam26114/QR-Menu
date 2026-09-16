import Link from "next/link"
import { buttonVariants } from "@workspace/ui/components/button"

export default function Page() {
    return (
        <main className="relative flex min-h-svh items-center overflow-hidden bg-muted/20 p-6 md:p-12">
            <div className="absolute -top-32 -right-32 size-96 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
            <div className="relative mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div className="max-w-2xl">
                    <p className="text-sm font-semibold tracking-[0.22em] text-primary uppercase">Resto desk</p>
                    <h1 className="mt-5 text-5xl leading-[0.98] font-semibold tracking-[-0.04em] sm:text-6xl md:text-7xl">
                        Make every service feel <span className="text-primary">well run.</span>
                    </h1>
                    <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                        One calm workspace for restaurant teams to keep menus, tables, orders, and people moving together.
                    </p>
                    <Link href="/dashboard" className={`${buttonVariants({ size: "lg" })} mt-8`}>
                        Open your restaurant desk
                    </Link>
                    <p className="mt-5 text-sm text-muted-foreground">Built for the rush, designed for clarity.</p>
                </div>
                <div className="rounded-3xl border bg-card p-5 shadow-xl shadow-primary/5 sm:p-7">
                    <div className="flex items-center justify-between border-b pb-5">
                        <div><p className="text-sm font-medium text-muted-foreground">Tonight at</p><p className="text-xl font-semibold">The Juniper Room</p></div>
                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Service live</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 py-5 sm:grid-cols-3">
                        {[['12', 'Open tables'], ['08', 'In the kitchen'], ['34', 'Covers served']].map(([value, label]) => <div key={label} className="rounded-2xl bg-muted/60 p-4"><p className="text-2xl font-semibold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>)}
                    </div>
                    <div className="rounded-2xl border border-dashed p-4"><p className="text-sm font-medium">A clearer handoff</p><p className="mt-1 text-sm text-muted-foreground">Keep the floor, kitchen, and front desk in the same rhythm.</p></div>
                </div>
            </div>
        </main>
    )
}
