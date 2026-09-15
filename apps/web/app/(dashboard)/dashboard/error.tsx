"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@workspace/ui/components/alert"

/** SOURCE OF TRUTH KEYWORDS: dashboard error, route error, reset
 * WHAT: Provides recoverable dashboard route error UI.
 * WHY: Render-time route errors are separate from feature mutation feedback.
 * WHERE: Next.js renders this for dashboard segment failures.
 */
export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <div className="mx-auto max-w-3xl">
        <Alert>
          <AlertTitle>Something went wrong.</AlertTitle>
          <AlertDescription>
            <span>We could not load the dashboard. </span>
            <Button variant="outline" size="sm" onClick={reset}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
