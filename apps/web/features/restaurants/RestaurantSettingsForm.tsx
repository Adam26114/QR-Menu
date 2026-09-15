"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { useFieldArray, useForm, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "../../../../convex/_generated/api"
import type { Doc, Id } from "../../../../convex/_generated/dataModel"
import { ArchiveControls } from "./RestaurantWorkspace"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

const intervalSchema = z.object({
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
}).refine((interval) => interval.startMinute < interval.endMinute, {
  message: "Close time must be after open time",
  path: ["endMinute"],
})

const businessDaySchema = z.object({
  day: z.number().int().min(0).max(6),
  intervals: z.array(intervalSchema),
})

const schema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  phone: z.string(),
  email: z.string(),
  address: z.string(),
  logoStorageId: z.string(),
  currency: z.string().length(3),
  timezone: z.string().min(1),
  taxBps: z.number().int().min(0).max(10000),
  serviceChargeBps: z.number().int().min(0).max(10000),
  acceptanceMode: z.enum(["open", "closed", "scheduled"]),
  businessHours: z.array(businessDaySchema).length(7),
})

type Values = z.infer<typeof schema>

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const emptyHours = (): Values["businessHours"] => dayNames.map((_, day) => ({ day, intervals: [] }))

function HoursDay({
  day,
  control,
  register,
  errors,
}: {
  day: number
  control: Control<Values>
  register: UseFormRegister<Values>
  errors: FieldErrors<Values>
}) {
  const intervals = useFieldArray({ control, name: `businessHours.${day}.intervals` })
  const dayErrors = errors.businessHours?.[day]?.intervals
  const closed = intervals.fields.length === 0

  return (
    <fieldset className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <legend className="px-1 text-sm font-medium">{dayNames[day]}</legend>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={closed}
            onChange={() => {
              if (closed) intervals.append({ startMinute: 540, endMinute: 1020 })
              else intervals.remove()
            }}
            className="size-4 rounded border-input accent-primary"
            aria-label={`${dayNames[day]} closed`}
          />
          Closed
        </label>
        {!closed && (
          <div className="grid min-w-[260px] flex-1 gap-2">
            {intervals.fields.map((interval, index) => (
              <div key={interval.id} className="flex flex-wrap items-end gap-2">
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground" htmlFor={`hours-${day}-${index}-open`}>Open (minute)</Label>
                  <Input id={`hours-${day}-${index}-open`} type="number" min={0} max={1439} className="h-8 w-28" {...register(`businessHours.${day}.intervals.${index}.startMinute`, { valueAsNumber: true })} />
                </div>
                <span className="pb-2 text-muted-foreground" aria-hidden="true">to</span>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground" htmlFor={`hours-${day}-${index}-close`}>Close (minute)</Label>
                  <Input id={`hours-${day}-${index}-close`} type="number" min={1} max={1440} className="h-8 w-28" {...register(`businessHours.${day}.intervals.${index}.endMinute`, { valueAsNumber: true })} />
                </div>
                {intervals.fields.length > 1 && <Button type="button" variant="ghost" size="sm" className="mb-0.5" onClick={() => intervals.remove(index)}>Remove</Button>}
                {dayErrors?.[index]?.endMinute?.message && <p className="basis-full text-xs text-destructive">{dayErrors[index]?.endMinute?.message}</p>}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => intervals.append({ startMinute: 540, endMinute: 1020 })}>Add interval</Button>
          </div>
        )}
      </div>
    </fieldset>
  )
}

export function RestaurantSettingsForm({ restaurant }: { restaurant: Doc<"restaurants"> }) {
  const update = useMutation(api.restaurants.updateSettings)
  const [feedback, setFeedback] = useState<string>()
  const businessHours = emptyHours()
  for (const entry of restaurant.businessHours ?? []) {
    if (entry.day >= 0 && entry.day < 7) businessHours[entry.day] = entry
  }
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: restaurant.name,
      slug: restaurant.slug,
      phone: restaurant.phone ?? "",
      email: restaurant.email ?? "",
      address: restaurant.address ?? "",
      logoStorageId: restaurant.logoStorageId ?? "",
      currency: restaurant.currency ?? "MMK",
      timezone: restaurant.timezone ?? "Asia/Yangon",
      taxBps: restaurant.taxBps ?? 0,
      serviceChargeBps: restaurant.serviceChargeBps ?? 0,
      acceptanceMode: restaurant.acceptanceMode ?? "open",
      businessHours,
    },
  })

  async function submit(values: Values) {
    setFeedback(undefined)
    try {
      await update({
        restaurantId: restaurant._id,
        patch: {
          ...values,
          logoStorageId: (values.logoStorageId.trim() || null) as Id<"_storage"> | null,
          phone: values.phone || null,
          email: values.email || null,
          address: values.address || null,
        },
      })
      setFeedback("Settings saved")
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save settings")
    }
  }

  const field = (name: keyof Values, label: string, type = "text") => (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} type={type} {...form.register(name, type === "number" ? { valueAsNumber: true } : undefined)} aria-invalid={Boolean(form.formState.errors[name])} />
      {form.formState.errors[name] && <p className="text-sm text-destructive">{form.formState.errors[name]?.message as string}</p>}
    </div>
  )

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header><p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Restaurant settings</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">{restaurant.name}</h1><p className="mt-2 text-muted-foreground">Keep the details your guests and service team rely on up to date.</p></header>
      <form onSubmit={form.handleSubmit(submit)} className="grid gap-6">
        <Card><CardHeader><CardTitle>Profile</CardTitle><CardDescription>Public contact details and workspace identity.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{field("name", "Restaurant name")}{field("slug", "URL slug")}{field("phone", "Phone")}{field("email", "Email", "email")}<div className="sm:col-span-2">{field("address", "Address")}</div><div className="grid gap-2 sm:col-span-2"><Label htmlFor="logoStorageId">Logo storage ID</Label><Input id="logoStorageId" placeholder="Add after upload support is available" {...form.register("logoStorageId")} /><p className="text-xs text-muted-foreground">Paste an existing storage ID. Uploading a logo is not available here yet.</p></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Business hours</CardTitle><CardDescription>Use minutes from midnight. Leave a day closed or add multiple same-day intervals.</CardDescription></CardHeader><CardContent className="grid gap-2">{dayNames.map((_, day) => <HoursDay key={day} day={day} control={form.control} register={form.register} errors={form.formState.errors} />)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Service rules</CardTitle><CardDescription>Defaults for pricing and accepting orders.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{field("currency", "Currency")}{field("timezone", "Timezone")}{field("taxBps", "Tax (basis points)", "number")}{field("serviceChargeBps", "Service charge (basis points)", "number")}<div className="grid gap-2"><Label htmlFor="acceptanceMode">Acceptance mode</Label><select id="acceptanceMode" {...form.register("acceptanceMode")} className="h-8 rounded-lg border border-input bg-background px-2 text-sm"><option value="open">Open</option><option value="closed">Closed</option><option value="scheduled">Scheduled</option></select></div></CardContent></Card>
        <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving..." : "Save changes"}</Button>{feedback && <p role="status" className="text-sm text-muted-foreground">{feedback}</p>}</div>
      </form>
      <Card className="border-destructive/30"><CardHeader><CardTitle>Archive restaurant</CardTitle><CardDescription>Archived restaurants stop accepting orders and disappear from the restaurant switcher. You can restore them later.</CardDescription></CardHeader><CardContent><ArchiveControls restaurantId={restaurant._id} archived={restaurant.archived} /></CardContent></Card>
    </section>
  )
}
