import { ArrowUpRight, BarChart3, FolderKanban, ListTodo } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

const previewCards = [
  {
    label: "Example projects",
    value: "12",
    change: "+8.2%",
    icon: FolderKanban,
  },
  { label: "Example tasks", value: "573", change: "+12.5%", icon: ListTodo },
  {
    label: "Example completion",
    value: "84.6%",
    change: "+4.3%",
    icon: BarChart3,
  },
]

const chartBars = [42, 58, 48, 70, 62, 79, 66, 88, 74, 92, 81, 96]

/** A deliberately static presentation layer for the dashboard overview. */
export function DashboardOverview() {
  return (
    <section
      aria-labelledby="dashboard-overview-title"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Workspace</p>
          <h1
            id="dashboard-overview-title"
            className="text-3xl font-semibold tracking-tight"
          >
            Overview
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            A quick view of your workspace.
          </p>
        </div>
        <span className="w-fit rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          Starter preview
        </span>
      </header>

      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Example data only.</span>{" "}
        These preview values are illustrative and are not production workspace
        metrics.
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {previewCards.map(({ label, value, change, icon: Icon }) => (
          <Card key={label} className="gap-4 py-5">
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <CardDescription>{label}</CardDescription>
              <Icon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <CardTitle className="text-2xl">{value}</CardTitle>
              <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <ArrowUpRight className="size-3" aria-hidden="true" />
                {change} example
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Example activity</CardTitle>
            <CardDescription>
              A visual placeholder for a future workspace trend.
            </CardDescription>
          </div>
          <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            Demo chart
          </span>
        </CardHeader>
        <CardContent>
          <div
            className="flex h-48 items-end gap-2 border-b border-l px-3 pt-6 pb-0"
            role="img"
            aria-label="Example activity chart showing an illustrative upward trend over twelve periods"
          >
            {chartBars.map((height, index) => (
              <div
                key={index}
                className="group flex h-full flex-1 items-end"
                aria-hidden="true"
              >
                <div
                  className="w-full rounded-t-sm bg-primary/70 transition-colors group-hover:bg-primary"
                  style={{ height: `${height}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between pl-3 text-xs text-muted-foreground">
            <span>Example period 1</span>
            <span>Example period 12</span>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
