import { afterEach, describe, expect, it, vi } from "vitest"
import {
    ACTIVITY_USER_STORAGE_KEY,
    readActivityUser,
    rememberActivityUserFromAddress,
    reportDictationActivity,
    reportSessionActivity,
} from "./dictationActivity"
import type { DictationSessionListener } from "./dictationSession"
import type { TranscriptToken } from "./insertionText"

const createStorage = (initial: Record<string, string> = {}) => {
    const values = new Map(Object.entries(initial))

    return {
        values,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => void values.set(key, value),
        removeItem: (key: string) => void values.delete(key),
    }
}

const brokenStorage = {
    getItem: (): string | null => {
        throw new Error("storage unavailable")
    },
    setItem: (): void => {
        throw new Error("storage unavailable")
    },
    removeItem: (): void => {
        throw new Error("storage unavailable")
    },
}

describe("testing labels", () => {
    it("is PUBLIC until a label has been set in this browser", () => {
        expect(readActivityUser(createStorage())).toBe("PUBLIC")
    })

    it.each(["Robin", "Dad", "Claude", "test-2", "qa_team"])(
        "stores the label from ?user=%s and keeps it for later visits without it",
        (label) => {
            const storage = createStorage()

            rememberActivityUserFromAddress(`?user=${label}`, storage)
            rememberActivityUserFromAddress("", storage)
            rememberActivityUserFromAddress("?other=1", storage)

            expect(readActivityUser(storage)).toBe(label)
        },
    )

    it("replaces an earlier label with a new one", () => {
        const storage = createStorage({ [ACTIVITY_USER_STORAGE_KEY]: "Robin" })

        rememberActivityUserFromAddress("?user=Dad", storage)

        expect(readActivityUser(storage)).toBe("Dad")
    })

    it.each(["PUBLIC", "public", "Public"])("clears the stored label with ?user=%s", (value) => {
        const storage = createStorage({ [ACTIVITY_USER_STORAGE_KEY]: "Robin" })

        rememberActivityUserFromAddress(`?user=${value}`, storage)

        expect(storage.values.has(ACTIVITY_USER_STORAGE_KEY)).toBe(false)
        expect(readActivityUser(storage)).toBe("PUBLIC")
    })

    it.each([
        ["spaces", "?user=two+words"],
        ["punctuation", "?user=a.b%40example.com"],
        ["markup", "?user=%3Cscript%3E"],
        ["a label that is too long", `?user=${"x".repeat(21)}`],
        ["an empty label", "?user="],
    ])("ignores %s and keeps the existing label", (_description, search) => {
        const storage = createStorage({ [ACTIVITY_USER_STORAGE_KEY]: "Robin" })

        rememberActivityUserFromAddress(search, storage)

        expect(readActivityUser(storage)).toBe("Robin")
    })

    it("reports PUBLIC when the stored value is not a valid label", () => {
        expect(readActivityUser(createStorage({ [ACTIVITY_USER_STORAGE_KEY]: "not a label!" }))).toBe("PUBLIC")
    })

    it("falls back to PUBLIC when browser storage is unavailable", () => {
        expect(() => rememberActivityUserFromAddress("?user=Robin", brokenStorage)).not.toThrow()
        expect(readActivityUser(brokenStorage)).toBe("PUBLIC")
    })
})

describe("reportDictationActivity", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("sends only the event name and testing label, without a body", () => {
        const sendBeacon = vi.fn(() => true)
        vi.stubGlobal("localStorage", createStorage({ [ACTIVITY_USER_STORAGE_KEY]: "Robin" }))
        vi.stubGlobal("navigator", { sendBeacon })

        reportDictationActivity("dictation_started")

        expect(sendBeacon).toHaveBeenCalledTimes(1)
        expect(sendBeacon).toHaveBeenCalledWith("/api/dictation/activity?event=dictation_started&user=Robin")
    })

    it("falls back to a request it does not wait for, and ignores its failure", async () => {
        const fetchActivity = vi.fn(async () => {
            throw new Error("offline")
        })
        vi.stubGlobal("localStorage", createStorage())
        vi.stubGlobal("navigator", {})
        vi.stubGlobal("fetch", fetchActivity)

        expect(() => reportDictationActivity("dictation_completed")).not.toThrow()
        await Promise.resolve()

        expect(fetchActivity).toHaveBeenCalledWith(
            "/api/dictation/activity?event=dictation_completed&user=PUBLIC",
            { method: "POST", keepalive: true },
        )
    })
})

