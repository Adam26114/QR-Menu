import { ConvexClientProvider } from "@/components/ConvexClientProvider"

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>
}
