import Link from "next/link"
import { Button } from "@workspace/ui/components/button"

export default function Page() {
  return (
    <div className="flex min-h-svh items-center p-6">
      <div className="mx-auto flex max-w-xl min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="text-3xl font-semibold">A reusable Convex foundation.</h1>
          <p className="text-muted-foreground">Layered backend, Better Auth, and an owner-scoped projects example for your next app.</p>
          <Button className="mt-2"><Link href="/dashboard">Open projects</Link></Button>
        </div>
        <div className="text-muted-foreground font-mono text-xs">
          Convex owns server data. Redux is reserved for transient UI state.
        </div>
      </div>
    </div>
  )
}
