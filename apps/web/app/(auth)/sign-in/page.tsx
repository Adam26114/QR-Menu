"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { authClient } from "@/lib/auth-client"
import { Button } from "@workspace/ui/components/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { toast } from "@workspace/ui/components/sonner"

const signInSchema = z.object({ email: z.string().email(), password: z.string().min(8) })
type SignInValues = z.infer<typeof signInSchema>

/** SOURCE OF TRUTH KEYWORDS: sign in form, Better Auth email password, Zod validation
 * WHAT: Provides a small email/password sign-in form.
 * WHY: The generic example needs a safe entry point for authenticated project data.
 * WHERE: Users can open /sign-in before visiting the dashboard.
 */
export default function SignInPage() {
  const router = useRouter()
  const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } })
  const onSubmit = async (values: SignInValues) => { try { const result = await authClient.signIn.email(values); if (result.error) { toast.error(result.error.message ?? "Could not sign in."); return }; toast.success("Signed in successfully."); router.replace("/dashboard") } catch (error) { toast.error(error instanceof Error ? error.message : "Could not sign in.") } }
  return <main className="flex min-h-svh items-center justify-center p-6"><Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border bg-card p-6"><div><h1 className="text-xl font-semibold">Sign in</h1><p className="text-sm text-muted-foreground">Use your workspace account.</p></div><FormField control={form.control} name="email" render={({ field }) => <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" autoComplete="email" {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="password" render={({ field }) => <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" autoComplete="current-password" {...field} /></FormControl><FormMessage /></FormItem>} /><Button type="submit" disabled={form.formState.isSubmitting}>Continue</Button><p className="text-center text-sm text-muted-foreground">Don&apos;t have an account? <Link href="/sign-up" className="underline underline-offset-4">Sign up</Link></p></form></Form></main>
}
