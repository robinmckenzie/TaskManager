/*
 * Decides whether sign-in can run here, and with which user store. Production
 * uses DATABASE_URL. Local development uses AUTH_DATABASE_URL, which points to
 * the separate taskmanager-nonprod database, and never falls back to
 * DATABASE_URL, so that users created locally can never reach production's
 * store. Vercel previews have no sign-in.
 */

type Environment = Record<string, string | undefined>

/** Where the app is running, as far as sign-in is concerned. */
export type AccountDeployment = "production" | "preview" | "local"

export interface AccountConfig {
    deployment: AccountDeployment
    databaseUrl: string
    secret: string
    google: { clientId: string; clientSecret: string }
    /**
     * Production's address, such as https://taskmanager.example. Locally this
     * is the development server's address instead.
     */
    baseUrl: string
}

const read = (env: Environment, name: string): string | undefined => env[name]?.trim() || undefined

/** Turns a host name, or an address, into an https address with no path. */
const toHttpsOrigin = (hostOrUrl: string): string | undefined => {
    try {
        return new URL(/^https?:\/\//i.test(hostOrUrl) ? hostOrUrl : `https://${hostOrUrl}`).origin
    } catch {
        return undefined
    }
}

/** Reads VERCEL_ENV. `vercel dev` reports "development", which counts as local. */
export const readAccountDeployment = (env: Environment): AccountDeployment => {
    switch (read(env, "VERCEL_ENV")) {
        case "production":
            return "production"
        case "preview":
            return "preview"
        default:
            return "local"
    }
}

/**
 * Reads the sign-in settings, or returns undefined when sign-in is not fully
 * configured for this deployment, and always on a Vercel preview. Missing
 * settings are never named in an error, and no value is ever included in one.
 */
export const readAccountConfig = (env: Environment): AccountConfig | undefined => {
    const deployment = readAccountDeployment(env)

    if (deployment === "preview") {
        return undefined
    }

    const databaseUrl = read(env, deployment === "production" ? "DATABASE_URL" : "AUTH_DATABASE_URL")
    const secret = read(env, "BETTER_AUTH_SECRET")
    const clientId = read(env, "GOOGLE_CLIENT_ID")
    const clientSecret = read(env, "GOOGLE_CLIENT_SECRET")

    if (!databaseUrl || !secret || !clientId || !clientSecret) {
        return undefined
    }

    const google = { clientId, clientSecret }
    const configuredUrl = read(env, "BETTER_AUTH_URL") ?? ""

    if (deployment === "production") {
        const baseUrl = toHttpsOrigin(configuredUrl)

        if (!baseUrl) {
            return undefined
        }

        return { deployment, databaseUrl, secret, google, baseUrl }
    }

    // Locally the address is http://localhost:5173, so its scheme is kept.
    if (!URL.canParse(configuredUrl)) {
        return undefined
    }

    return { deployment, databaseUrl, secret, google, baseUrl: new URL(configuredUrl).origin }
}
