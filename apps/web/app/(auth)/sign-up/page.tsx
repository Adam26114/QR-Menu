"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useRef, useState } from "react"
import { useQuery } from "convex/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { api } from "../../../../../convex/_generated/api"
import { authClient } from "@/lib/auth-client"
import { getSafeSignUpErrorMessage } from "@/lib/errors"
import { Button } from "@workspace/ui/components/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@workspace/ui/components/form"
import {
    Combobox,
    ComboboxContent,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@workspace/ui/components/combobox"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

const roles = [
    { value: "admin", label: "Admin - manage the workspace" },
    { value: "user", label: "User - standard access" },
] as const

const signUpSchema = z.object({
    name: z.string().trim().min(1, "Name is required."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    role: z.enum(["admin", "user"]).optional(),
})

type SignUpValues = z.infer<typeof signUpSchema>

/**
 * SOURCE OF TRUTH KEYWORDS: bootstrap-aware sign up, Better Auth email sign up
 * WHAT: Registers a workspace account and optionally presents first-user roles.
 * WHY: The server owns role assignment; this query only controls field visibility.
 * WHERE: Users can open /sign-up before signing in.
 */
function SignUpForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirect = safeRedirect(searchParams.get("redirect"))
    const bootstrapAvailable = useQuery(api.authBootstrap.isBootstrapAvailable)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const submitErrorRef = useRef<HTMLParagraphElement>(null)
    const form = useForm<SignUpValues>({
        resolver: zodResolver(signUpSchema),
        defaultValues: { name: "", email: "", password: "", role: "user" },
    })

    useEffect(() => {
        if (submitError) submitErrorRef.current?.focus()
    }, [submitError])

    const onSubmit = async (values: SignUpValues) => {
        setSubmitError(null)
        const registration = bootstrapAvailable
            ? values
            : {
                  name: values.name,
                  email: values.email,
                  password: values.password,
              }

        try {
            const correlationId = crypto.randomUUID()
            const result = await authClient.signUp.email(registration, {
                headers: { "x-signup-correlation-id": correlationId },
            })
            if (result.error) {
                const message = getSafeSignUpErrorMessage(result.error)
                setSubmitError(message)
                toast.error(message)
                form.setValue("password", "")
                return
            }

            toast.success("Account created successfully.")
            router.replace(redirect)
        } catch (error) {
            const message = getSafeSignUpErrorMessage(error)
            setSubmitError(message)
            toast.error(message)
            form.setValue("password", "")
        }
    }

    return (
        <main className="flex min-h-svh items-center justify-center p-6">
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    aria-describedby={submitError ? "sign-up-error" : undefined}
                    className="flex w-full max-w-sm flex-col gap-4 rounded-lg border bg-card p-6"
                >
                    <div>
                        <h1 className="text-xl font-semibold">
                            Create an account
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Set up your workspace account.
                        </p>
                    </div>

                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                    <Input autoComplete="name" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input
                                        type="email"
                                        autoComplete="email"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                    <Input
                                        type="password"
                                        autoComplete="new-password"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {bootstrapAvailable === true && (
                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>First user role</FormLabel>
                                    <Combobox
                                        value={field.value ?? "user"}
                                        onValueChange={(value) => {
                                            if (
                                                value === "admin" ||
                                                value === "user"
                                            ) {
                                                field.onChange(value)
                                            }
                                        }}
                                        itemToStringValue={(value) =>
                                            roles.find(
                                                (role) => role.value === value
                                            )?.label ?? ""
                                        }
                                    >
                                        <FormControl>
                                            <ComboboxInput
                                                ref={field.ref}
                                                name={field.name}
                                                onBlur={field.onBlur}
                                                showClear={false}
                                                placeholder="Select a role"
                                            />
                                        </FormControl>
                                        <ComboboxContent>
                                            <ComboboxList>
                                                {roles.map((role) => (
                                                    <ComboboxItem
                                                        key={role.value}
                                                        value={role.value}
                                                    >
                                                        {role.label}
                                                    </ComboboxItem>
                                                ))}
                                            </ComboboxList>
                                        </ComboboxContent>
                                    </Combobox>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    {submitError && (
                        <p
                            ref={submitErrorRef}
                            id="sign-up-error"
                            role="alert"
                            tabIndex={-1}
                            className="text-sm text-destructive"
                        >
                            {submitError}
                        </p>
                    )}

                    <Button
                        type="submit"
                        disabled={form.formState.isSubmitting}
                    >
                        {form.formState.isSubmitting
                            ? "Creating account..."
                            : "Create account"}
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link
                            className="underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            href={`/sign-in?redirect=${encodeURIComponent(redirect)}`}
                        >
                            Sign in
                        </Link>
                    </p>
                </form>
            </Form>
        </main>
    )
}

export default function SignUpPage() {
    return (
        <Suspense fallback={null}>
            <SignUpForm />
        </Suspense>
    )
}

function safeRedirect(value: string | null) {
    return value &&
        value.startsWith("/") &&
        !value.startsWith("//") &&
        !value.includes("\\")
        ? value
        : "/dashboard"
}
