import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { DICTATION_CONFIG_FILE, parseDictationSettings } from "./dictationConfig.ts"

const validFile = `
# A comment
[speechmatics]
model = "enhanced"
language = "en"
realtime_url = "wss://eu.rt.speechmatics.com/v2"

[timings]
inactivity_timeout_seconds = 10
max_session_seconds = 1_200 # underscores are allowed
settle_timeout_seconds = 2.5
`

const withLine = (from: string, to: string): string => validFile.replace(from, to)

describe("parseDictationSettings", () => {
    it("reads Speechmatics settings and timings in seconds", () => {
        expect(parseDictationSettings(validFile)).toEqual({
            model: "enhanced",
            language: "en",
            realtimeUrl: "wss://eu.rt.speechmatics.com/v2",
            timings: { inactivityTimeoutSeconds: 10, maxSessionSeconds: 1200, settleTimeoutSeconds: 2.5 },
        })
    })

    it("accepts the committed settings file", () => {
        const settings = parseDictationSettings(
            readFileSync(new URL(`../${DICTATION_CONFIG_FILE}`, import.meta.url), "utf8"),
        )

        expect(settings.timings).toEqual({
            inactivityTimeoutSeconds: 10,
            maxSessionSeconds: 20,
            settleTimeoutSeconds: 4,
        })
        expect(settings.model).toBe("enhanced")
    })

    it("rejects invalid timings with a clear message", () => {
        expect(() => parseDictationSettings(withLine("max_session_seconds = 1_200", "max_session_seconds = 0")))
            .toThrow("dictation.config.toml: [timings] max_session_seconds must be a positive number of seconds")
        expect(() => parseDictationSettings(withLine("max_session_seconds = 1_200", 'max_session_seconds = "20"')))
            .toThrow("max_session_seconds must be a positive number of seconds")
    })

    it("rejects missing or empty Speechmatics settings", () => {
        expect(() => parseDictationSettings(withLine('model = "enhanced"', 'model = " "')))
            .toThrow("[speechmatics] model must be a non-empty string")
        expect(() => parseDictationSettings(withLine('language = "en"', "")))
            .toThrow("[speechmatics] language must be a non-empty string")
    })

    it("rejects unknown sections and settings, which catches typos", () => {
        expect(() => parseDictationSettings(withLine("max_session_seconds", "max_sesion_seconds")))
            .toThrow("unknown setting [timings] max_sesion_seconds")
        expect(() => parseDictationSettings(`${validFile}\n[extra]\nvalue = 1\n`))
            .toThrow("unknown section [extra]")
    })

    it("refuses secrets in the committed file", () => {
        expect(() => parseDictationSettings(withLine('model = "enhanced"', 'model = "enhanced"\napi_key = "secret"')))
            .toThrow("looks like a secret")
    })

    it("reports TOML syntax errors with the file name", () => {
        expect(() => parseDictationSettings("[speechmatics\n")).toThrow(/^dictation\.config\.toml: /)
    })
})
