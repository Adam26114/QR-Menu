"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"
import { getSafeErrorMessage } from "@/lib/errors"

type FeatureErrorBoundaryProps = { children: ReactNode }
type FeatureErrorBoundaryState = { error: Error | null }

/**
 * SOURCE OF TRUTH KEYWORDS: feature error boundary, Convex query error, dashboard feedback
 * WHAT: Converts render-time feature failures into a recoverable, themed state.
 * WHY: Convex query errors should be visible to users instead of leaving an unhandled screen.
 * WHERE: Protected dashboard pages wrap feature entrypoints with this boundary.
 */
export class FeatureErrorBoundary extends Component<FeatureErrorBoundaryProps, FeatureErrorBoundaryState> {
  state: FeatureErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): FeatureErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Feature rendering failed", error, info)
  }

   render() {
     if (this.state.error) return <Alert><AlertTitle>Could not load this workspace.</AlertTitle><AlertDescription><span>{getSafeErrorMessage(this.state.error, "Please try again to reload the feature.")} </span><Button variant="outline" size="sm" onClick={() => this.setState({ error: null })}>Try again</Button></AlertDescription></Alert>
    return this.props.children
  }
}
