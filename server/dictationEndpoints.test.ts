import { SpeechmaticsJWTError } from "@speechmatics/auth"
import { describe, expect, it, vi } from "vitest"
import {
    DICTATION_CONFIG_PATH,
    DICTATION_TOKEN_PATH,
    handleDictationRequest,
    readDictationConfig,
} from "./dictationEndpoints.ts"

const configured = readDictationConfig({ SPEECHMATICS_API_KEY: "secret-key" })
const unconfigured = readDictationConfig({})

describe("readDictationConfig", () => {
    it("uses production defaults when only the API key is set", () => {
        expect(configured).toEqual({
            apiKey: "secret-key",
            model: "enhanced",
            language: "en",
            url: "wss://eu.rt.speechmatics.com/v2",
        })
    })

    it("reads model, language and URL overrides", () => {
        expect(readDictationConfig({
            SPEECHMATICS_API_KEY: "key",
            SPEECHMATICS_MODEL: "melia-1",
            SPEECHMATICS_LANGUAGE: "multi",
            SPEECHMATICS_RT_URL: "wss://preview.rt.speechmatics.com/v2",
        })).toEqual({
            apiKey: "key",
            model: "melia-1",
            language: "multi",
            url: "wss://preview.rt.speechmatics.com/v2",
        })
    })

    it("treats a blank API key as not configured", () => {
        expect(readDictationConfig({ SPEECHMATICS_API_KEY: "  " }).apiKey).toBeUndefined()
    })
})

describe("handleDictationRequest", () => {
    const createToken = vi.fn(async () => "temporary-jwt")

    it("reports whether dictation is configured without revealing the key", async () => {
        const result = await handleDictationRequest("GET", DICTATION_CONFIG_PATH, configured, createToken)

        expect(result).toEqual({ status: 200, body: { configured: true } })
        expect(JSON.stringify(result)).not.toContain("secret-key")
        expect(await handleDictationRequest("GET", DICTATION_CONFIG_PATH, unconfigured, createToken))
            .toEqual({ status: 200, body: { configured: false } })
    })

    it("returns a temporary key and session settings but never the API key", async () => {
        const result = await handleDictationRequest("POST", DICTATION_TOKEN_PATH, configured, createToken)

        expect(createToken).toHaveBeenCalledWith("secret-key")
        expect(result).toEqual({
            status: 200,
            body: {
                jwt: "temporary-jwt",
                url: "wss://eu.rt.speechmatics.com/v2",
                model: "enhanced",
                language: "en",
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
