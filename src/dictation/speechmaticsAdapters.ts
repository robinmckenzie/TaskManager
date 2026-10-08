import workletScriptUrl from "@speechmatics/browser-audio-input/pcm-audio-worklet.min.js?url&no-inline"
import { DICTATION_STATUS_PATH, DICTATION_TOKEN_PATH } from "../../shared/dictationApi"
import type {
    DictationApiErrorCode,
    DictationErrorResponse,
    DictationStatusResponse,
    DictationToken,
} from "../../shared/dictationApi"
import { DictationError } from "./dictationMessages"
import type { DictationErrorKind } from "./dictationMessages"
import type { AudioSource, RealtimeConnection } from "./dictationSession"

// Speechmatics recommends 16 kHz for realtime transcription. Firefox only
// records at the device's default rate, so it uses that instead.
const RECORDING_SAMPLE_RATE = 16_000

export type DictationAvailability = "checking" | "available" | "not_configured" | "unsupported"

const canCaptureAudio = (): boolean =>
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof AudioWorkletNode !== "undefined"

/** Checks whether this browser can dictate and the server is configured. */
export const checkDictationAvailability = async (): Promise<DictationAvailability> => {
    if (!canCaptureAudio()) {
        return "unsupported"
    }

    try {
        const response = await fetch(DICTATION_STATUS_PATH)
        const body: unknown = response.ok ? await response.json() : undefined

        return (body as Partial<DictationStatusResponse> | undefined)?.configured === true
            ? "available"
            : "not_configured"
    } catch {
        return "not_configured"
    }
}

const getTokenErrorKind = (error: DictationApiErrorCode | undefined): DictationErrorKind => {
    switch (error) {
        case "not_configured":
            return "not_configured"
        case "not_authorised":
            return "not_authorised"
        default:
            return "service_unavailable"
    }
}

const isPositiveNumber = (value: unknown): boolean =>
    typeof value === "number" && Number.isFinite(value) && value > 0

const isDictationToken = (value: unknown): value is DictationToken => {
    const token = value as Partial<DictationToken> | null
    const timings = token?.timings

    return (
        typeof token?.jwt === "string" &&
        typeof token.url === "string" &&
        typeof token.model === "string" &&
        typeof token.language === "string" &&
        isPositiveNumber(timings?.inactivityTimeoutSeconds) &&
        isPositiveNumber(timings?.maxSessionSeconds) &&
        isPositiveNumber(timings?.settleTimeoutSeconds)
    )
}

/** Fetches a short-lived Speechmatics key and session settings from the server. */
export const fetchDictationToken = async (): Promise<DictationToken> => {
    let response: Response

    try {
        response = await fetch(DICTATION_TOKEN_PATH, { method: "POST" })
    } catch (error) {
        throw new DictationError("service_unavailable", { cause: error })
    }

    const body: unknown = await response.json().catch(() => undefined)

    if (response.ok && isDictationToken(body)) {
        return body
    }

    throw new DictationError(getTokenErrorKind((body as Partial<DictationErrorResponse> | undefined)?.error))
}

/**
 * Closes a Speechmatics client's WebSocket. The client only closes it after a
 * completed graceful stop and offers no public way to close it otherwise, so
 * this reaches its private `socket` field. speechmaticsAdapters.node.test.ts checks
 * that this still closes the connection with the installed client.
 */
const closeClientSocket = (client: object): void => {
    (client as { socket?: { close(): void } }).socket?.close()
}

/** Opens a Speechmatics realtime client, loading the SDK only when needed. */
export const createRealtimeConnection = async (url: string): Promise<RealtimeConnection> => {
    const { RealtimeClient } = await import("@speechmatics/real-time-client")
    const client = new RealtimeClient({ url })

    return {
        onMessage: (listener) => {
            client.addEventListener("receiveMessage", ({ data }) => {
                listener(data)
            })
        },
        onClosed: (listener) => {
            client.addEventListener("socketStateChange", ({ socketState }) => {
                if (socketState === "closed") {
                    listener()
                }
            })
        },
        start: (jwt, config) => client.start(jwt, config as Parameters<typeof client.start>[1]),
        // Recorder audio is posted from the worklet, so it is never a SharedArrayBuffer.
        sendAudio: (data) => client.sendAudio(data as Float32Array<ArrayBuffer>),
        stopRecognition: () => client.stopRecognition({ noTimeout: true }),
        close: () => closeClientSocket(client),
    }
}

/** The parts of the Speechmatics PCM recorder that the audio source uses. */
export interface AudioRecorder {
    readonly isRecording: boolean
    onAudio(listener: (data: Float32Array) => void): void
    startRecording(audioContext: AudioContext): Promise<void>
    stopRecording(): void
}

export interface AudioSourceDependencies {
    /** Loads the recorder, which is fetched only once dictation is used. */
    createRecorder(): Promise<AudioRecorder>
    createAudioContext(options?: AudioContextOptions): AudioContext
}

const browserAudioDependencies: AudioSourceDependencies = {
    createRecorder: async () => {
        const { PCMRecorder } = await import("@speechmatics/browser-audio-input")
        const recorder = new PCMRecorder(workletScriptUrl)

        return {
            get isRecording() {
                return recorder.isRecording
            },
            onAudio: (listener) => recorder.addEventListener("audio", (event) => listener(event.data)),
            startRecording: (audioContext) => recorder.startRecording({ audioContext }),
            stopRecording: () => recorder.stopRecording(),
        }
    },
    createAudioContext: (options) => new AudioContext(options),
}

/**
 * Captures microphone audio as 32-bit float PCM.
 *
 * Stopping is safe at any point, including while starting. Nothing is created
 * once stopped, and anything already created is released: at once where
 * possible, or as soon as a pending microphone request settles, since a
 * request for the microphone cannot be withdrawn.
 */
export const createBrowserAudioSource = (
    { createRecorder, createAudioContext }: AudioSourceDependencies = browserAudioDependencies,
): AudioSource => {
    let release: (() => void) | undefined
    let isStopped = false

    const failIfStopped = (): void => {
        if (isStopped) {
            throw new Error("Audio capture was stopped while it was starting.")
        }
    }

    return {
        start: async (onAudio) => {
            const recorder = await createRecorder()
            failIfStopped()

            const isFirefox = navigator.userAgent.includes("Firefox")
            const audioContext = createAudioContext(
                isFirefox ? undefined : { sampleRate: RECORDING_SAMPLE_RATE },
            )
            let isContextClosed = false

            // Installed before the microphone is requested, and safe to call
            // again once a pending request has produced a recording to stop.
            release = (): void => {
                if (recorder.isRecording) {
                    recorder.stopRecording()
                }

                if (!isContextClosed) {
                    isContextClosed = true
                    void audioContext.close().catch(() => undefined)
                }
            }

            recorder.onAudio((data) => {
                if (!isStopped) {
                    onAudio(data)
                }
            })

            try {
                await recorder.startRecording(audioContext)
                failIfStopped()
            } catch (error) {
                release()
                throw error
            }

            return { sampleRate: audioContext.sampleRate }
        },
        stop: () => {
            isStopped = true
            release?.()
        },
    }
}
