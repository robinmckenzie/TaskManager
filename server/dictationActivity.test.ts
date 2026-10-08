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
    it.each(DICTATION_ACTIVITY_EVENTS)("logs %s with its user and a timestamp", (event) => {
        expect(record("POST", `?event=${event}&user=PUBLIC`)).toEqual({
            status: 204,
            written: [{ type: "dictation_activity", event, user: "PUBLIC", timestamp: "2026-10-08T15:30:00.000Z" }],
        })
    })

    it.each(["Robin", "Dad", "Claude", "test-2", "qa_team", "A", "x".repeat(20)])(
        "logs the testing label %s as the user",
        (label) => {
            expect(record("POST", `?event=dictation_started&user=${label}`).written[0].user).toBe(label)
        },
    )

    it("logs nothing beyond the event, user and timestamp, whatever else is sent", () => {
        const { status, written } = record(
            "POST",
            "?event=dictation_completed&user=Dad&transcript=secret+words&token=abc&mode=DEV",
        )

        expect(status).toBe(204)
        expect(Object.keys(written[0]).sort()).toEqual(["event", "timestamp", "type", "user"])
        expect(JSON.stringify(written)).not.toMatch(/secret|abc|DEV/)
    })

    it.each([
        ["an unknown event", "?event=dictation_exploded&user=PUBLIC"],
        ["free text as the event", "?event=some+transcript+text&user=PUBLIC"],
        ["a label with spaces", "?event=dictation_started&user=some+spoken+words"],
        ["a label with punctuation", "?event=dictation_started&user=a.b%40example.com"],
        ["a label with markup", "?event=dictation_started&user=%3Cscript%3E"],
        ["a label with a line break", "?event=dictation_started&user=Dad%0Afake"],
        ["a label that is too long", `?event=dictation_started&user=${"x".repeat(21)}`],
        ["an empty label", "?event=dictation_started&user="],
        ["a missing event", "?user=PUBLIC"],
        ["a missing user", "?event=dictation_started"],
        ["no details", ""],
    ])("rejects %s and logs nothing", (_description, query) => {
        expect(record("POST", query)).toEqual({ status: 400, written: [] })
    })

    it("rejects other methods and logs nothing", () => {
        expect(record("GET", "?event=dictation_started&user=PUBLIC")).toEqual({ status: 405, written: [] })
    })

    it("leaves other paths alone", () => {
        const write = vi.fn()

        expect(handleDictationActivityRequest(
            "POST",
            new URL("https://taskmanager.example/api/dictation/token?event=dictation_started&user=Robin"),
            write,
        )).toBeUndefined()
        expect(write).not.toHaveBeenCalled()
    })

    it("writes one line of JSON to the server log by default", () => {
        const log = vi.spyOn(console, "log").mockImplementation(() => undefined)

        try {
            handleDictationActivityRequest("POST", activityUrl("?event=dictation_failed&user=Robin"))

            expect(log).toHaveBeenCalledTimes(1)
            expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
                type: "dictation_activity",
                event: "dictation_failed",
                user: "Robin",
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
        const handler = createDictationFetchHandler(getConfig, createToken, { write: (entry) => written.push(entry) })

        const response = await handler(new Request(activityUrl("?event=dictation_started&user=PUBLIC"), { method: "POST" }))

        expect(response.status).toBe(204)
        expect(response.headers.get("Cache-Control")).toBe("no-store")
        expect(await response.text()).toBe("")
        expect(written).toHaveLength(1)
        expect(createToken).not.toHaveBeenCalled()
    })

    it("answers an invalid event with 400", async () => {
        const handler = createDictationFetchHandler(getConfig, async () => "temporary-jwt", { write: () => undefined })
        const response = await handler(new Request(activityUrl("?event=nonsense&user=PUBLIC"), { method: "POST" }))

        expect(response.status).toBe(400)
    })

    it("is served by its own Vercel function entry point", () => {
        expect(activityFunction.fetch).toBe(handleHostedDictationRequest)
    })
})
