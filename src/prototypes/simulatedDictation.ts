import { useCallback, useEffect, useRef, useState } from "react"
import type { AudioLevelReading } from "../dictation/audioLevel"
import type { DictationPhase } from "../dictation/dictationController"
import { describeDictationError, describeDictationStop } from "../dictation/dictationMessages"

/*
 * A stand-in for dictation in the TM #56 prototypes. It steps through the
 * app's dictation phases and shows the app's own messages, so that the
 * dictation controls can be styled and tried, but it uses no microphone and
 * makes no requests. A prototype may use it, copy it or ignore it.
 */

export type SimulatedAvailability = "available" | "not_configured"

export interface SimulatedDictation {
    availability: SimulatedAvailability
    phase: DictationPhase
    activeTargetId: string | null
    message: string
    toggle(targetId: string): void
    /** Stops dictation as the app does when a reason other than the user applies. */
    stop(reason: "focus" | "task_deleted"): void
    /** A made-up microphone level that rises and falls like speech. */
    readAudioLevel(): AudioLevelReading
}

// Roughly how long the app takes to connect, and to finish after stopping.
const CONNECTING_MS = 800
const FINISHING_MS = 1200

/** A level from the time alone, so that every meter on the page agrees. */
export const readSimulatedLevel = (now: number = performance.now()): AudioLevelReading => {
    const syllables = 0.5 + 0.5 * Math.sin(now / 90)
    const words = 0.5 + 0.5 * Math.sin(now / 410)
    const level = Math.min(1, 0.08 + 0.75 * syllables * words)
    // The highest level over roughly the last second.
    const peak = Math.min(1, 0.08 + 0.75 * words + 0.1)

    return { level, peak: Math.max(level, peak) }
}

export const useSimulatedDictation = (availability: SimulatedAvailability): SimulatedDictation => {
    const [phase, setPhase] = useState<DictationPhase>("idle")
    const [activeTargetId, setActiveTargetId] = useState<string | null>(null)
    const [message, setMessage] = useState("")
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    useEffect(() => () => clearTimeout(timer.current), [])

    const finish = useCallback((stopMessage: string): void => {
        clearTimeout(timer.current)
        setPhase("finishing")
        setMessage("")
        timer.current = setTimeout(() => {
            setPhase("idle")
            setActiveTargetId(null)
            setMessage(stopMessage)
        }, FINISHING_MS)
    }, [])

    const toggle = (targetId: string): void => {
        if (availability !== "available") {
            setMessage(describeDictationError("not_configured"))
            return
        }

        if (phase === "idle") {
            clearTimeout(timer.current)
            setActiveTargetId(targetId)
            setPhase("starting")
            setMessage("")
            timer.current = setTimeout(() => setPhase("listening"), CONNECTING_MS)
            return
        }

        if (targetId !== activeTargetId) {
            // As in the app, further speech goes to the newly chosen title.
            setActiveTargetId(targetId)
            return
        }

        if (phase !== "finishing") {
            finish(describeDictationStop("user"))
        }
    }

    const stop = (reason: "focus" | "task_deleted"): void => {
        if (phase === "starting" || phase === "listening") {
            finish(describeDictationStop(reason))
        }
    }

    return {
        availability,
        phase,
        activeTargetId,
        message,
        toggle,
        stop,
        readAudioLevel: readSimulatedLevel,
    }
}
