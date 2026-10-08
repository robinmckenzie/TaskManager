import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DictationError } from "./dictationMessages"
import {
    createTranscriptionConfig,
    DictationSession,
    STARTUP_TIMEOUT_MS,
    toTranscriptTokens,
} from "./dictationSession"
import type {
    AudioSource,
    DictationSessionListener,
    RealtimeConnection,
    RealtimeMessage,
    RealtimeResult,
} from "./dictationSession"
const timings = { inactivityTimeoutSeconds: 10, maxSessionSeconds: 20, settleTimeoutSeconds: 4 }
const token = { jwt: "jwt", url: "wss://example.test/v2", model: "enhanced", language: "en", timings }
const INACTIVITY_TIMEOUT_MS = timings.inactivityTimeoutSeconds * 1000
const MAX_SESSION_MS = timings.maxSessionSeconds * 1000
const SETTLE_TIMEOUT_MS = timings.settleTimeoutSeconds * 1000

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
        // Like the real client, this resolves as soon as the request is sent.
        stopRecognition: vi.fn(async () => undefined),
        close: vi.fn(),
    } satisfies RealtimeConnection

    return {
        connection,
        receive: (message: RealtimeMessage) => messageListener(message),
        close: () => closedListener(),
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

const words = (...contents: string[]): RealtimeResult[] =>
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

        // The stop request has resolved by now, but results are still to come.
        await vi.advanceTimersByTimeAsync(0)
        expect(listener.onSettled).not.toHaveBeenCalled()
        expect(fake.connection.close).not.toHaveBeenCalled()

        fake.receive({ message: "AddTranscript", results: words("Fix", "bug") })
        expect(listener.onTranscript).toHaveBeenLastCalledWith(true, expect.any(Array))
        expect(listener.onSettled).not.toHaveBeenCalled()

        fake.receive({ message: "EndOfTranscript" })
        expect(listener.onSettled).toHaveBeenCalledTimes(1)
        expect(fake.connection.close).toHaveBeenCalled()

        fake.receive({ message: "AddTranscript", results: words("late") })
        expect(listener.onTranscript).toHaveBeenCalledTimes(1)
    })

    it("ends settling after the settling cap and closes the connection", async () => {
        const { session, fake, listener } = await startSession()

        session.stop("user")
        await vi.advanceTimersByTimeAsync(SETTLE_TIMEOUT_MS - 1)
        expect(listener.onSettled).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(1)
        expect(listener.onSettled).toHaveBeenCalledTimes(1)
        expect(fake.connection.close).toHaveBeenCalled()
    })

    it("ends settling when the connection closes", async () => {
        const { session, fake, listener } = await startSession()

        session.stop("user")
        await vi.advanceTimersByTimeAsync(0)
        fake.close()

        expect(listener.onSettled).toHaveBeenCalledTimes(1)
    })

    it("ends settling when asking Speechmatics to finish fails", async () => {
        const { session, fake, listener } = await startSession()
        fake.connection.stopRecognition.mockRejectedValue(new Error("socket gone"))

        session.stop("user")
        await vi.advanceTimersByTimeAsync(0)

        expect(listener.onSettled).toHaveBeenCalledTimes(1)
        expect(fake.connection.close).toHaveBeenCalled()
    })

    it("closes the connection after a service error", async () => {
        const { fake, listener } = await startSession()

        fake.receive({ message: "Error", type: "job_error" })

        expect(listener.onStopped).toHaveBeenCalledWith("error", "service_unavailable")
        expect(listener.onSettled).toHaveBeenCalledTimes(1)
        expect(fake.connection.close).toHaveBeenCalled()
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

    describe("stopped while starting", () => {
        /** Starts a session whose given startup step waits until released. */
        const startUntil = (step: "token" | "connection" | "recognition") => {
            const fake = createFakeConnection()
            const audio = createFakeAudioSource()
            const listener = createListener()
            let release: (error?: Error) => void = () => undefined
            const waitHere = <T,>(value: T) => new Promise<T>((resolve, reject) => {
                release = (error) => (error ? reject(error) : resolve(value))
            })
            const createConnection = vi.fn(async () =>
                step === "connection" ? waitHere(fake.connection) : fake.connection)

            if (step === "recognition") {
                fake.connection.start.mockImplementation(() => waitHere(undefined))
            }

            const session = new DictationSession({
                fetchToken: async () => (step === "token" ? waitHere(token) : token),
                createConnection,
                createAudioSource: () => audio.source,
                vocabulary: [],
                listener,
            })

            return { session, fake, audio, listener, createConnection, starting: session.start(), release: () => release(), fail: () => release(new Error("failed")) }
        }

        it("opens no connection when stopped while fetching the token", async () => {
            const { session, audio, listener, createConnection, starting, release } = startUntil("token")
            await vi.advanceTimersByTimeAsync(0)

            session.stop("user")
            release()
            await starting

            expect(audio.source.stop).toHaveBeenCalled()
            expect(createConnection).not.toHaveBeenCalled()
            expect(listener.onSettled).toHaveBeenCalledTimes(1)
        })

        it("closes a connection created after stopping without starting it", async () => {
            const { session, fake, starting, release } = startUntil("connection")
            await vi.advanceTimersByTimeAsync(0)

            session.stop("user")
            release()
            await starting

            expect(fake.connection.close).toHaveBeenCalled()
            expect(fake.connection.start).not.toHaveBeenCalled()
        })

        it("closes a starting connection at once, and again if it then succeeds", async () => {
            const { session, fake, listener, starting, release } = startUntil("recognition")
            await vi.advanceTimersByTimeAsync(0)

            session.stop("user")
            expect(fake.connection.close).toHaveBeenCalledTimes(1)

            release()
            await starting

            expect(fake.connection.close).toHaveBeenCalledTimes(2)
            expect(listener.onListening).not.toHaveBeenCalled()
            expect(fake.connection.sendAudio).not.toHaveBeenCalled()
        })

        it("leaves a closed connection closed if starting then fails", async () => {
            const { session, fake, listener, starting, fail } = startUntil("recognition")
            await vi.advanceTimersByTimeAsync(0)

            session.stop("user")
            fail()
            await starting

            expect(fake.connection.close).toHaveBeenCalled()
            expect(listener.onStopped).toHaveBeenCalledTimes(1)
            expect(listener.onStopped).toHaveBeenCalledWith("user", undefined)
        })
    })

    describe("slow or stalled starting", () => {
        const startStalled = (step: "token" | "recognition", timingOverrides = {}) => {
            const fake = createFakeConnection()
            const audio = createFakeAudioSource()
            const listener = createListener()
            let finishStarting: () => void = () => undefined
            const stalled = <T,>(value: T) => new Promise<T>((resolve) => {
                finishStarting = () => resolve(value)
            })
            const sessionToken = { ...token, timings: { ...timings, ...timingOverrides } }

            if (step === "recognition") {
                fake.connection.start.mockImplementation(() => stalled(undefined))
            }

            const session = new DictationSession({
                fetchToken: async () => (step === "token" ? stalled(sessionToken) : sessionToken),
                createConnection: async () => fake.connection,
                createAudioSource: () => audio.source,
                vocabulary: [],
                listener,
            })

            return { session, fake, audio, listener, starting: session.start(), finishStarting: () => finishStarting() }
        }

        it("gives up and releases the microphone when the token request stalls", async () => {
            const { audio, listener } = startStalled("token")

            await vi.advanceTimersByTimeAsync(STARTUP_TIMEOUT_MS - 1)
            audio.speak(1_600)
            expect(listener.onStopped).not.toHaveBeenCalled()

            await vi.advanceTimersByTimeAsync(1)
            expect(listener.onStopped).toHaveBeenCalledWith("error", "service_unavailable")
            expect(audio.source.stop).toHaveBeenCalled()
            expect(listener.onSettled).toHaveBeenCalledTimes(1)
        })

        it("gives up and closes the connection when recognition does not start", async () => {
            const { fake, audio, listener } = startStalled("recognition")

            await vi.advanceTimersByTimeAsync(STARTUP_TIMEOUT_MS)

            expect(listener.onStopped).toHaveBeenCalledWith("error", "service_unavailable")
            expect(audio.source.stop).toHaveBeenCalled()
            expect(fake.connection.close).toHaveBeenCalled()
        })

        it("does not time out starting once listening", async () => {
            const { fake, listener } = await startSession()

            for (let elapsed = 0; elapsed < STARTUP_TIMEOUT_MS; elapsed += 5_000) {
                fake.receive({ message: "AddPartialTranscript", results: words("radio") })
                await vi.advanceTimersByTimeAsync(5_000)
            }

            expect(listener.onStopped).not.toHaveBeenCalled()
        })

        it("counts the maximum duration from when recording starts", async () => {
            const { fake, listener, starting, finishStarting } = startStalled("recognition")
            const startupDelay = 6_000

            await vi.advanceTimersByTimeAsync(startupDelay)
            finishStarting()
            await starting
            expect(listener.onListening).toHaveBeenCalled()

            const keepSpeakingFor = async (duration: number): Promise<void> => {
                for (let elapsed = 0; elapsed < duration; elapsed += 1_000) {
                    fake.receive({ message: "AddPartialTranscript", results: words("radio") })
                    await vi.advanceTimersByTimeAsync(1_000)
                }
            }

            await keepSpeakingFor(MAX_SESSION_MS - startupDelay - 1_000)
            expect(listener.onStopped).not.toHaveBeenCalled()

            await keepSpeakingFor(1_000)
            expect(listener.onStopped).toHaveBeenCalledWith("max_duration", undefined)
        })

        it("applies a short maximum duration even while still starting", async () => {
            const { audio, listener } = startStalled("recognition", { maxSessionSeconds: 3 })

            await vi.advanceTimersByTimeAsync(3_000)

            expect(listener.onStopped).toHaveBeenCalledWith("max_duration", undefined)
            expect(audio.source.stop).toHaveBeenCalled()
        })
    })

    it("closes the connection when starting recognition fails", async () => {
        const fake = createFakeConnection()
        const listener = createListener()
        fake.connection.start.mockRejectedValue(new Error("Timed out waiting for RecognitionStarted"))
        const session = new DictationSession({
            fetchToken: async () => token,
            createConnection: async () => fake.connection,
            createAudioSource: () => createFakeAudioSource().source,
            vocabulary: [],
            listener,
        })

        await session.start()

        expect(listener.onStopped).toHaveBeenCalledWith("error", "service_unavailable")
        expect(fake.connection.close).toHaveBeenCalled()
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
