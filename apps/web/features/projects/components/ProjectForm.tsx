"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@workspace/ui/components/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { projectFormSchema, type ProjectFormValues } from "../schemas"

type ProjectFormProps = {
    initialValues?: ProjectFormValues
    submitLabel: string
    onSubmit: (values: ProjectFormValues) => Promise<void>
    onCancel?: () => void
    disabled?: boolean
}

/**
 * SOURCE OF TRUTH KEYWORDS: project form, React Hook Form, Zod resolver, create edit
 * WHAT: Renders the shared create and edit project form.
 * WHY: One validated form prevents drift between project write flows.
 * WHERE: Project list cards use this form for creating and editing projects.
 */
export function ProjectForm({
    initialValues,
    submitLabel,
    onSubmit,
    onCancel,
    disabled = false,
}: ProjectFormProps) {
    const form = useForm<ProjectFormValues>({
        resolver: zodResolver(projectFormSchema),
        defaultValues: initialValues ?? { name: "", description: "" },
    })

    useEffect(() => {
        form.reset(initialValues ?? { name: "", description: "" })
    }, [form, initialValues])

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                                <Input placeholder="Project name" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="What is this project about?"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex gap-2">
                    <Button
                        type="submit"
                        disabled={disabled || form.formState.isSubmitting}
                    >
                        {form.formState.isSubmitting
                            ? "Saving..."
                            : submitLabel}
                    </Button>
                    {onCancel && (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={disabled}
                            onClick={onCancel}
                        >
                            Cancel
                        </Button>
                    )}
                </div>
            </form>
        </Form>
    )
}
