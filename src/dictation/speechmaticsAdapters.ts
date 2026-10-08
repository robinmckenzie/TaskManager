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
import type {
    AudioSource,
    RealtimeConnection,
    RealtimeMessage,
} from "./dictationSession"

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

/** Opens a Speechmatics realtime client, loading the SDK only when needed. */
export const createRealtimeConnection = async (url: string): Promise<RealtimeConnection> => {
    const { RealtimeClient } = await import("@speechmatics/real-time-client")
    const client = new RealtimeClient({ url })

    return {
        onMessage: (listener) => {
            client.addEventListener("receiveMessage", ({ data }) => {
                listener(data as RealtimeMessage)
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
    }
}

/** Captures microphone audio as 32-bit float PCM. */
export const createBrowserAudioSource = (): AudioSource => {
    let stopRecording: (() => void) | undefined
    let isStopped = false

    return {
        start: async (onAudio) => {
            const { PCMRecorder } = await import("@speechmatics/browser-audio-input")
            const isFirefox = navigator.userAgent.includes("Firefox")
            const audioContext = new AudioContext(
                isFirefox ? undefined : { sampleRate: RECORDING_SAMPLE_RATE },
            )
            const recorder = new PCMRecorder(workletScriptUrl)
            const release = (): void => {
                if (recorder.isRecording) {
                    recorder.stopRecording()
                }

                void audioContext.close().catch(() => undefined)
            }

            recorder.addEventListener("audio", (event) => onAudio(event.data))

            try {
                await recorder.startRecording({ audioContext })
            } catch (error) {
                release()
                throw error
            }

            stopRecording = release

            if (isStopped) {
                release()
            }

            return { sampleRate: audioContext.sampleRate }
        },
        stop: () => {
            isStopped = true
            stopRecording?.()
        },
    }
}
