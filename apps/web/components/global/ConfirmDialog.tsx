"use client"

import { useState } from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"

type ConfirmDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description: string
    confirmLabel: string
    cancelLabel: string
    pending: boolean
    onConfirm: () => Promise<void>
}

/**
 * SOURCE OF TRUTH KEYWORDS: ConfirmDialog, AlertDialog, destructive action, async confirmation
 * WHAT: Provides a controlled, reusable confirmation wrapper for destructive operations.
 * WHY: Confirmation closes only after the caller's action succeeds and prevents duplicate submissions.
 * WHERE: Restaurant admin and order workflows use this wrapper before invoking typed Convex callbacks.
 */
export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    cancelLabel,
    pending,
    onConfirm,
}: ConfirmDialogProps) {
    const [confirming, setConfirming] = useState(false)
    const handleConfirm = async () => {
        setConfirming(true)
        try {
            await onConfirm()
            onOpenChange(false)
        } finally {
            setConfirming(false)
        }
    }
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={pending || confirming}>
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        disabled={pending || confirming}
                        onClick={(event) => {
                            event.preventDefault()
                            void handleConfirm()
                        }}
                    >
                        {confirming || pending ? "Working..." : confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
