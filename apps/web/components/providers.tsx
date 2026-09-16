"use client"

import { Provider } from "react-redux"
import { store } from "@/lib/store/store"
import { Toaster } from "@workspace/ui/components/sonner"

/**
 * SOURCE OF TRUTH KEYWORDS: app providers, Redux provider, Convex composition
 * WHAT: Composes client-side application providers in one reusable boundary.
 * WHY: Layout stays declarative and provider ordering is explicit.
 * WHERE: app/layout.tsx wraps all routes with this component.
 */
export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <Provider store={store}>
            {children}
            <Toaster />
        </Provider>
    )
}
