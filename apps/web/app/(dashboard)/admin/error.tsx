"use client"

import { Button } from "@workspace/ui/components/button"

export default function AdminError({ reset }: { reset: () => void }) {
    return (
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 py-12">
            <h1 className="text-2xl font-semibold tracking-tight">Platform controls are unavailable</h1>
            <p className="text-muted-foreground">The restaurant list could not load. Try again without changing any subscription policy.</p>
            <Button className="mt-2 w-fit" onClick={reset}>Try again</Button>
        </main>
    )
}
