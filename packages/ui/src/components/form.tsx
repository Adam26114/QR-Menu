"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { Field } from "@base-ui/react/field"
import {
    Controller,
    FormProvider,
    useFormContext,
    type ControllerProps,
    type FieldPath,
    type FieldValues,
} from "react-hook-form"

import { cn } from "@workspace/ui/lib/utils"
import { Label } from "@workspace/ui/components/label"

const Form = FormProvider

type FormFieldContextValue<
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = { name: TName }
const FormFieldContext = React.createContext<FormFieldContextValue | null>(null)

/**
 * SOURCE OF TRUTH KEYWORDS: shadcn form, React Hook Form, FormField, validation message
 * WHAT: Connects field labels, controls, descriptions, and messages to RHF state.
 * WHY: Zod errors must be announced consistently and associated with their controls.
 * WHERE: ProjectForm and sign-in compose these primitives for every field.
 */
function FormField<
    TFieldValues extends FieldValues,
    TName extends FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
    return (
        <FormFieldContext.Provider value={{ name: props.name }}>
            <Controller {...props} />
        </FormFieldContext.Provider>
    )
}

function useFormField() {
    const fieldContext = React.useContext(FormFieldContext)
    const itemContext = React.useContext(FormItemContext)
    const { getFieldState, formState } = useFormContext()
    if (!fieldContext?.name)
        throw new Error("useFormField must be used within FormField")
    const fieldState = getFieldState(fieldContext.name, formState)
    return {
        id: itemContext.id,
        name: fieldContext.name,
        formItemId: `${itemContext.id}-form-item`,
        formDescriptionId: `${itemContext.id}-form-item-description`,
        formMessageId: `${itemContext.id}-form-item-message`,
        ...fieldState,
    }
}

const FormItemContext = React.createContext<{ id: string }>(
    {} as { id: string }
)

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
    const id = React.useId()
    return (
        <FormItemContext.Provider value={{ id }}>
            <Field.Root
                data-slot="form-item"
                className={cn("grid gap-2", className)}
                {...props}
            />
        </FormItemContext.Provider>
    )
}

function FormLabel({
    className,
    ...props
}: React.ComponentProps<typeof Label>) {
    const { error, formItemId } = useFormField()
    return (
        <Label
            data-slot="form-label"
            data-error={!!error}
            className={cn(error && "text-destructive", className)}
            htmlFor={formItemId}
            {...props}
        />
    )
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot>) {
    const { error, formItemId, formDescriptionId, formMessageId } =
        useFormField()
    return (
        <Slot
            data-slot="form-control"
            id={formItemId}
            aria-describedby={
                !error
                    ? formDescriptionId
                    : `${formDescriptionId} ${formMessageId}`
            }
            aria-invalid={!!error}
            {...props}
        />
    )
}

function FormMessage({
    className,
    children,
    ...props
}: React.ComponentProps<"p">) {
    const { error, formMessageId } = useFormField()
    const body = error ? String(error.message ?? "Invalid value") : children
    if (!body) return null
    return (
        <p
            data-slot="form-message"
            id={formMessageId}
            className={cn("text-xs text-destructive", className)}
            {...props}
        >
            {body}
        </p>
    )
}

export {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    useFormField,
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
    const { formDescriptionId } = useFormField()
    return (
        <p
            data-slot="form-description"
            id={formDescriptionId}
            className={cn("text-xs text-muted-foreground", className)}
            {...props}
        />
    )
}
