"use client"

import { Component, type ReactNode, useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import type { Doc, Id } from "../../../../convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"

type Props = { restaurant: Doc<"restaurants"> }

function ErrorMessage({ error }: { error?: unknown }) {
  return error ? <p role="alert" className="text-sm text-destructive">Unable to save this change. Please try again.</p> : null
}

class QueryErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() { return this.state.hasError ? <p role="alert" className="text-sm text-destructive">Unable to load menu data. Please try again.</p> : this.props.children }
}

function CategoryEditor({ restaurantId, category, onDone }: { restaurantId: Id<"restaurants">; category?: Doc<"menuCategories">; onDone: () => void }) {
  const save = useMutation(category ? api.menu.updateCategory : api.menu.createCategory)
  const [name, setName] = useState(category?.name ?? "")
  const [error, setError] = useState<unknown>()
  const [pending, setPending] = useState(false)
  return <form className="flex flex-wrap gap-2" onSubmit={async (event) => { event.preventDefault(); if (pending) return; setError(undefined); setPending(true); try { if (category) await save({ categoryId: category._id, name }); else await save({ restaurantId, name }); onDone() } catch (e) { setError(e) } finally { setPending(false) } }}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name" aria-label="Category name" /><Button type="submit" disabled={pending}>{pending ? "Saving..." : category ? "Save" : "Add"}</Button><ErrorMessage error={error} /></form>
}

function ItemEditor({ restaurantId, categoryId, item, onDone }: { restaurantId: Id<"restaurants">; categoryId: Id<"menuCategories">; item?: Doc<"menuItems">; onDone: () => void }) {
  const save = useMutation(item ? api.menu.updateItem : api.menu.createItem)
  const [name, setName] = useState(item?.name ?? "")
  const [priceMinor, setPrice] = useState(String(item?.priceMinor ?? 0))
  const [error, setError] = useState<unknown>()
  const [pending, setPending] = useState(false)
  return <form className="grid gap-2" onSubmit={async (event) => { event.preventDefault(); if (pending) return; setError(undefined); setPending(true); try { if (item) await save({ itemId: item._id, name, priceMinor: Number(priceMinor) }); else await save({ restaurantId, categoryId, name, priceMinor: Number(priceMinor) }); onDone() } catch (e) { setError(e) } finally { setPending(false) } }}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" aria-label="Item name" /><Input type="number" value={priceMinor} onChange={(e) => setPrice(e.target.value)} aria-label="Price in minor units" /><Button type="submit" disabled={pending}>{pending ? "Saving..." : item ? "Save item" : "Add item"}</Button><ErrorMessage error={error} /></form>
}

type GroupProps = { itemId: Id<"menuItems">; group?: Doc<"menuOptionGroups">; onDone: () => void }

function OptionGroupForm({ itemId, group, onDone }: GroupProps) {
  const save = useMutation(group ? api.menu.updateOptionGroup : api.menu.createOptionGroup)
  const [name, setName] = useState(group?.name ?? "")
  const [mode, setMode] = useState<"single" | "multiple">(group?.selectionMode ?? "single")
  const [required, setRequired] = useState(group?.required ?? false)
  const [min, setMin] = useState(String(group?.minSelections ?? 0))
  const [max, setMax] = useState(String(group?.maxSelections ?? 1))
  const [error, setError] = useState<unknown>()
  const [pending, setPending] = useState(false)
  return <form className="grid gap-3 rounded-md border border-dashed p-3" aria-label={group ? `Edit ${group.name} option group` : "Add option group"} onSubmit={async (event) => { event.preventDefault(); if (pending) return; setError(undefined); setPending(true); try { const values = { name, selectionMode: mode, required, minSelections: Number(min), maxSelections: Number(max) }; if (group) await save({ optionGroupId: group._id, ...values }); else await save({ itemId, ...values }); onDone() } catch (e) { setError(e) } finally { setPending(false) } }}>
    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Option group name" aria-label="Option group name" />
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Selection mode<select className="h-9 rounded-md border bg-background px-2" value={mode} onChange={(e) => setMode(e.target.value as "single" | "multiple")}><option value="single">Single choice</option><option value="multiple">Multiple choices</option></select></label>
      <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required</label>
      <label className="grid gap-1 text-sm">Minimum selections<Input type="number" min="0" value={min} onChange={(e) => setMin(e.target.value)} aria-label="Minimum selections" /></label>
      <label className="grid gap-1 text-sm">Maximum selections<Input type="number" min="0" value={max} onChange={(e) => setMax(e.target.value)} aria-label="Maximum selections" /></label>
    </div>
    <div className="flex flex-wrap items-center gap-2"><Button type="submit" disabled={pending}>{pending ? "Saving..." : group ? "Save group" : "Add group"}</Button>{group && <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>Cancel</Button>}<ErrorMessage error={error} /></div>
  </form>
}

