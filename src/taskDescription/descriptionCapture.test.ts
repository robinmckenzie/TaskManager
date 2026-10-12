import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DESCRIPTION_TARGET_ID, DictationController } from "../dictation/dictationController"
import type { DictationState, DictationTextTarget } from "../dictation/dictationController"
import type { AudioSource, RealtimeConnection, RealtimeMessage, RealtimeResult } from "../dictation/dictationSession"
import { createReportedSession } from "../dictation/reportedSession"
import { closeAttempt, createFromAttempt, editField, readFields, viewAttempt } from "./descriptionAttempt"
import { createAttemptStore, startDescriptionCapture } from "./descriptionCapture"

/*
 * These tests drive the real controller and session, composed as the app
 * composes them, with a fake connection, microphone, token and timers.
 */

const today = new Date(2026, 9, 12, 9)
const timings = { inactivityTimeoutSeconds: 10, maxSessionSeconds: 20, settleTimeoutSeconds: 4 }
const SETTLE_TIMEOUT_MS = timings.settleTimeoutSeconds * 1000
const assignees = [{ id: "4", name: "Aaron" }, { id: "1", name: "Alice" }]

const createFakeConnection = () => {
    let messageListener: (message: RealtimeMessage) => void = () => undefined
    let closedListener: () => void = () => undefined
    const connection = {
        onMessage: (listener: (message: RealtimeMessage) => void) => {
            messageListener = listener
        },
        onClosed: (listener: () => void) => {
            closedListener = listener
        },
        start: vi.fn(async () => undefined),
        sendAudio: vi.fn(),
        stopRecognition: vi.fn(async () => undefined),
        close: vi.fn(),
    } satisfies RealtimeConnection

    return {
        connection,
        receive: (message: RealtimeMessage) => messageListener(message),
        close: () => closedListener(),
    }
}

const words = (startTime: number, text: string): RealtimeResult[] =>
    text.split(" ").map((content, index) => ({
        type: "word",
        start_time: startTime + index * 0.1,
        alternatives: [{ content }],
    }))

const createTitleTarget = (value: string): DictationTextTarget & { value: string } => {
    const target = {
        value,
        getValue: () => target.value,
        getSelection: () => ({ start: target.value.length, end: target.value.length }),
        isFocused: () => true,
        writeValue: (next: string) => {
            target.value = next
        },
    }

    return target
}

const setUp = (options: { language?: string; failConnection?: () => boolean } = {}) => {
    const sessions: (ReturnType<typeof createFakeConnection> & {
        speak(seconds: number): void
        final(startTime: number, text: string): void
        partial(startTime: number, text: string): void
        end(): void
    })[] = []
    const states: DictationState[] = []
    const events: string[] = []
    const transcripts: { text: string; sessionId: string }[] = []
    const titles = { a: createTitleTarget("Fix") }
    const store = createAttemptStore({ referenceDay: today, assignees, defaultUserId: "1" })
    const controller = new DictationController({
        createSession: (listener) => {
            const fake = createFakeConnection()
            const sessionNumber = sessions.length + 1
            let onAudio: (data: Float32Array) => void = () => undefined
            const audioSource: AudioSource = {
                start: async (receive) => {
                    onAudio = receive
                    return { sampleRate: 16_000 }
                },
                stop: () => undefined,
            }

            sessions.push({
                ...fake,
                speak: (seconds) => onAudio(new Float32Array(seconds * 16_000)),
                final: (startTime, text) => fake.receive({ message: "AddTranscript", results: words(startTime, text) }),
                partial: (startTime, text) =>
                    fake.receive({ message: "AddPartialTranscript", results: text ? words(startTime, text) : [] }),
                end: () => fake.receive({ message: "EndOfTranscript" }),
            })

            return createReportedSession(
                {
                    fetchToken: async () => ({
                        jwt: "jwt",
                        url: "wss://example.test/v2",
                        model: "enhanced",
                        language: options.language ?? "en",
                        timings,
                    }),
                    createConnection: async () => {
                        if (options.failConnection?.()) {
                            throw new Error("unreachable")
                        }

                        return fake.connection
                    },
                    createAudioSource: () => audioSource,
                    vocabulary: ["Aaron"],
                },
                listener,
                {
                    report: (event) => events.push(event),
                    reportTranscript: (text, sessionId) => transcripts.push({ text, sessionId }),
                    createId: () => `session-${sessionNumber}`,
                },
            )
        },
        getTarget: (id) => titles[id as keyof typeof titles],
        onStateChange: (state) => states.push(state),
        onAudioLevel: () => undefined,
    })

    /** Starts a capture and waits until it is listening, or has failed to start. */
    const capture = async (): Promise<boolean> => {
        const hasStarted = startDescriptionCapture(controller, store)
        await vi.advanceTimersByTimeAsync(0)

        return hasStarted
    }
    const dictateTitle = async (): Promise<void> => {
        controller.start("a", { start: titles.a.value.length, end: titles.a.value.length })
        await vi.advanceTimersByTimeAsync(0)
    }
    const view = () => viewAttempt(store.read(), today)
    const fields = () => readFields(store.read())

    return { controller, store, sessions, states, events, transcripts, titles, capture, dictateTitle, view, fields }
}

