const correlationPattern = /^[a-zA-Z0-9-]{1,64}$/

export function getSignupCorrelationId(
  supplied: string | null | undefined,
  generate: () => string,
): string {
  const value = supplied?.trim()
  return value && correlationPattern.test(value) ? value : generate()
}

export function withSignupCorrelationHeader(request: Request, correlationId: string): Request {
  const headers = new Headers(request.headers)
  headers.set("x-signup-correlation-id", correlationId)
  return new Request(request, { headers })
}
