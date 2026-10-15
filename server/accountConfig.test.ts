import { describe, expect, it } from "vitest"
import { readAccountConfig, readAccountDeployment } from "./accountConfig.ts"

const google = { GOOGLE_CLIENT_ID: "client-id", GOOGLE_CLIENT_SECRET: "client-secret" }
const common = { ...google, BETTER_AUTH_SECRET: "auth-secret" }

const production = {
    ...common,
    VERCEL_ENV: "production",
    DATABASE_URL: "postgres://production",
    BETTER_AUTH_URL: "https://taskmanager.example",
    OAUTH_PROXY_SECRET: "proxy-secret",
}

const preview = {
    ...common,
    VERCEL_ENV: "preview",
    AUTH_DATABASE_URL: "postgres://nonprod",
    OAUTH_PROXY_SECRET: "proxy-secret",
    VERCEL_URL: "taskmanager-abc123.vercel.app",
    VERCEL_BRANCH_URL: "taskmanager-git-branch.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL: "taskmanager.example",
}

const local = {
    ...common,
    AUTH_DATABASE_URL: "postgres://local",
    BETTER_AUTH_URL: "http://localhost:5173",
}

/** A copy of the environment without one variable. */
const without = (env: Record<string, string>, name: string): Record<string, string> =>
    Object.fromEntries(Object.entries(env).filter(([key]) => key !== name))

describe("readAccountDeployment", () => {
    it("treats anything other than production or preview as local", () => {
        expect(readAccountDeployment({ VERCEL_ENV: "production" })).toBe("production")
        expect(readAccountDeployment({ VERCEL_ENV: "preview" })).toBe("preview")
        expect(readAccountDeployment({ VERCEL_ENV: "development" })).toBe("local")
        expect(readAccountDeployment({})).toBe("local")
    })
})

describe("readAccountConfig", () => {
    it("uses DATABASE_URL and the configured address in production", () => {
        expect(readAccountConfig(production)).toEqual({
            deployment: "production",
            databaseUrl: "postgres://production",
            secret: "auth-secret",
            google: { clientId: "client-id", clientSecret: "client-secret" },
            baseUrl: "https://taskmanager.example",
            proxy: { secret: "proxy-secret", productionUrl: "https://taskmanager.example" },
        })
    })

    it("signs people in on production without the proxy secret", () => {
        expect(readAccountConfig(without(production, "OAUTH_PROXY_SECRET"))).toEqual(expect.objectContaining({ proxy: undefined }))
    })

    it("uses AUTH_DATABASE_URL on a preview, its own hosts and the proxy to production", () => {
        expect(readAccountConfig(preview)).toEqual({
            deployment: "preview",
            databaseUrl: "postgres://nonprod",
            secret: "auth-secret",
            google: { clientId: "client-id", clientSecret: "client-secret" },
            allowedHosts: ["taskmanager-abc123.vercel.app", "taskmanager-git-branch.vercel.app"],
            proxy: { secret: "proxy-secret", productionUrl: "https://taskmanager.example" },
        })
    })

    it("never lets a preview or local development fall back to DATABASE_URL", () => {
        expect(readAccountConfig({ ...without(preview, "AUTH_DATABASE_URL"), DATABASE_URL: "postgres://production" })).toBeUndefined()
        expect(readAccountConfig({ ...without(local, "AUTH_DATABASE_URL"), DATABASE_URL: "postgres://production" })).toBeUndefined()
    })

    it("does not use AUTH_DATABASE_URL in production", () => {
        expect(readAccountConfig({ ...without(production, "DATABASE_URL"), AUTH_DATABASE_URL: "postgres://nonprod" })).toBeUndefined()
    })

    it("needs the proxy secret and production address on a preview", () => {
        expect(readAccountConfig(without(preview, "OAUTH_PROXY_SECRET"))).toBeUndefined()
        expect(readAccountConfig(without(preview, "VERCEL_PROJECT_PRODUCTION_URL"))).toBeUndefined()
    })

    it("uses the development server's address locally, and no proxy", () => {
        expect(readAccountConfig(local)).toEqual({
            deployment: "local",
            databaseUrl: "postgres://local",
            secret: "auth-secret",
            google: { clientId: "client-id", clientSecret: "client-secret" },
            baseUrl: "http://localhost:5173",
        })
    })

    it("is not configured when any required setting is missing or blank", () => {
        for (const name of ["BETTER_AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "BETTER_AUTH_URL"]) {
            expect(readAccountConfig({ ...local, [name]: undefined })).toBeUndefined()
            expect(readAccountConfig({ ...local, [name]: "  " })).toBeUndefined()
        }
    })
})
