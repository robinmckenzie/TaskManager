import { SpeechmaticsJWTError } from "@speechmatics/auth"
import { describe, expect, it, vi } from "vitest"
import { DICTATION_STATUS_PATH, DICTATION_TOKEN_PATH } from "../shared/dictationApi.ts"
import { handleDictationRequest, readDictationConfig } from "./dictationEndpoints.ts"
import type { DictationSettings } from "./dictationConfig.ts"

const settings: DictationSettings = {
    model: "enhanced",
    language: "en",
    realtimeUrl: "wss://eu.rt.speechmatics.com/v2",
    timings: { inactivityTimeoutSeconds: 10, maxSessionSeconds: 20, settleTimeoutSeconds: 4 },
}
const configured = readDictationConfig(settings, { SPEECHMATICS_API_KEY: "secret-key" })
const unconfigured = readDictationConfig(settings, {})

describe("readDictationConfig", () => {
    it("uses the settings file when only the API key is set", () => {
        expect(configured).toEqual({
            apiKey: "secret-key",
            model: "enhanced",
            language: "en",
            url: "wss://eu.rt.speechmatics.com/v2",
            timings: settings.timings,
        })
    })

    it("lets environment variables override model, language and URL", () => {
        expect(readDictationConfig(settings, {
            SPEECHMATICS_API_KEY: "key",
            SPEECHMATICS_MODEL: "melia-1",
            SPEECHMATICS_LANGUAGE: "multi",
            SPEECHMATICS_RT_URL: "wss://preview.rt.speechmatics.com/v2",
        })).toEqual({
            apiKey: "key",
            model: "melia-1",
            language: "multi",
            url: "wss://preview.rt.speechmatics.com/v2",
            timings: settings.timings,
        })
    })

    it("treats a blank API key as not configured", () => {
        expect(readDictationConfig(settings, { SPEECHMATICS_API_KEY: "  " }).apiKey).toBeUndefined()
    })
})

describe("handleDictationRequest", () => {
    const createToken = vi.fn(async () => "temporary-jwt")

    it("reports whether dictation is configured without revealing the key", async () => {
        const result = await handleDictationRequest("GET", DICTATION_STATUS_PATH, configured, createToken)

        expect(result).toEqual({ status: 200, body: { configured: true } })
        expect(JSON.stringify(result)).not.toContain("secret-key")
        expect(await handleDictationRequest("GET", DICTATION_STATUS_PATH, unconfigured, createToken))
            .toEqual({ status: 200, body: { configured: false } })
    })

    it("returns a temporary key, session settings and timings but never the API key", async () => {
        const result = await handleDictationRequest("POST", DICTATION_TOKEN_PATH, configured, createToken)

        expect(createToken).toHaveBeenCalledWith("secret-key")
        expect(result).toEqual({
            status: 200,
            body: {
                jwt: "temporary-jwt",
                url: "wss://eu.rt.speechmatics.com/v2",
                model: "enhanced",
                language: "en",
                timings: { inactivityTimeoutSeconds: 10, maxSessionSeconds: 20, settleTimeoutSeconds: 4 },
            },
        })
        expect(JSON.stringify(result)).not.toContain("secret-key")
    })

    it("reports missing configuration", async () => {
        expect(await handleDictationRequest("POST", DICTATION_TOKEN_PATH, unconfigured, createToken))
            .toEqual({ status: 503, body: { error: "not_configured" } })
    })

    it("distinguishes a rejected API key from other token failures", async () => {
        const rejected = async () => {
            throw new SpeechmaticsJWTError("Unauthorized", "bad key")
        }
        const unavailable = async () => {
            throw new Error("network down")
        }

        expect(await handleDictationRequest("POST", DICTATION_TOKEN_PATH, configured, rejected))
            .toEqual({ status: 502, body: { error: "not_authorised" } })
        expect(await handleDictationRequest("POST", DICTATION_TOKEN_PATH, configured, unavailable))
            .toEqual({ status: 502, body: { error: "service_unavailable" } })
    })

    it("rejects unsupported methods and ignores other paths", async () => {
        expect(await handleDictationRequest("GET", DICTATION_TOKEN_PATH, configured, createToken))
            .toEqual({ status: 405, body: { error: "method_not_allowed" } })
        expect(await handleDictationRequest("GET", "/index.html", configured, createToken))
            .toBeUndefined()
    })
})
