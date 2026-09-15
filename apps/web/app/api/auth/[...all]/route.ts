import { authServer } from "@/lib/auth-server"
import { getSignupCorrelationId, withSignupCorrelationHeader } from "@/lib/auth-route"

async function handle(request: Request): Promise<Response> {
  const id = getSignupCorrelationId(request.headers.get("x-signup-correlation-id"), () => crypto.randomUUID())
  const isSignUp = request.url.includes("/sign-up")
  if (isSignUp) console.info("auth_signup_request", { correlationId: id })

  const authRequest = isSignUp ? withSignupCorrelationHeader(request, id) : request
  const response = await (request.method === "GET" ? authServer.handler.GET : authServer.handler.POST)(authRequest)
  if (!isSignUp) return response

  console.info("auth_signup_response", { correlationId: id, status: response.status })
  const headers = new Headers(response.headers)
  headers.set("x-signup-correlation-id", id)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

export const GET = handle
export const POST = handle
