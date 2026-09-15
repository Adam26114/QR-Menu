"use client"

import { Button } from "@workspace/ui/components/button"
import { ConfirmDialog } from "@/components/global/ConfirmDialog"
import { useState } from "react"
import type { Doc } from "../../../../../convex/_generated/dataModel"
import { ProjectForm } from "./ProjectForm"
import type { ProjectFormValues } from "../schemas"

type ProjectCardProps = {
  project: Doc<"projects">
  editing: boolean
  updating: boolean
  deleting: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (values: ProjectFormValues) => Promise<void>
  onRemove: () => Promise<void>
}

/**
 * SOURCE OF TRUTH KEYWORDS: project card, project edit, project delete, project item
 * WHAT: Displays one project and exposes its edit and remove actions.
 * WHY: Item-level behavior remains reusable and separate from the collection orchestration.
 * WHERE: ProjectsView renders one card per Convex project document.
 */
export function ProjectCard({ project, editing, updating, deleting, onEdit, onCancel, onSave, onRemove }: ProjectCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
   if (editing) return <article className="rounded-lg border bg-card p-4"><ProjectForm initialValues={{ name: project.name, description: project.description ?? "" }} submitLabel="Save changes" onSubmit={onSave} onCancel={onCancel} disabled={updating} /></article>
  return <article className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4">
    <div className="min-w-0"><h2 className="font-medium">{project.name}</h2><p className="mt-1 text-sm text-muted-foreground">{project.description || "No description yet."}</p></div>
     <div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" disabled={updating || deleting} onClick={onEdit}>Edit</Button><Button variant="ghost" size="sm" disabled={updating || deleting} onClick={() => setConfirmOpen(true)}>Delete</Button></div>
     <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title="Delete project?" description={`This will permanently delete ${project.name}.`} confirmLabel="Delete project" cancelLabel="Cancel" pending={deleting} onConfirm={onRemove} />
  </article>
}
