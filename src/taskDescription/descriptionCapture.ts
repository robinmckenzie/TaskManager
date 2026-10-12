import type { DictationController } from "../dictation/dictationController"
import {
    createDescriptionAttempt,
    markCaptureListening,
    receiveTranscript,
    settleCapture,
    startCapture,
    stopCapture,
} from "./descriptionAttempt"
import type { DescriptionAttempt } from "./descriptionAttempt"

/** Holds the attempt that is open, if one is, and applies changes to it. */
export interface AttemptHolder {
    read(): DescriptionAttempt | null
    write(attempt: DescriptionAttempt): void
}

export interface AttemptStore extends AttemptHolder {
    read(): DescriptionAttempt
    /** Calls `listener` after each change, until the returned function is called. */
    subscribe(listener: () => void): () => void
}

let attemptCount = 0

/** Creates a new attempt and holds it, telling subscribers whenever it changes. */
export const createAttemptStore = (
    options: Omit<Parameters<typeof createDescriptionAttempt>[0], "id">,
): AttemptStore => {
    attemptCount += 1

    let attempt = createDescriptionAttempt({ ...options, id: `attempt-${attemptCount}` })
    const listeners = new Set<() => void>()

    return {
        read: () => attempt,
        write: (next) => {
            attempt = next
            listeners.forEach((listener) => listener())
        },
        subscribe: (listener) => {
            listeners.add(listener)

            return () => {
                listeners.delete(listener)
            }
        },
    }
}

/**
 * Starts capturing speech for the open attempt and routes what the capture
 * recognises to it. Returns false, starting nothing, when there is no open
 * attempt or its previous capture has not settled.
 *
 * The capture stays bound to the attempt it began for. Whatever arrives after
 * that attempt is closed, or once another has replaced it, changes nothing.
 */
export const startDescriptionCapture = (
    controller: Pick<DictationController, "startDescription">,
    holder: AttemptHolder,
): boolean => {
    const attempt = holder.read()
    const started = attempt && startCapture(attempt)

    if (!started) {
        return false
    }

    const applyToAttempt = (change: (current: DescriptionAttempt) => DescriptionAttempt): void => {
        const current = holder.read()

        if (current && current.id === started.id && !current.isClosed) {
            holder.write(change(current))
        }
    }

    holder.write(started)
    controller.startDescription({
        onListening: (language) => applyToAttempt((current) => markCaptureListening(current, language)),
        onTranscript: (isFinal, tokens) =>
            applyToAttempt((current) => receiveTranscript(current, isFinal, tokens)),
        onStopped: () => applyToAttempt(stopCapture),
        onSettled: () => applyToAttempt(settleCapture),
    })

    return true
}
