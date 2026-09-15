import { z } from "zod"

/**
 * SOURCE OF TRUTH KEYWORDS: project form schema, Zod validation, project name, description
 * WHAT: Defines the reusable human-input contract for project forms.
 * WHY: Create and edit flows must validate the same values without duplicating database types.
 * WHERE: ProjectForm uses this schema through React Hook Form.
 */
export const projectFormSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(120, "Project name must be 120 characters or fewer"),
   description: z.string().trim().max(500, "Description must be 500 characters or fewer"),
})

export type ProjectFormValues = z.infer<typeof projectFormSchema>