describe("reportSessionActivity", () => {
    const word: TranscriptToken[] = [{ content: "Fix", startTime: 0 }]

    const setUp = (report = vi.fn()) => {
        const inner = {
            onListening: vi.fn(),
            onTranscript: vi.fn(),
            onStopped: vi.fn(),
            onSettled: vi.fn(),
        } satisfies DictationSessionListener

        return { inner, report, listener: reportSessionActivity(inner, report) }
    }

    it("reports a session that starts, hears speech and is stopped", () => {
        const { listener, report } = setUp()

        listener.onListening()
        listener.onTranscript(false, word)
        listener.onStopped("user")
        listener.onSettled()

        expect(report.mock.calls.map(([event]) => event)).toEqual([
            "dictation_started",
            "dictation_transcript_received",
            "dictation_completed",
        ])
    })

    it("reports the first recognised words once, however many transcripts follow", () => {
        const { listener, report } = setUp()

        listener.onListening()
        listener.onTranscript(false, [])
        listener.onTranscript(false, word)
        listener.onTranscript(false, word)
        listener.onTranscript(true, word)

        expect(report.mock.calls.filter(([event]) => event === "dictation_transcript_received")).toHaveLength(1)
    })

    it("reports only the event name, never the recognised words", () => {
        const { listener, report } = setUp()

        listener.onListening()
        listener.onTranscript(true, [{ content: "confidential", startTime: 0 }])

        expect(JSON.stringify(report.mock.calls)).not.toContain("confidential")
    })

    it.each(["inactivity", "max_duration", "focus", "task_deleted"] as const)(
        "reports an automatic stop for %s as completed",
        (reason) => {
            const { listener, report } = setUp()

            listener.onListening()
            listener.onStopped(reason)

            expect(report).toHaveBeenLastCalledWith("dictation_completed")
        },
    )

    it("reports a failure, whether before or after listening began", () => {
        const beforeListening = setUp()
        beforeListening.listener.onStopped("error", "microphone_denied")
        expect(beforeListening.report.mock.calls).toEqual([["dictation_failed"]])

        const whileListening = setUp()
        whileListening.listener.onListening()
        whileListening.listener.onStopped("error", "connection_lost")
        expect(whileListening.report).toHaveBeenLastCalledWith("dictation_failed")
    })

    it("reports nothing for a session cancelled before it started listening", () => {
        const { listener, report } = setUp()

        listener.onStopped("user")

        expect(report).not.toHaveBeenCalled()
    })

    it("passes every call on to the session's real listener", () => {
        const { listener, inner } = setUp()

        listener.onListening()
        listener.onTranscript(true, word)
        listener.onStopped("error", "usage_limit")
        listener.onSettled()

        expect(inner.onListening).toHaveBeenCalledTimes(1)
        expect(inner.onTranscript).toHaveBeenCalledWith(true, word)
        expect(inner.onStopped).toHaveBeenCalledWith("error", "usage_limit")
        expect(inner.onSettled).toHaveBeenCalledTimes(1)
    })

    it("keeps dictation working when reporting throws", () => {
        const { listener, inner } = setUp(vi.fn(() => {
            throw new Error("reporting broke")
        }))

        expect(() => {
            listener.onListening()
            listener.onTranscript(false, word)
            listener.onStopped("user")
        }).not.toThrow()
        expect(inner.onListening).toHaveBeenCalled()
        expect(inner.onTranscript).toHaveBeenCalled()
        expect(inner.onStopped).toHaveBeenCalledWith("user", undefined)
    })
})