function OptionChoiceEditor({ groupId, choice, onDone }: { groupId: Id<"menuOptionGroups">; choice?: Doc<"menuOptionChoices">; onDone: () => void }) {
  const save = useMutation(choice ? api.menu.updateOptionChoice : api.menu.createOptionChoice)
  const [name, setName] = useState(choice?.name ?? "")
  const [price, setPrice] = useState(String(choice?.priceDeltaMinor ?? 0))
  const [error, setError] = useState<unknown>()
  const [pending, setPending] = useState(false)
  return <form className="flex flex-wrap gap-2" onSubmit={async (event) => { event.preventDefault(); if (pending) return; setError(undefined); setPending(true); try { if (choice) await save({ optionChoiceId: choice._id, name, priceDeltaMinor: Number(price) }); else await save({ optionGroupId: groupId, name, priceDeltaMinor: Number(price) }); onDone() } catch (e) { setError(e) } finally { setPending(false) } }}><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Choice name" aria-label="Choice name" /><Input className="w-36" type="number" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="Price adjustment in minor units" placeholder="Price delta" /><Button type="submit" size="sm" disabled={pending}>{pending ? "Saving..." : choice ? "Save choice" : "Add choice"}</Button>{choice && <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={pending}>Cancel</Button>}<ErrorMessage error={error} /></form>
}