describe("capturing a task description through the controller and session", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("develops the fields from unconfirmed and final words, and writes to no title", async () => {
        const { store, sessions, states, titles, capture, view, fields } = setUp()

        expect(await capture()).toBe(true)
        expect(view().captureState).toBe("listening")
        expect(states.at(-1)).toMatchObject({ phase: "listening", targetId: DESCRIPTION_TARGET_ID })

        sessions[0].partial(0, "Send the proposal high")
        expect(fields()).toMatchObject({ title: "Send the proposal high", priority: 3 })

        sessions[0].partial(0, "Send the proposal high priority")
        expect(fields()).toMatchObject({ title: "Send the proposal", priority: 1 })

        sessions[0].final(0, "Send the proposal high priority")
        sessions[0].partial(1, "assigned to Aaron")
        expect(fields()).toMatchObject({ title: "Send the proposal", priority: 1, userId: "4" })
        expect(store.read().text).toBe("Send the proposal high priority assigned to Aaron")
        expect(titles.a.value).toBe("Fix")
    })

    it("keeps Create unavailable from stopping until recognition settles, applying a late final", async () => {
        const { controller, sessions, states, capture, view, fields } = setUp()

        await capture()
        sessions[0].partial(0, "Send it high prior")
        expect(view().blockers).toEqual(["capturing"])

        controller.stop("user")
        expect(view()).toMatchObject({ captureState: "finishing", blockers: ["finishing"], canCreate: false })
        expect(states.at(-1)).toMatchObject({ phase: "finishing", message: "Dictation stopped." })

        sessions[0].final(0, "Send it high priority")
        expect(view().canCreate).toBe(false)
        expect(fields()).toMatchObject({ title: "Send it", priority: 1 })

        sessions[0].end()
        expect(view()).toMatchObject({ captureState: "none", canCreate: true, uncertainties: [] })
        expect(states.at(-1)?.phase).toBe("idle")
    })

    it("flags words still unconfirmed when settling times out, and keeps them", async () => {
        const { controller, store, sessions, capture, view } = setUp()

        await capture()
        sessions[0].final(0, "Send it")
        sessions[0].partial(1, "high prior")
        controller.stop("user")
        vi.advanceTimersByTime(SETTLE_TIMEOUT_MS)

        expect(store.read().text).toBe("Send it high prior")
        expect(view()).toMatchObject({ captureState: "none", canCreate: false, blockers: ["unresolved"] })
        expect(view().uncertainties[0].message).toContain("The last words may be incomplete")
    })

    it("flags unconfirmed words when the connection is lost, keeping text and edits", async () => {
        const { store, sessions, states, capture, view, fields } = setUp()

        await capture()
        sessions[0].final(0, "Send it")
        store.write(editField(store.read(), "priority", 2, 1))
        sessions[0].partial(1, "due tom")
        sessions[0].close()

        expect(states.at(-1)).toMatchObject({
            phase: "idle",
            message: "Dictation stopped because the connection to the speech service was lost.",
        })
        expect(store.read().text).toBe("Send it due tom")
        expect(fields()).toMatchObject({ priority: 2 })
        expect(view()).toMatchObject({ captureState: "none", canCreate: false })
        expect(view().uncertainties.map(({ field }) => field)).toContain(null)
    })

    it("refuses a restart while finishing, and appends a capture started after settling", async () => {
        const { controller, store, sessions, capture, view, fields } = setUp()

        await capture()
        sessions[0].final(0, "Send it high")
        controller.stop("user")

        expect(await capture()).toBe(false)
        expect(sessions).toHaveLength(1)
        expect(view().captureState).toBe("finishing")

        sessions[0].end()
        expect(await capture()).toBe(true)
        expect(sessions).toHaveLength(2)
        expect(view().blockers).toEqual(["capturing"])

        sessions[1].final(0, "priority assigned to Aaron")
        controller.stop("user")
        sessions[1].end()

        expect(store.read().text).toBe("Send it high priority assigned to Aaron")
        expect(fields()).toMatchObject({ title: "Send it", priority: 1, userId: "4" })
        expect(view().canCreate).toBe(true)
    })

    it("leaves earlier values intact when a restarted capture fails at once", async () => {
        let shouldFail = false
        const { controller, store, sessions, states, capture, view, fields } = setUp({
            failConnection: () => shouldFail,
        })

        await capture()
        sessions[0].final(0, "Send it high priority")
        controller.stop("user")
        sessions[0].end()
        store.write(editField(store.read(), "userId", "4"))

        shouldFail = true
        expect(await capture()).toBe(true)

        expect(states.at(-1)).toMatchObject({
            phase: "idle",
            message: "Dictation is unavailable because the speech service could not be reached.",
        })
        expect(store.read().text).toBe("Send it high priority")
        expect(fields()).toEqual({ title: "Send it", dueDate: "", priority: 1, userId: "4" })
        expect(view()).toMatchObject({ captureState: "none", canCreate: true })
    })

    it("orders a manual edit against speech by the session's audio time", async () => {
        const { controller, store, sessions, capture, fields } = setUp()

        await capture()
        sessions[0].speak(3)
        sessions[0].partial(0, "Send it high priority")
        store.write(editField(store.read(), "priority", 2, controller.descriptionAudioTime))
        expect(fields().priority).toBe(2)

        // A revision of the earlier speech does not replace the edit.
        sessions[0].final(0, "Send it low priority")
        expect(fields().priority).toBe(2)

        // Speech from after the edit does, and gives way again if withdrawn.
        sessions[0].partial(3.5, "no medium priority")
        expect(fields()).toMatchObject({ title: "Send it", priority: 3 })

        sessions[0].partial(3.5, "")
        expect(fields().priority).toBe(2)
    })

    it("stops a description capture when title dictation starts, and still settles it", async () => {
        const { sessions, titles, capture, dictateTitle, view, fields } = setUp()

        await capture()
        sessions[0].partial(0, "Send it high")
        await dictateTitle()

        expect(view()).toMatchObject({ captureState: "finishing", canCreate: false })

        sessions[1].final(0, "bug")
        sessions[0].final(0, "Send it high priority")
        expect(titles.a.value).toBe("Fix bug")
        expect(fields()).toMatchObject({ title: "Send it", priority: 1 })

        sessions[0].end()
        expect(view()).toMatchObject({ captureState: "none", canCreate: true })
    })

    it("delivers a finishing title dictation's late text to its title after a capture starts", async () => {
        const { controller, store, sessions, titles, capture, dictateTitle } = setUp()

        await dictateTitle()
        sessions[0].partial(0, "the")
        controller.stop("user")
        await capture()

        sessions[0].final(0, "the bug")
        sessions[1].final(0, "Send it")
        sessions[0].end()

        expect(titles.a.value).toBe("Fix the bug")
        expect(store.read().text).toBe("Send it")
    })

    it.each(["listening", "finishing"])("changes nothing after Cancel while %s", async (phase) => {
        const { controller, store, sessions, capture } = setUp()

        await capture()
        sessions[0].final(0, "Send it")

        if (phase === "finishing") {
            controller.stop("user")
        }

        // Cancel closes the attempt and stops the microphone.
        const cancelled = closeAttempt(store.read())
        store.write(cancelled)
        controller.stop("user")

        sessions[0].final(1, "high priority")
        sessions[0].end()

        expect(store.read()).toBe(cancelled)
        expect(createFromAttempt(store.read(), today)).toBeNull()
    })

    it("does not let a cancelled attempt's capture change the next attempt", async () => {
        const first = setUp()

        await first.capture()
        first.sessions[0].final(0, "Send it")
        first.store.write(closeAttempt(first.store.read()))
        first.controller.stop("user")

        // The composer opens again with a new attempt in the same holder.
        const next = createAttemptStore({ referenceDay: today, assignees, defaultUserId: "1" })
        first.store.write(next.read())
        first.sessions[0].final(1, "high priority")
        first.sessions[0].end()

        expect(first.store.read()).toBe(next.read())
        expect(first.store.read().text).toBe("")
    })

    it("does not change a created task's values when a result arrives late", async () => {
        const { store, sessions, capture, dictateTitle } = setUp()

        await capture()
        sessions[0].final(0, "Send it high priority")
        // Title dictation starting stops the capture, which then settles.
        await dictateTitle()
        sessions[0].end()

        const created = createFromAttempt(store.read(), today)
        expect(created?.fields).toMatchObject({ title: "Send it", priority: 1 })

        store.write(created!.attempt)
        sessions[0].final(1, "low priority")

        expect(store.read()).toBe(created!.attempt)
        expect(createFromAttempt(store.read(), today)).toBeNull()
    })

    it("reports each capture's final words once, including for a cancelled attempt", async () => {
        const { controller, store, sessions, events, transcripts, capture } = setUp()

        await capture()
        sessions[0].partial(0, "Send")
        sessions[0].final(0, "Send it")
        sessions[0].partial(1, "tentative words")
        controller.stop("user")
        sessions[0].end()

        await capture()
        sessions[1].final(0, "high priority")
        store.write(closeAttempt(store.read()))
        controller.stop("user")
        sessions[1].final(1, "now")
        sessions[1].end()

        expect(transcripts).toEqual([
            { text: "Send it", sessionId: "session-1" },
            { text: "high priority now", sessionId: "session-2" },
        ])
        expect(events).toEqual([
            "dictation_started",
            "dictation_transcript_received",
            "dictation_completed",
            "dictation_started",
            "dictation_transcript_received",
            "dictation_completed",
        ])
    })

    it("tells the attempt the recognition language", async () => {
        const german = setUp({ language: "de" })
        await german.capture()
        expect(german.view().unsupportedLanguage).toBe("de")

        const english = setUp()
        await english.capture()
        expect(english.view().unsupportedLanguage).toBeNull()
    })

    it("says that focus left the task description when that stops a capture", async () => {
        const { controller, states, capture } = setUp()

        await capture()
        controller.stop("focus")

        expect(states.at(-1)?.message).toBe("Dictation stopped because focus left the task description.")
    })

    it("starts nothing when there is no open attempt", async () => {
        const { controller, store, sessions } = setUp()

        store.write(closeAttempt(store.read()))

        expect(startDescriptionCapture(controller, store)).toBe(false)
        expect(startDescriptionCapture(controller, { read: () => null, write: () => undefined })).toBe(false)
        expect(sessions).toHaveLength(0)
    })
})
