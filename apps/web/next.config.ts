import path from "node:path"
import type { NextConfig } from "next"

const turbopackRoot = path.resolve(import.meta.dirname, "../..")

const nextConfig: NextConfig = {
    transpilePackages: ["@workspace/ui"],
    turbopack: {
        root: turbopackRoot,
    },
}

export default nextConfig