function OptionGroup({ group }: { group: Doc<"menuOptionGroups"> }) {
  const choices = useQuery(api.menu.listOptionChoices, { optionGroupId: group._id, includeArchived: true })
  const archive = useMutation(api.menu.archiveOptionGroup)
  const restore = useMutation(api.menu.restoreOptionGroup)
  const archiveChoice = useMutation(api.menu.archiveOptionChoice)
  const restoreChoice = useMutation(api.menu.restoreOptionChoice)
  const [editing, setEditing] = useState(false)
  const [editingChoice, setEditingChoice] = useState<Id<"menuOptionChoices">>()
  const [error, setError] = useState<unknown>()
  const [pending, setPending] = useState(false)
  async function run(action: () => Promise<unknown>) { if (pending) return; setError(undefined); setPending(true); try { await action() } catch (e) { setError(e) } finally { setPending(false) } }
  return <div className={`grid gap-3 rounded-lg border p-4 ${group.archived ? "opacity-70" : ""}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-medium">{group.name} {group.archived && <span className="text-sm text-muted-foreground">(archived)</span>}</h4><p className="text-sm text-muted-foreground">{group.selectionMode === "multiple" ? "Choose multiple" : "Choose one"} · {group.required ? "Required" : "Optional"} · {group.minSelections}-{group.maxSelections} selections</p></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setEditing((value) => !value)} disabled={pending}>{editing ? "Close" : "Edit group"}</Button>{group.archived ? <Button type="button" size="sm" onClick={() => run(() => restore({ optionGroupId: group._id }))} disabled={pending}>Restore</Button> : <Button type="button" size="sm" onClick={() => run(() => archive({ optionGroupId: group._id }))} disabled={pending}>Archive</Button>}</div></div>{editing && <OptionGroupForm itemId={group.menuItemId} group={group} onDone={() => setEditing(false)} />}<div className="grid gap-2 pl-3 sm:pl-5"><div className="flex items-center justify-between gap-2"><h5 className="text-sm font-medium">Choices</h5><OptionChoiceEditor groupId={group._id} onDone={() => setError(undefined)} /></div>{choices === undefined ? <p className="text-sm text-muted-foreground" role="status">Loading choices...</p> : choices.length === 0 ? <p className="text-sm text-muted-foreground">No choices yet.</p> : choices.map((choice) => <div key={choice._id} className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 ${choice.archived ? "opacity-60" : ""}`}><span className="text-sm">{choice.name} <span className="text-muted-foreground">({choice.priceDeltaMinor >= 0 ? "+" : ""}{choice.priceDeltaMinor})</span>{choice.archived && <span className="ml-1 text-muted-foreground">(archived)</span>}</span><div className="flex gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setEditingChoice(choice._id)} disabled={pending}>Edit</Button>{choice.archived ? <Button type="button" size="sm" onClick={() => run(() => restoreChoice({ optionChoiceId: choice._id }))} disabled={pending}>Restore</Button> : <Button type="button" size="sm" onClick={() => run(() => archiveChoice({ optionChoiceId: choice._id }))} disabled={pending}>Archive</Button>}</div>{editingChoice === choice._id && <div className="basis-full"><OptionChoiceEditor groupId={group._id} choice={choice} onDone={() => setEditingChoice(undefined)} /></div>}</div>)}</div><ErrorMessage error={error} /></div>
}

function OptionGroupsEditor({ item }: { item: Doc<"menuItems"> }) {
  const groups = useQuery(api.menu.listOptionGroups, { itemId: item._id, includeArchived: true })
  const [adding, setAdding] = useState(false)
  if (groups === undefined) return <p className="text-sm text-muted-foreground" role="status">Loading option groups...</p>
  return <div className="grid gap-3 rounded-md bg-muted/30 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-medium">Options</h3><p className="text-sm text-muted-foreground">Customize choices and add-ons for this item.</p></div><Button type="button" size="sm" variant="outline" onClick={() => setAdding((value) => !value)}>{adding ? "Close" : "Add option group"}</Button></div>{adding && <OptionGroupForm itemId={item._id} onDone={() => setAdding(false)} />}{groups.length === 0 && !adding ? <p className="text-sm text-muted-foreground">No option groups yet.</p> : groups.map((group) => <OptionGroup key={group._id} group={group} />)}</div>
}

