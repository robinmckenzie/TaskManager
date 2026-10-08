import { describe, expect, it, vi } from "vitest"
import activityFunction from "../api/dictation/activity.ts"
import { DICTATION_ACTIVITY_EVENTS, DICTATION_ACTIVITY_PATH } from "../shared/dictationApi.ts"
import { handleDictationActivityRequest } from "./dictationActivity.ts"
import type { DictationActivityRecord } from "./dictationActivity.ts"
import { createDictationFetchHandler, handleHostedDictationRequest } from "./dictationFunction.ts"

const now = new Date("2026-10-08T15:30:00.000Z")
const activityUrl = (query: string): URL => new URL(`https://taskmanager.example${DICTATION_ACTIVITY_PATH}${query}`)

const record = (method: string, query: string) => {
    const written: DictationActivityRecord[] = []
    const status = handleDictationActivityRequest(method, activityUrl(query), (entry) => written.push(entry), () => now)

    return { status, written }
}

describe("handleDictationActivityRequest", () => {
    it.each(DICTATION_ACTIVITY_EVENTS)("logs %s with its mode and a timestamp", (event) => {
        expect(record("POST", `?event=${event}&mode=PUBLIC`)).toEqual({
            status: 204,
            written: [{ type: "dictation_activity", event, mode: "PUBLIC", timestamp: "2026-10-08T15:30:00.000Z" }],
        })
    })

    it("logs DEV mode separately from PUBLIC", () => {
        expect(record("POST", "?event=dictation_started&mode=DEV").written[0].mode).toBe("DEV")
    })

    it("logs nothing beyond the event, mode and timestamp, whatever else is sent", () => {
        const { status, written } = record(
            "POST",
            "?event=dictation_completed&mode=PUBLIC&transcript=secret+words&token=abc&user=robin",
        )

        expect(status).toBe(204)
        expect(Object.keys(written[0]).sort()).toEqual(["event", "mode", "timestamp", "type"])
        expect(JSON.stringify(written)).not.toMatch(/secret|abc|robin/)
    })

    it.each([
        ["an unknown event", "?event=dictation_exploded&mode=PUBLIC"],
        ["free text as the event", "?event=some+transcript+text&mode=PUBLIC"],
        ["an unknown mode", "?event=dictation_started&mode=ADMIN"],
        ["a lower-case mode", "?event=dictation_started&mode=dev"],
        ["a missing event", "?mode=PUBLIC"],
        ["a missing mode", "?event=dictation_started"],
        ["no details", ""],
    ])("rejects %s and logs nothing", (_description, query) => {
        expect(record("POST", query)).toEqual({ status: 400, written: [] })
    })

    it("rejects other methods and logs nothing", () => {
        expect(record("GET", "?event=dictation_started&mode=PUBLIC")).toEqual({ status: 405, written: [] })
    })

    it("leaves other paths alone", () => {
        const write = vi.fn()

        expect(handleDictationActivityRequest(
            "POST",
            new URL("https://taskmanager.example/api/dictation/token?event=dictation_started&mode=DEV"),
            write,
        )).toBeUndefined()
        expect(write).not.toHaveBeenCalled()
    })

    it("writes one line of JSON to the server log by default", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => undefined)

        try {
            handleDictationActivityRequest("POST", activityUrl("?event=dictation_failed&mode=DEV"))

            expect(log).toHaveBeenCalledTimes(1)
            expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
                type: "dictation_activity",
                event: "dictation_failed",
                mode: "DEV",
            })
        } finally {
            log.mockRestore()
        }
    })
})

describe("hosted activity endpoint", () => {
    const getConfig = (): never => {
        throw new Error("activity logging must not need the dictation configuration")
    }

    it("logs through the hosted handler without reading configuration or creating a token", async () => {
        const written: DictationActivityRecord[] = []
        const createToken = vi.fn(async () => "temporary-jwt")
        const handler = createDictationFetchHandler(getConfig, createToken, (entry) => written.push(entry))

        const response = await handler(new Request(activityUrl("?event=dictation_started&mode=PUBLIC"), { method: "POST" }))

        expect(response.status).toBe(204)
        expect(response.headers.get("Cache-Control")).toBe("no-store")
        expect(await response.text()).toBe("")
        expect(written).toHaveLength(1)
        expect(createToken).not.toHaveBeenCalled()
    })

    it("answers an invalid event with 400", async () => {
        const handler = createDictationFetchHandler(getConfig, async () => "temporary-jwt", () => undefined)
        const response = await handler(new Request(activityUrl("?event=nonsense&mode=PUBLIC"), { method: "POST" }))

        expect(response.status).toBe(400)
    })

    it("is served by its own Vercel function entry point", () => {
        expect(activityFunction.fetch).toBe(handleHostedDictationRequest)
    })
})
