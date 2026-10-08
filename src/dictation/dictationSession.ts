import {
    DictationError,
    getMicrophoneErrorKind,
    getRealtimeErrorKind,
} from "./dictationMessages"
import type { ErrorTypeEnum, RealtimeServerMessage } from "@speechmatics/real-time-client"
import type { DictationErrorKind, DictationStopReason } from "./dictationMessages"
import type { DictationTimings, DictationToken } from "../../shared/dictationApi"
import type { TranscriptToken } from "./insertionText"

type RealtimeMessageName = RealtimeServerMessage["message"]
type TranscriptMessageName = Extract<RealtimeMessageName, "AddPartialTranscript" | "AddTranscript">

export interface RealtimeResult {
    type: string
    start_time: number
    attaches_to?: TranscriptToken["attachesTo"]
    alternatives?: { content: string }[]
}

/**
 * The parts of a Speechmatics realtime message that a session reads. Message
 * names and error types come from the Speechmatics client's own types, so a
 * misspelt name does not compile.
 */
export type RealtimeMessage =
    | { message: TranscriptMessageName; results?: RealtimeResult[] }
    | { message: Extract<RealtimeMessageName, "Error">; type?: ErrorTypeEnum }
    | { message: Exclude<RealtimeMessageName, TranscriptMessageName | "Error"> }

/** The parts of the Speechmatics realtime client that a session uses. */
export interface RealtimeConnection {
    onMessage(listener: (message: RealtimeMessage) => void): void
    onClosed(listener: () => void): void
    start(jwt: string, config: object): Promise<unknown>
    sendAudio(data: Float32Array): void
    stopRecognition(): Promise<unknown>
}

/** A microphone source that delivers 32-bit float PCM audio. */
export interface AudioSource {
    start(onAudio: (data: Float32Array) => void): Promise<{ sampleRate: number }>
    stop(): void
}

export interface DictationSessionListener {
    onListening(): void
    onTranscript(isFinal: boolean, tokens: TranscriptToken[]): void
    /** Called once, as soon as dictation stops for any reason. */
    onStopped(reason: DictationStopReason, errorKind?: DictationErrorKind): void
    /** Called once no more recognised text will arrive after stopping. */
    onSettled(): void
}

export interface DictationSessionDependencies {
    fetchToken(): Promise<DictationToken>
    createConnection(url: string): Promise<RealtimeConnection>
    createAudioSource(): AudioSource
    vocabulary: readonly string[]
    listener: DictationSessionListener
}

type SessionPhase = "starting" | "listening" | "settling" | "settled"

// Melia 1 does not yet support a custom dictionary or max_delay.
const supportsCustomVocabulary = (model: string): boolean => model !== "melia-1"

export const createTranscriptionConfig = (
    token: DictationToken,
    sampleRate: number,
    vocabulary: readonly string[],
): object => {
    const isProductionFeatureSet = supportsCustomVocabulary(token.model)

    return {
        audio_format: { type: "raw", encoding: "pcm_f32le", sample_rate: sampleRate },
        transcription_config: {
            language: token.language,
            model: token.model,
            enable_partials: true,
            ...(isProductionFeatureSet
                ? {
                      max_delay: 1,
                      additional_vocab: vocabulary.map((content) => ({ content })),
                  }
                : {}),
        },
    }
}

export const toTranscriptTokens = (results: readonly RealtimeResult[] = []): TranscriptToken[] =>
    results.flatMap((result) => {
        const content = result.alternatives?.[0]?.content

        return content
            ? [{ content, startTime: result.start_time, attachesTo: result.attaches_to }]
            : []
    })

const toMilliseconds = (seconds: number): number => seconds * 1000

const getErrorKind = (error: unknown, fallback: DictationErrorKind): DictationErrorKind =>
    error instanceof DictationError ? error.kind : fallback

/**
 * One dictation session: microphone audio streamed to Speechmatics, with the
 * inactivity timeout, maximum duration and settling period applied.
 */
export class DictationSession {
    private readonly dependencies: DictationSessionDependencies
    private phase: SessionPhase = "starting"
    private connection?: RealtimeConnection
    private audioSource?: AudioSource
    private sampleRate = 0
    private samplesSent = 0
    private pendingAudio: Float32Array[] = []
    private inactivityTimer?: ReturnType<typeof setTimeout>
    private maxDurationTimer?: ReturnType<typeof setTimeout>
    private settleTimer?: ReturnType<typeof setTimeout>
    private sessionTimings?: DictationTimings

    constructor(dependencies: DictationSessionDependencies) {
        this.dependencies = dependencies
    }