function MenuWorkspaceContent({ restaurant }: Props) {
  const categories = useQuery(api.menu.listCategories, { restaurantId: restaurant._id, includeArchived: true })
  const items = useQuery(api.menu.listItems, { restaurantId: restaurant._id, includeArchived: true })
  const reorderCategories = useMutation(api.menu.reorderCategories)
  const reorderItems = useMutation(api.menu.reorderItems)
  const archiveCategory = useMutation(api.menu.archiveCategory)
  const restoreCategory = useMutation(api.menu.restoreCategory)
  const archiveItem = useMutation(api.menu.archiveItem)
  const restoreItem = useMutation(api.menu.restoreItem)
  const setAvailability = useMutation(api.menu.setAvailability)
  const [selected, setSelected] = useState<Id<"menuCategories">>()
  const [editingCategory, setEditingCategory] = useState<Id<"menuCategories">>()
  const [editingItem, setEditingItem] = useState<Id<"menuItems">>()
  const [error, setError] = useState<unknown>()
  if (categories === undefined || items === undefined) return <p role="status">Loading menu...</p>
  const active = categories.filter((category) => !category.archived)
  const category = categories.find((value) => value._id === selected) ?? active[0]
  const categoryItems = category ? items.filter((item) => item.categoryId === category._id) : []
  const activeCategoryItems = categoryItems.filter((item) => !item.archived)
  async function run(action: () => Promise<unknown>) { setError(undefined); try { await action() } catch (e) { setError(e) } }
  async function moveCategory(index: number, direction: -1 | 1) { const next = [...active]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target]!, next[index]!]; await run(() => reorderCategories({ restaurantId: restaurant._id, orderedCategoryIds: next.map((value) => value._id) })) }
  async function moveItem(index: number, direction: -1 | 1) { if (!category) return; const next = [...activeCategoryItems]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target]!, next[index]!]; await run(() => reorderItems({ restaurantId: restaurant._id, categoryId: category._id, orderedItemIds: next.map((value) => value._id) })) }
  return <section className="mx-auto grid max-w-6xl gap-6"><ErrorMessage error={error} /><Card><CardHeader><CardTitle>Menu categories</CardTitle></CardHeader><CardContent className="grid gap-3"><CategoryEditor restaurantId={restaurant._id} onDone={() => setError(undefined)} />{categories.map((value) => { const index = active.findIndex((entry) => entry._id === value._id); return <div key={value._id} className="flex flex-wrap items-center gap-2"><Button type="button" variant="ghost" onClick={() => setSelected(value._id)}>{value.name}{value.archived ? " (archived)" : ""}</Button>{!value.archived && <><Button type="button" size="sm" onClick={() => setEditingCategory(value._id)}>Edit</Button><Button type="button" size="sm" onClick={() => run(() => archiveCategory({ categoryId: value._id }))}>Archive</Button><Button type="button" size="sm" onClick={() => moveCategory(index, -1)}>Up</Button><Button type="button" size="sm" onClick={() => moveCategory(index, 1)}>Down</Button></>}{value.archived && <Button type="button" size="sm" onClick={() => run(() => restoreCategory({ categoryId: value._id }))}>Restore</Button>}{editingCategory === value._id && <CategoryEditor restaurantId={restaurant._id} category={value} onDone={() => setEditingCategory(undefined)} />}</div>})}</CardContent></Card>{category && <Card><CardHeader><CardTitle>{category.name}</CardTitle></CardHeader><CardContent className="grid gap-4"><ItemEditor restaurantId={restaurant._id} categoryId={category._id} onDone={() => setError(undefined)} />{categoryItems.map((item) => <div key={item._id} className="grid gap-3 rounded border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span>{item.name} - {item.priceMinor}</span><div className="flex flex-wrap gap-1"><Button type="button" size="sm" onClick={() => run(() => setAvailability({ itemId: item._id, available: !item.available }))}>{item.available ? "Available" : "Unavailable"}</Button>{item.archived ? <Button type="button" size="sm" onClick={() => run(() => restoreItem({ itemId: item._id }))}>Restore</Button> : <Button type="button" size="sm" onClick={() => run(() => archiveItem({ itemId: item._id }))}>Archive</Button>}<Button type="button" size="sm" onClick={() => setEditingItem(item._id)}>Edit</Button><Button type="button" size="sm" onClick={() => moveItem(activeCategoryItems.findIndex((entry) => entry._id === item._id), -1)}>Up</Button><Button type="button" size="sm" onClick={() => moveItem(activeCategoryItems.findIndex((entry) => entry._id === item._id), 1)}>Down</Button></div></div>{editingItem === item._id && <ItemEditor restaurantId={restaurant._id} categoryId={category._id} item={item} onDone={() => setEditingItem(undefined)} />}<OptionGroupsEditor item={item} /></div>)}</CardContent></Card>}</section>
}

export function MenuWorkspace({ restaurant }: Props) {
  return <QueryErrorBoundary><MenuWorkspaceContent restaurant={restaurant} /></QueryErrorBoundary>
}
