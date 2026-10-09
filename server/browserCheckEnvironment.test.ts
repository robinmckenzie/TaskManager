import { describe, expect, it } from "vitest"
import { assertEnvironmentIsIsolated, findCredentialVariableNames } from "./browserCheckEnvironment.ts"

describe("findCredentialVariableNames", () => {
    it("finds nothing in an environment without credentials", () => {
        expect(findCredentialVariableNames({ PATH: "/usr/bin", NODE_ENV: "development", PGUP: "1" })).toEqual([])
    })

    it("finds every Speechmatics setting the dictation endpoints read", () => {
        expect(
            findCredentialVariableNames({
                SPEECHMATICS_API_KEY: "key",
                SPEECHMATICS_MODEL: "model",
                SPEECHMATICS_LANGUAGE: "en",
                SPEECHMATICS_RT_URL: "wss://example.test",
            }),
        ).toEqual(["SPEECHMATICS_API_KEY", "SPEECHMATICS_LANGUAGE", "SPEECHMATICS_MODEL", "SPEECHMATICS_RT_URL"])
    })

    it("finds database and Vercel variables", () => {
        expect(
            findCredentialVariableNames({
                DATABASE_URL: "postgres://example.test",
                POSTGRES_URL: "postgres://example.test",
                PGPASSWORD: "password",
                NEON_API_KEY: "key",
                VERCEL_TOKEN: "token",
                VERCEL_ENV: "production",
            }),
        ).toEqual(["DATABASE_URL", "NEON_API_KEY", "PGPASSWORD", "POSTGRES_URL", "VERCEL_ENV", "VERCEL_TOKEN"])
    })

    it("matches names whatever their case, as Windows does", () => {
        expect(findCredentialVariableNames({ speechmatics_api_key: "key", Database_Url: "url" })).toEqual([
            "Database_Url",
            "speechmatics_api_key",
        ])
    })

    it("counts a variable that is set but empty", () => {
        expect(findCredentialVariableNames({ SPEECHMATICS_API_KEY: "", DATABASE_URL: undefined })).toEqual([
            "DATABASE_URL",
            "SPEECHMATICS_API_KEY",
        ])
    })
})

describe("assertEnvironmentIsIsolated", () => {
    it("accepts an environment without credentials", () => {
        expect(() => assertEnvironmentIsIsolated({ PATH: "/usr/bin" })).not.toThrow()
    })

    it("refuses an environment with a credential, naming it without its value", () => {
        const refuse = () => assertEnvironmentIsIsolated({ SPEECHMATICS_API_KEY: "secret-value", PATH: "/usr/bin" })

        expect(refuse).toThrow(/SPEECHMATICS_API_KEY/)
        expect(refuse).not.toThrow(/secret-value/)
    })
})
