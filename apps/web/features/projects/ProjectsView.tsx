"use client"

import { useState } from "react"
import { toast } from "@workspace/ui/components/sonner"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import type { Id } from "../../../../convex/_generated/dataModel"
import { getSafeErrorMessage } from "@/lib/errors"
import { ProjectCard } from "./components/ProjectCard"
import { ProjectForm } from "./components/ProjectForm"
import { useProjects } from "./hooks/useProjects"
import { useCreateProject } from "./hooks/useCreateProject"
import { useUpdateProject } from "./hooks/useUpdateProject"
import { useDeleteProject } from "./hooks/useDeleteProject"
import type { ProjectFormValues } from "./schemas"

/**
 * SOURCE OF TRUTH KEYWORDS: projects feature entry, project workspace, Convex CRUD, feedback states
 * WHAT: Composes the project list and its create, edit, and delete flows.
 * WHY: The route remains a thin composition point while this feature demonstrates reusable architecture.
 * WHERE: The authenticated dashboard page renders this entry component.
 */
export function ProjectsView() {
    const { results: projects, status, loadMore } = useProjects()
    const createProject = useCreateProject()
    const updateProject = useUpdateProject()
    const removeProject = useDeleteProject()
    const [editingId, setEditingId] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [updatingId, setUpdatingId] = useState<Id<"projects"> | null>(null)
    const [deletingId, setDeletingId] = useState<Id<"projects"> | null>(null)

    /** SOURCE OF TRUTH KEYWORDS: create project submit, mutation feedback, project form
     * WHAT: Creates a project and resets transient feedback state.
     * WHY: Mutation failures should be visible without duplicating server data in client state.
     * WHERE: The create form invokes this handler.
     */
    const create = async (values: ProjectFormValues) => {
        setCreating(true)
        try {
            await createProject(values)
            toast.success("Project created.")
        } catch (error) {
            toast.error(
                getSafeErrorMessage(
                    error instanceof Error ? error : new Error(),
                    "Could not create the project."
                )
            )
        } finally {
            setCreating(false)
        }
    }

    const update = async (
        projectId: Id<"projects">,
        values: ProjectFormValues
    ) => {
        setUpdatingId(projectId)
        try {
            await updateProject({ projectId, ...values })
            setEditingId(null)
            toast.success("Project updated.")
        } catch (error) {
            toast.error(
                getSafeErrorMessage(
                    error instanceof Error ? error : new Error(),
                    "Could not update the project."
                )
            )
        } finally {
            setUpdatingId(null)
        }
    }

    const remove = async (projectId: Id<"projects">) => {
        setDeletingId(projectId)
        try {
            await removeProject({ projectId })
            toast.success("Project deleted.")
        } catch (error) {
            toast.error(
                getSafeErrorMessage(
                    error instanceof Error ? error : new Error(),
                    "Could not delete the project."
                )
            )
            throw error
        } finally {
            setDeletingId(null)
        }
    }

    return (
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
            <header>
                <p className="text-sm text-muted-foreground">
                    Workspace example
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">
                    Projects
                </h1>
                <p className="mt-1 text-muted-foreground">
                    A feature-local Convex CRUD flow with shared validation.
                </p>
            </header>
            <div className="rounded-lg border bg-card p-4">
                <h2 className="mb-3 font-medium">Create a project</h2>
                <ProjectForm
                    submitLabel={creating ? "Saving..." : "Create project"}
                    onSubmit={create}
                    disabled={creating}
                />
            </div>
            <div className="grid gap-3">
                {status === "LoadingFirstPage" && (
                    <>
                        <Skeleton className="h-24" />
                        <Skeleton className="h-24" />
                    </>
                )}
                {projects.length === 0 && status !== "LoadingFirstPage" && (
                    <div className="rounded-lg border border-dashed p-8 text-center">
                        <p className="font-medium">No projects yet</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Create your first project above.
                        </p>
                    </div>
                )}
                {projects.map((project) => (
                    <ProjectCard
                        key={project._id}
                        project={project}
                        editing={editingId === project._id}
                        updating={updatingId === project._id}
                        deleting={deletingId === project._id}
                        onEdit={() => setEditingId(project._id)}
                        onCancel={() => setEditingId(null)}
                        onSave={(values) => update(project._id, values)}
                        onRemove={() => remove(project._id)}
                    />
                ))}
                {status === "CanLoadMore" && (
                    <Button variant="outline" onClick={() => loadMore(10)}>
                        Load more
                    </Button>
                )}
                {status === "LoadingMore" && (
                    <Skeleton
                        className="h-10"
                        aria-label="Loading more projects"
                    />
                )}
                {/* SOURCE OF TRUTH KEYWORDS: exhausted project pagination, project list end state
                 * WHAT: Communicates that all available project results are currently rendered.
                 * WHY: Users need a clear end-of-list state when Convex pagination is exhausted.
                 * WHERE: The projects collection renders this after the final page. */}
                {status === "Exhausted" && projects.length > 0 && (
                    <p className="text-center text-sm text-muted-foreground">
                        You have reached the end of your projects.
                    </p>
                )}
            </div>
        </section>
    )
}
