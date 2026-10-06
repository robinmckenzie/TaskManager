import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DictationError } from "./dictationMessages"
import {
    createTranscriptionConfig,
    DictationSession,
    toTranscriptTokens,
} from "./dictationSession"
import type {
    AudioSource,
    DictationSessionListener,
    RealtimeConnection,
    RealtimeMessage,
} from "./dictationSession"
const timings = { inactivityTimeoutSeconds: 10, maxSessionSeconds: 20, settleTimeoutSeconds: 4 }
const token = { jwt: "jwt", url: "wss://example.test/v2", model: "enhanced", language: "en", timings }
const INACTIVITY_TIMEOUT_MS = timings.inactivityTimeoutSeconds * 1000
const MAX_SESSION_MS = timings.maxSessionSeconds * 1000
const SETTLE_TIMEOUT_MS = timings.settleTimeoutSeconds * 1000

const createFakeConnection = () => {
    let messageListener: (message: RealtimeMessage) => void = () => undefined
    let closedListener: () => void = () => undefined
    let resolveStop: () => void = () => undefined

    const connection = {
        onMessage: (listener: (message: RealtimeMessage) => void) => {
            messageListener = listener
        },
        onClosed: (listener: () => void) => {
            closedListener = listener
        },
        start: vi.fn(async () => undefined),
        sendAudio: vi.fn(),
        stopRecognition: vi.fn(() => new Promise<void>((resolve) => {
            resolveStop = resolve
        })),
    } satisfies RealtimeConnection

    return {
        connection,
        receive: (message: RealtimeMessage) => messageListener(message),
        close: () => closedListener(),
        finishStopping: () => resolveStop(),
    }
}

const createFakeAudioSource = () => {
    let onAudio: (data: Float32Array) => void = () => undefined
    const source = {
        start: vi.fn(async (listener: (data: Float32Array) => void) => {
            onAudio = listener
            return { sampleRate: 16_000 }
        }),
        stop: vi.fn(),
    } satisfies AudioSource

    return { source, speak: (samples: number) => onAudio(new Float32Array(samples)) }
}

const createListener = () => ({
    onListening: vi.fn(),
    onTranscript: vi.fn(),
    onStopped: vi.fn(),
    onSettled: vi.fn(),
} satisfies DictationSessionListener)

const words = (...contents: string[]): RealtimeMessage["results"] =>
    contents.map((content, index) => ({
        type: "word",
        start_time: index,
        alternatives: [{ content }],
    }))

const startSession = async (vocabulary: string[] = ["Aaron"]) => {
    const fake = createFakeConnection()
    const audio = createFakeAudioSource()
    const listener = createListener()
    const session = new DictationSession({
        fetchToken: async () => token,
        createConnection: async () => fake.connection,
        createAudioSource: () => audio.source,
        vocabulary,
        listener,
    })

    await session.start()

    return { session, fake, audio, listener }
}

