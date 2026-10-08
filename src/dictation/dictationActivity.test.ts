import { afterEach, describe, expect, it, vi } from "vitest"
import {
    ACTIVITY_USER_STORAGE_KEY,
    createActivityReporter,
    createActivityUser,
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

/** A page's label, as it would be after loading with the given address. */
const openPage = (search: string, getStorage: Parameters<typeof createActivityUser>[0]) => {
    const user = createActivityUser(getStorage)
    user.applyAddress(search)

    return user
}

/** Storage that can be read but refuses every write, as some private modes do. */
const createReadOnlyStorage = (initial: Record<string, string> = {}) => ({
    ...createStorage(initial),
    setItem: (): void => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    },
    removeItem: (): void => {
        throw new DOMException("The operation is insecure.", "SecurityError")
    },
})

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

/** A browser in which even referring to storage throws. */
const blockedStorage = (): never => {
    throw new DOMException("The operation is insecure.", "SecurityError")
}

describe("testing labels with working storage", () => {
    it("is PUBLIC until a label has been set in this browser", () => {
        expect(openPage("", () => createStorage()).read()).toBe("PUBLIC")
    })

    it.each(["Robin", "Dad", "Claude", "test-2", "qa_team"])(
        "uses the label from ?user=%s on that page and stores it",
        (label) => {
            const storage = createStorage()

            expect(openPage(`?user=${label}`, () => storage).read()).toBe(label)
            expect(storage.values.get(ACTIVITY_USER_STORAGE_KEY)).toBe(label)
        },
    )

    it("keeps the stored label on later visits without the parameter", () => {
        const storage = createStorage()

        openPage("?user=Dad", () => storage)

        expect(openPage("", () => storage).read()).toBe("Dad")
        expect(openPage("?other=1", () => storage).read()).toBe("Dad")
    })

    it("gives a label in the address precedence over a stored one, and replaces it", () => {
        const storage = createStorage({ [ACTIVITY_USER_STORAGE_KEY]: "Robin" })

        expect(openPage("?user=Dad", () => storage).read()).toBe("Dad")
        expect(openPage("", () => storage).read()).toBe("Dad")
    })

    it.each(["PUBLIC", "public", "Public"])("clears the stored label with ?user=%s", (value) => {
        const storage = createStorage({ [ACTIVITY_USER_STORAGE_KEY]: "Robin" })

        expect(openPage(`?user=${value}`, () => storage).read()).toBe("PUBLIC")
        expect(storage.values.has(ACTIVITY_USER_STORAGE_KEY)).toBe(false)
        expect(openPage("", () => storage).read()).toBe("PUBLIC")
    })

    it.each([
        ["a capitalised parameter name", "?User=Dad"],
        ["an upper-case parameter name", "?USER=Dad"],
        ["a trailing space", "?user=Dad%20"],
        ["other parameters around it", "?ref=mail&user=Dad&x=1"],
    ])("accepts the label with %s", (_description, search) => {
        expect(openPage(search, () => createStorage()).read()).toBe("Dad")
    })

    it.each([
        ["spaces inside", "?user=two+words"],
        ["trailing punctuation", "?user=Dad."],
        ["an email address", "?user=a.b%40example.com"],
        ["markup", "?user=%3Cscript%3E"],
        ["a label that is too long", `?user=${"x".repeat(21)}`],
        ["an empty label", "?user="],
    ])("rejects a label with %s and keeps the stored one", (_description, search) => {
        const storage = createStorage({ [ACTIVITY_USER_STORAGE_KEY]: "Robin" })

        expect(openPage(search, () => storage).read()).toBe("Robin")
        expect(storage.values.get(ACTIVITY_USER_STORAGE_KEY)).toBe("Robin")
    })

    it("rejects an invalid label as PUBLIC when nothing is stored", () => {
        expect(openPage("?user=two+words", () => createStorage()).read()).toBe("PUBLIC")
    })

    it("reports PUBLIC when the stored value is not a valid label", () => {
        const storage = createStorage({ [ACTIVITY_USER_STORAGE_KEY]: "not a label!" })

        expect(openPage("", () => storage).read()).toBe("PUBLIC")
    })
})

