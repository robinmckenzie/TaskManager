import { fileURLToPath } from "node:url"
import { SpeechmaticsJWTError } from "@speechmatics/auth"
import { describe, expect, it, vi } from "vitest"
import statusFunction from "../api/dictation/status.ts"
import tokenFunction from "../api/dictation/token.ts"
import { DICTATION_STATUS_PATH, DICTATION_TOKEN_PATH } from "../shared/dictationApi.ts"
import {
    createDictationFetchHandler,
    handleHostedDictationRequest,
    readHostedDictationConfig,
} from "./dictationFunction.ts"

const projectDirectory = fileURLToPath(new URL("..", import.meta.url))
const committedSettings = {
    model: "enhanced",
    language: "en",
    url: "wss://eu.rt.speechmatics.com/v2",
    timings: { inactivityTimeoutSeconds: 10, maxSessionSeconds: 20, settleTimeoutSeconds: 4 },
}

const createHandler = (
    env: Record<string, string>,
    createToken: (apiKey: string) => Promise<string> = async () => "temporary-jwt",
) => createDictationFetchHandler(() => readHostedDictationConfig(projectDirectory, env), createToken)

const request = (method: string, path: string): Request =>
    new Request(`https://taskmanager.example${path}`, { method })

/** Checks the status, headers and JSON body of a dictation API response. */
const expectJsonResponse = async (response: Response, status: number, body: unknown): Promise<void> => {
    expect(response.status).toBe(status)
    expect(response.headers.get("Content-Type")).toBe("application/json")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(await response.json()).toEqual(body)
}

describe("readHostedDictationConfig", () => {
    it("uses the committed settings file when only the API key is set", () => {
        expect(readHostedDictationConfig(projectDirectory, { SPEECHMATICS_API_KEY: "secret-key" }))
            .toEqual({ apiKey: "secret-key", ...committedSettings })
    })

    it("gives environment variables precedence over the settings file", () => {
        expect(readHostedDictationConfig(projectDirectory, {
            SPEECHMATICS_MODEL: "standard",
            SPEECHMATICS_LANGUAGE: "de",
            SPEECHMATICS_RT_URL: "wss://us.rt.speechmatics.com/v2",
        })).toEqual({
            apiKey: undefined,
            model: "standard",
            language: "de",
            url: "wss://us.rt.speechmatics.com/v2",
            timings: committedSettings.timings,
        })
    })
})

describe("createDictationFetchHandler", () => {
    const configured = { SPEECHMATICS_API_KEY: "secret-key" }

    it("reports whether dictation is configured", async () => {
        await expectJsonResponse(
            await createHandler(configured)(request("GET", DICTATION_STATUS_PATH)),
            200,
            { configured: true },
        )
        await expectJsonResponse(
            await createHandler({})(request("GET", DICTATION_STATUS_PATH)),
            200,
            { configured: false },
        )
    })

    it("returns a temporary key with the settings and never the API key", async () => {
        const createToken = vi.fn(async () => "temporary-jwt")
        const response = await createHandler(configured, createToken)(request("POST", DICTATION_TOKEN_PATH))
        const text = await response.clone().text()

        expect(createToken).toHaveBeenCalledWith("secret-key")
        expect(text).not.toContain("secret-key")
        await expectJsonResponse(response, 200, {
            jwt: "temporary-jwt",
            url: committedSettings.url,
            model: committedSettings.model,
            language: committedSettings.language,
            timings: committedSettings.timings,
        })
    })

    it("applies environment overrides to the token response", async () => {
        const response = await createHandler({ ...configured, SPEECHMATICS_MODEL: "standard" })(
            request("POST", DICTATION_TOKEN_PATH),
        )

        expect(await response.json()).toMatchObject({ model: "standard", language: "en" })
    })

    it("reports a missing API key", async () => {
        await expectJsonResponse(
            await createHandler({})(request("POST", DICTATION_TOKEN_PATH)),
            503,
            { error: "not_configured" },
        )
    })

    it("reports a rejected API key without revealing it", async () => {
        const response = await createHandler(configured, async () => {
            throw new SpeechmaticsJWTError("Unauthorized", "bad key secret-key")
        })(request("POST", DICTATION_TOKEN_PATH))

        expect(await response.clone().text()).not.toContain("secret-key")
        await expectJsonResponse(response, 502, { error: "not_authorised" })
    })

    it("reports a failure to reach Speechmatics", async () => {
        const response = await createHandler(configured, async () => {
            throw new Error("network down")
        })(request("POST", DICTATION_TOKEN_PATH))

        await expectJsonResponse(response, 502, { error: "service_unavailable" })
    })

    it("rejects the wrong method", async () => {
        await expectJsonResponse(
            await createHandler(configured)(request("GET", DICTATION_TOKEN_PATH)),
            405,
            { error: "method_not_allowed" },
        )
        await expectJsonResponse(
            await createHandler(configured)(request("POST", DICTATION_STATUS_PATH)),
            405,
            { error: "method_not_allowed" },
        )
    })

    it("ignores a query string when matching the path", async () => {
        const response = await createHandler({})(request("GET", `${DICTATION_STATUS_PATH}?t=1`))

        expect(response.status).toBe(200)
    })

    it("answers an unknown path with an uncached 404", async () => {
        const response = await createHandler(configured)(request("GET", "/api/dictation/other"))

        expect(response.status).toBe(404)
        expect(response.headers.get("Cache-Control")).toBe("no-store")
        expect(await response.text()).toBe("")
    })
})

describe("Vercel function entry points", () => {
    it("serve the hosted handler from both dictation routes", () => {
        expect(statusFunction.fetch).toBe(handleHostedDictationRequest)
        expect(tokenFunction.fetch).toBe(handleHostedDictationRequest)
    })
})