describe("DictationSession", () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it("starts listening with partials and the app's user names", async () => {
        const { fake, listener } = await startSession(["Aaron", "Bob"])

        expect(fake.connection.start).toHaveBeenCalledWith("jwt", {
            audio_format: { type: "raw", encoding: "pcm_f32le", sample_rate: 16_000 },
            transcription_config: {
                language: "en",
                model: "enhanced",
                enable_partials: true,
                max_delay: 1,
                additional_vocab: [{ content: "Aaron" }, { content: "Bob" }],
            },
        })
        expect(listener.onListening).toHaveBeenCalledTimes(1)
    })

    it("forwards transcripts and tracks audio time from audio sent", async () => {
        const { session, fake, audio, listener } = await startSession()

        audio.speak(8_000)
        fake.receive({ message: "AddPartialTranscript", results: words("Fix") })

        expect(fake.connection.sendAudio).toHaveBeenCalledTimes(1)
        expect(session.audioTime).toBe(0.5)
        expect(listener.onTranscript).toHaveBeenCalledWith(false, [
            { content: "Fix", startTime: 0, attachesTo: undefined },
        ])
    })

    it("stops after the inactivity timeout and recognised speech resets it", async () => {
        const { fake, listener } = await startSession()

        vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1_000)
        fake.receive({ message: "AddPartialTranscript", results: words("Fix") })
        vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS - 1_000)
        expect(listener.onStopped).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1_000)
        expect(listener.onStopped).toHaveBeenCalledWith("inactivity", undefined)
    })

    it("does not reset the inactivity timeout for audio that produces no text", async () => {
        const { fake, audio, listener } = await startSession()

        for (let second = 0; second < 10; second += 1) {
            audio.speak(16_000)
            fake.receive({ message: "AddPartialTranscript", results: [] })
            vi.advanceTimersByTime(1_000)
        }

        expect(listener.onStopped).toHaveBeenCalledWith("inactivity", undefined)
    })

    it("uses the timings supplied with the token", async () => {
        const fake = createFakeConnection()
        const listener = createListener()
        const session = new DictationSession({
            fetchToken: async () => ({ ...token, timings: { ...timings, maxSessionSeconds: 3 } }),
            createConnection: async () => fake.connection,
            createAudioSource: () => createFakeAudioSource().source,
            vocabulary: [],
            listener,
        })

        await session.start()
        expect(session.timings?.maxSessionSeconds).toBe(3)
        fake.receive({ message: "AddPartialTranscript", results: words("Fix") })
        vi.advanceTimersByTime(2_999)
        expect(listener.onStopped).not.toHaveBeenCalled()

        vi.advanceTimersByTime(1)
        expect(listener.onStopped).toHaveBeenCalledWith("max_duration", undefined)
    })

    it("stops at the maximum duration even while speech is recognised", async () => {
        const { fake, listener } = await startSession()

        for (let elapsed = 0; elapsed < MAX_SESSION_MS; elapsed += 5_000) {
            fake.receive({ message: "AddPartialTranscript", results: words("radio") })
            vi.advanceTimersByTime(5_000)
        }

        expect(listener.onStopped).toHaveBeenCalledWith("max_duration", undefined)
    })

    it("stops audio immediately and lets finals settle until EndOfTranscript", async () => {
        const { session, fake, audio, listener } = await startSession()

        session.stop("user")
        audio.speak(1_000)

        expect(audio.source.stop).toHaveBeenCalled()
        expect(fake.connection.sendAudio).not.toHaveBeenCalled()
        expect(listener.onStopped).toHaveBeenCalledWith("user", undefined)
        expect(fake.connection.stopRecognition).toHaveBeenCalled()

        fake.receive({ message: "AddTranscript", results: words("Fix", "bug") })
        expect(listener.onTranscript).toHaveBeenLastCalledWith(true, expect.any(Array))
        expect(listener.onSettled).not.toHaveBeenCalled()

        fake.receive({ message: "EndOfTranscript" })
        expect(listener.onSettled).toHaveBeenCalledTimes(1)

        fake.receive({ message: "AddTranscript", results: words("late") })
        expect(listener.onTranscript).toHaveBeenCalledTimes(1)
    })

    it("ends settling after the settling cap", async () => {
        const { session, listener } = await startSession()

        session.stop("user")
        vi.advanceTimersByTime(SETTLE_TIMEOUT_MS)

        expect(listener.onSettled).toHaveBeenCalledTimes(1)
    })

    it("reports a lost connection while listening", async () => {
        const { fake, listener } = await startSession()

        fake.close()

        expect(listener.onStopped).toHaveBeenCalledWith("error", "connection_lost")
    })

    it("maps service errors to dictation error kinds", async () => {
        const { fake, listener } = await startSession()

        fake.receive({ message: "Error", type: "quota_exceeded" })

        expect(listener.onStopped).toHaveBeenCalledWith("error", "usage_limit")
    })

    it("reports a denied microphone without contacting Speechmatics", async () => {
        const listener = createListener()
        const fetchToken = vi.fn(async () => token)
        const session = new DictationSession({
            fetchToken,
            createConnection: async () => createFakeConnection().connection,
            createAudioSource: () => ({
                start: async () => {
                    throw Object.assign(new Error("denied"), { name: "NotAllowedError" })
                },
                stop: vi.fn(),
            }),
            vocabulary: [],
            listener,
        })

        await session.start()

        expect(listener.onStopped).toHaveBeenCalledWith("error", "microphone_denied")
        expect(fetchToken).not.toHaveBeenCalled()
    })

    it("reports token failures from the server", async () => {
        const listener = createListener()
        const session = new DictationSession({
            fetchToken: async () => {
                throw new DictationError("not_configured")
            },
            createConnection: async () => createFakeConnection().connection,
            createAudioSource: () => createFakeAudioSource().source,
            vocabulary: [],
            listener,
        })

        await session.start()

        expect(listener.onStopped).toHaveBeenCalledWith("error", "not_configured")
    })

    it("buffers audio captured before recognition starts", async () => {
        const fake = createFakeConnection()
        const audio = createFakeAudioSource()
        let finishStarting: () => void = () => undefined
        fake.connection.start.mockImplementation(() => new Promise<undefined>((resolve) => {
            finishStarting = () => resolve(undefined)
        }))
        const session = new DictationSession({
            fetchToken: async () => token,
            createConnection: async () => fake.connection,
            createAudioSource: () => audio.source,
            vocabulary: [],
            listener: createListener(),
        })

        const starting = session.start()
        await vi.waitFor(() => expect(fake.connection.start).toHaveBeenCalled())
        audio.speak(1_600)
        expect(fake.connection.sendAudio).not.toHaveBeenCalled()

        finishStarting()
        await starting

        expect(fake.connection.sendAudio).toHaveBeenCalledTimes(1)
        expect(session.audioTime).toBeCloseTo(0.1)
    })
})

describe("createTranscriptionConfig", () => {
    it("omits the custom dictionary and max_delay for Melia 1", () => {
        expect(createTranscriptionConfig(
            { ...token, model: "melia-1", language: "multi" },
            48_000,
            ["Aaron"],
        )).toEqual({
            audio_format: { type: "raw", encoding: "pcm_f32le", sample_rate: 48_000 },
            transcription_config: { language: "multi", model: "melia-1", enable_partials: true },
        })
    })
})

describe("toTranscriptTokens", () => {
    it("keeps content, timing and attachment and skips empty results", () => {
        expect(toTranscriptTokens([
            { type: "word", start_time: 1.2, alternatives: [{ content: "Fix" }] },
            { type: "punctuation", start_time: 1.5, attaches_to: "previous", alternatives: [{ content: "." }] },
            { type: "word", start_time: 2, alternatives: [] },
        ])).toEqual([
            { content: "Fix", startTime: 1.2, attachesTo: undefined },
            { content: ".", startTime: 1.5, attachesTo: "previous" },
        ])
    })
})