describe("testing labels when storage fails", () => {
    it.each([
        ["storage refuses writes", () => createReadOnlyStorage()],
        ["every storage call throws", () => brokenStorage],
        ["referring to storage throws", blockedStorage],
    ])("uses the label from the address on that page when %s", (_description, getStorage) => {
        expect(() => openPage("?user=Dad", getStorage)).not.toThrow()
        expect(openPage("?user=Dad", getStorage).read()).toBe("Dad")
    })

    it("uses ?user=PUBLIC on that page even when the stored label cannot be removed", () => {
        const getStorage = () => createReadOnlyStorage({ [ACTIVITY_USER_STORAGE_KEY]: "Robin" })

        expect(openPage("?user=PUBLIC", getStorage).read()).toBe("PUBLIC")
    })

    it.each([
        ["every storage call throws", () => brokenStorage],
        ["referring to storage throws", blockedStorage],
    ])("is PUBLIC without a label in the address when %s", (_description, getStorage) => {
        expect(() => openPage("", getStorage)).not.toThrow()
        expect(openPage("", getStorage).read()).toBe("PUBLIC")
    })

    it("still reads a stored label when storage can be read but not written", () => {
        const getStorage = () => createReadOnlyStorage({ [ACTIVITY_USER_STORAGE_KEY]: "Robin" })

        expect(openPage("", getStorage).read()).toBe("Robin")
    })
})

describe("createActivityReporter", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    const reportFrom = (search: string, getStorage: Parameters<typeof createActivityUser>[0]) => {
        const sendBeacon = vi.fn(() => true)
        vi.stubGlobal("navigator", { sendBeacon })
        createActivityReporter(openPage(search, getStorage))("dictation_started")

        return sendBeacon
    }

    it("sends only the event name and testing label, without a body", () => {
        const sendBeacon = reportFrom("?user=Robin", () => createStorage())

        expect(sendBeacon).toHaveBeenCalledTimes(1)
        expect(sendBeacon).toHaveBeenCalledWith("/api/dictation/activity?event=dictation_started&user=Robin")
    })

    it("sends the label from the address even when storage cannot keep it", () => {
        expect(reportFrom("?user=Dad", () => createReadOnlyStorage()))
            .toHaveBeenCalledWith("/api/dictation/activity?event=dictation_started&user=Dad")
        expect(reportFrom("?user=Dad", blockedStorage))
            .toHaveBeenCalledWith("/api/dictation/activity?event=dictation_started&user=Dad")
    })

    it("sends the stored label on a later visit", () => {
        const storage = createStorage()
        openPage("?user=Dad", () => storage)

        expect(reportFrom("", () => storage))
            .toHaveBeenCalledWith("/api/dictation/activity?event=dictation_started&user=Dad")
    })

    it("sends PUBLIC when no label is set, cleared, or invalid", () => {
        const storage = createStorage({ [ACTIVITY_USER_STORAGE_KEY]: "Robin" })

        expect(reportFrom("", () => createStorage()))
            .toHaveBeenCalledWith("/api/dictation/activity?event=dictation_started&user=PUBLIC")
        expect(reportFrom("?user=PUBLIC", () => storage))
            .toHaveBeenCalledWith("/api/dictation/activity?event=dictation_started&user=PUBLIC")
        expect(reportFrom("?user=not+valid", () => createStorage()))
            .toHaveBeenCalledWith("/api/dictation/activity?event=dictation_started&user=PUBLIC")
    })

    it("reads the label when each event is sent, not when the reporter is created", () => {
        const sendBeacon = vi.fn(() => true)
        vi.stubGlobal("navigator", { sendBeacon })
        const user = createActivityUser(() => createStorage())
        const report = createActivityReporter(user)

        report("dictation_started")
        user.applyAddress("?user=Dad")
        report("dictation_completed")

        expect(sendBeacon.mock.calls).toEqual([
            ["/api/dictation/activity?event=dictation_started&user=PUBLIC"],
            ["/api/dictation/activity?event=dictation_completed&user=Dad"],
        ])
    })

    it("falls back to a request it does not wait for, and ignores its failure", async () => {
        const fetchActivity = vi.fn(async () => {
            throw new Error("offline")
        })
        vi.stubGlobal("navigator", {})
        vi.stubGlobal("fetch", fetchActivity)
        const report = createActivityReporter(openPage("", () => createStorage()))

        expect(() => report("dictation_completed")).not.toThrow()
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