    /** The configured timings, known once the session has its token. */
    get timings(): DictationTimings | undefined {
        return this.sessionTimings
    }

    get isStopped(): boolean {
        return this.phase === "settling" || this.phase === "settled"
    }

    /** Seconds of audio sent so far, on the same clock as result start times. */
    get audioTime(): number {
        return this.sampleRate ? this.samplesSent / this.sampleRate : 0
    }

    async start(): Promise<void> {
        const { fetchToken, createConnection, createAudioSource, vocabulary } = this.dependencies

        try {
            this.audioSource = createAudioSource()

            try {
                const { sampleRate } = await this.audioSource.start((data) => this.receiveAudio(data))
                this.sampleRate = sampleRate
            } catch (error) {
                throw error instanceof DictationError
                    ? error
                    : new DictationError(getMicrophoneErrorKind(error), { cause: error })
            }

            if (this.isStopped) {
                // Stopped while the microphone was starting, so release it again.
                this.audioSource.stop()
                return
            }

            const token = await fetchToken()
            this.sessionTimings = token.timings
            const connection = await createConnection(token.url)
            this.connection = connection
            connection.onMessage((message) => this.receiveMessage(message))
            connection.onClosed(() => this.handleConnectionClosed())

            if (this.isStopped) {
                return
            }

            await connection.start(token.jwt, createTranscriptionConfig(token, this.sampleRate, vocabulary))

            if (this.isStopped) {
                void connection.stopRecognition().catch(() => undefined)
                return
            }

            this.phase = "listening"
            this.flushPendingAudio()
            this.restartInactivityTimer()
            this.maxDurationTimer = setTimeout(
                () => this.stop("max_duration"),
                toMilliseconds(token.timings.maxSessionSeconds),
            )
            this.dependencies.listener.onListening()
        } catch (error) {
            this.stop("error", getErrorKind(error, "service_unavailable"))
        }
    }

    stop(reason: DictationStopReason, errorKind?: DictationErrorKind): void {
        if (this.isStopped) {
            return
        }

        const wasListening = this.phase === "listening"
        this.phase = "settling"
        this.clearTimers()
        this.pendingAudio = []
        this.audioSource?.stop()
        this.dependencies.listener.onStopped(reason, errorKind)

        if (wasListening && this.connection && reason !== "error") {
            this.settleTimer = setTimeout(
                () => this.finishSettling(),
                toMilliseconds(this.sessionTimings?.settleTimeoutSeconds ?? 0),
            )
            this.connection.stopRecognition()
                .catch(() => undefined)
                .finally(() => this.finishSettling())
        } else {
            this.finishSettling()
        }
    }

    private receiveAudio(data: Float32Array): void {
        if (this.phase === "listening") {
            this.sendAudio(data)
        } else if (this.phase === "starting") {
            this.pendingAudio.push(data)
        }
    }

    private sendAudio(data: Float32Array): void {
        this.connection?.sendAudio(data)
        this.samplesSent += data.length
    }

    private flushPendingAudio(): void {
        for (const data of this.pendingAudio) {
            this.sendAudio(data)
        }

        this.pendingAudio = []
    }

    private receiveMessage(message: RealtimeMessage): void {
        if (this.phase === "settled") {
            return
        }

        switch (message.message) {
            case "AddPartialTranscript":
            case "AddTranscript": {
                const tokens = toTranscriptTokens(message.results)

                if (tokens.length > 0 && this.phase === "listening") {
                    this.restartInactivityTimer()
                }

                this.dependencies.listener.onTranscript(message.message === "AddTranscript", tokens)
                break
            }
            case "EndOfTranscript":
                this.finishSettling()
                break
            case "Error":
                this.stop("error", getRealtimeErrorKind(message.type))
                break
        }
    }

    private handleConnectionClosed(): void {
        if (this.phase === "listening") {
            this.stop("error", "connection_lost")
        } else if (this.phase === "settling") {
            this.finishSettling()
        }
    }

    private restartInactivityTimer(): void {
        clearTimeout(this.inactivityTimer)
        this.inactivityTimer = setTimeout(
            () => this.stop("inactivity"),
            toMilliseconds(this.sessionTimings?.inactivityTimeoutSeconds ?? 0),
        )
    }

    private clearTimers(): void {
        clearTimeout(this.inactivityTimer)
        clearTimeout(this.maxDurationTimer)
    }

    private finishSettling(): void {
        if (this.phase === "settled") {
            return
        }

        this.phase = "settled"
        clearTimeout(this.settleTimer)
        this.dependencies.listener.onSettled()
    }
}
