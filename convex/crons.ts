import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval("cleanup storage", { hours: 1 }, internal.menu.cleanupStorage, {
    limit: 100,
})

export default crons
