import workletScriptUrl from "@speechmatics/browser-audio-input/pcm-audio-worklet.min.js?url&no-inline"
import { DictationError } from "./dictationMessages"
import type { DictationErrorKind } from "./dictationMessages"
import type {
    AudioSource,
    DictationToken,
    RealtimeConnection,
    RealtimeMessage,
} from "./dictationSession"

const DICTATION_CONFIG_URL = "/api/dictation/config"
const DICTATION_TOKEN_URL = "/api/dictation/token"

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
        const response = await fetch(DICTATION_CONFIG_URL)
        const body: unknown = response.ok ? await response.json() : undefined

        return (body as { configured?: unknown } | undefined)?.configured === true
            ? "available"
            : "not_configured"
    } catch {
        return "not_configured"
    }
}

const getTokenErrorKind = (error: unknown): DictationErrorKind => {
    switch (error) {
        case "not_configured":
            return "not_configured"
        case "not_authorised":
            return "not_authorised"
        default:
            return "service_unavailable"
    }
}

const isDictationToken = (value: unknown): value is DictationToken => {
    const token = value as Partial<DictationToken> | null

    return (
        typeof token?.jwt === "string" &&
        typeof token.url === "string" &&
        typeof token.model === "string" &&
        typeof token.language === "string"
    )
}

/** Fetches a short-lived Speechmatics key and session settings from the server. */
export const fetchDictationToken = async (): Promise<DictationToken> => {
    let response: Response

    try {
        response = await fetch(DICTATION_TOKEN_URL, { method: "POST" })
    } catch (error) {
        throw new DictationError("service_unavailable", { cause: error })
    }

    const body: unknown = await response.json().catch(() => undefined)

    if (response.ok && isDictationToken(body)) {
        return body
    }

    throw new DictationError(getTokenErrorKind((body as { error?: unknown } | undefined)?.error))
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
