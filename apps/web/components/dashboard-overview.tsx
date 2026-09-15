"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { ArrowRight, MapPin, Plus, Store } from "lucide-react"
import { api } from "../../../convex/_generated/api"
import { buttonVariants } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"

export function DashboardOverview() {
  const restaurants = useQuery(api.restaurants.list)

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Restaurant desk</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Choose a restaurant</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">Open a workspace to manage service, settings, and your team.</p>
        </div>
        <Link className={buttonVariants()} href="/dashboard/new"><Plus aria-hidden="true" /> Add restaurant</Link>
      </header>

      {restaurants?.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardHeader><div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Store aria-hidden="true" /></div><CardTitle>Your first restaurant starts here</CardTitle><CardDescription>Create a restaurant profile before taking orders or inviting staff.</CardDescription></CardHeader>
          <CardContent><Link className={buttonVariants()} href="/dashboard/new">Create restaurant <ArrowRight aria-hidden="true" /></Link></CardContent>
        </Card>
      ) : restaurants === undefined ? (
        <div className="grid gap-4 md:grid-cols-2"><div className="h-36 animate-pulse rounded-xl bg-muted" /><div className="h-36 animate-pulse rounded-xl bg-muted" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {restaurants.map((restaurant) => <Link key={restaurant._id} href={`/dashboard/${restaurant.slug}`} className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl">
            <Card className="h-full transition-colors group-hover:border-primary/50"><CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle>{restaurant.name}</CardTitle><CardDescription className="mt-1">/{restaurant.slug}</CardDescription></div><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">Active</span></CardHeader><CardContent className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" aria-hidden="true" /> Open workspace <ArrowRight className="ml-auto size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></CardContent></Card>
          </Link>)}
        </div>
      )}
    </section>
  )
}
