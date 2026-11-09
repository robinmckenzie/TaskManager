import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { createAudioLevelMeter } from "./audioLevel"
import type { AudioLevelReading } from "./audioLevel"
import { scrollCaretIntoView } from "./caretScroll"
import {
    initialCtrlAltShortcutState,
    trackShortcutKeyDown,
    trackShortcutKeyUp,
} from "./ctrlAltShortcut"
import type { ShortcutKeyEvent } from "./ctrlAltShortcut"
import { reportSessionActivity } from "./dictationActivity"
import { DictationController } from "./dictationController"
import type { DictationPhase, DictationState } from "./dictationController"
import { describeDictationError } from "./dictationMessages"
import { DictationSession } from "./dictationSession"
import { findFieldId, findShortcutTargetId, focusFieldWithSavedSelection } from "./dictationFields"
import type { DictationField } from "./dictationFields"
import { createDictationTargets, getInputSelection } from "./dictationTargets"
import type { TextRange } from "./insertionText"
import {
    checkDictationAvailability,
    createBrowserAudioSource,
    createRealtimeConnection,
    fetchDictationToken,
} from "./speechmaticsAdapters"
import type { DictationAvailability } from "./speechmaticsAdapters"

interface UseDictationOptions {
    vocabulary: readonly string[]
    /** The current text of a target, or undefined when it no longer exists. */
    getText(targetId: string): string | undefined
    setText(targetId: string, text: string): void
}

export interface Dictation {
    availability: DictationAvailability
    phase: DictationPhase
    activeTargetId: string | null
    message: string
    /** The microphone input level and its recent peak, to show while listening. */
    readAudioLevel(): AudioLevelReading
    registerInput(targetId: string, input: DictationField | null): void
    registerButton(targetId: string, button: HTMLButtonElement | null): void
    toggleFromButton(targetId: string): void
    recordEdit(targetId: string, before: string, after: string): void
    removeTarget(targetId: string): void
    /**
     * Returns focus to an element. A dictation field gets its saved selection
     * back, which text recognised while focus was elsewhere has kept up to date.
     */
    restoreFocus(element: HTMLElement): void
}

/**
 * Whether an element is a dictation setting, marked with
 * `data-dictation-setting`. Moving focus to one does not stop dictation, so
 * that a setting can be changed by keyboard while dictating.
 */
const isDictationSetting = (element: Element | null): boolean =>
    element?.closest("[data-dictation-setting]") != null

const toShortcutKeyEvent = (event: KeyboardEvent): ShortcutKeyEvent => ({
    key: event.key,
    code: event.code,
    isAltGraph: event.key === "AltGraph" || event.getModifierState("AltGraph"),
})

const describeUnavailability = (availability: DictationAvailability): string =>
    availability === "checking"
        ? "Dictation is still being checked. Try again in a moment."
        : describeDictationError(availability === "unsupported" ? "unsupported" : "not_configured")

/**
 * Connects dictation to registered text fields (single-line inputs or text areas): their dictation buttons, the
 * Ctrl + Alt shortcut, cursor and focus tracking, and status messages.
 */
export const useDictation = ({ vocabulary, getText, setText }: UseDictationOptions): Dictation => {
    const [availability, setAvailability] = useState<DictationAvailability>("checking")
    const [state, setState] = useState<DictationState>({ phase: "idle", targetId: null, message: "" })
    const inputs = useRef(new Map<string, DictationField>())
    const buttons = useRef(new Map<string, HTMLButtonElement>())
    const savedSelections = useRef(new Map<string, TextRange>())
    const vocabularyRef = useRef(vocabulary)
    const getTextRef = useRef(getText)
    const setTextRef = useRef(setText)
    const availabilityRef = useRef(availability)
    const controllerRef = useRef<DictationController | null>(null)
    const [levelMeter] = useState(createAudioLevelMeter)

    useEffect(() => {
        vocabularyRef.current = vocabulary
        getTextRef.current = getText
        setTextRef.current = setText
        availabilityRef.current = availability
    })

    // Targets outlive their inputs, so that text still settling reaches a
    // task whose input has left the page, such as one that was filtered out.
    const targetsRef = useRef<ReturnType<typeof createDictationTargets<DictationField>> | null>(null)
    const getTargets = useCallback(() => {
        targetsRef.current ??= createDictationTargets<DictationField>({
            getInput: (targetId) => inputs.current.get(targetId),
            getText: (targetId) => getTextRef.current(targetId),
            setText: (targetId, text) => flushSync(() => setTextRef.current(targetId, text)),
            isFocused: (input) => document.activeElement === input,
            revealCaret: scrollCaretIntoView,
            savedSelections: savedSelections.current,
        })

        return targetsRef.current
    }, [])

    const getController = useCallback((): DictationController => {
        controllerRef.current ??= new DictationController({
            createSession: (listener) => new DictationSession({
                fetchToken: fetchDictationToken,
                createConnection: createRealtimeConnection,
                createAudioSource: createBrowserAudioSource,
                vocabulary: vocabularyRef.current,
                listener: reportSessionActivity(listener),
            }),
            getTarget: (targetId) => getTargets().get(targetId),
            onStateChange: setState,
            onAudioLevel: (level) => {
                if (level === null) {
                    levelMeter.reset()
                } else {
                    levelMeter.receive(level, performance.now())
                }
            },
        })

        return controllerRef.current
    }, [getTargets, levelMeter])

    const readAudioLevel = useCallback(
        (): AudioLevelReading => levelMeter.read(performance.now()),
        [levelMeter],
    )

    const isReadyToStart = useCallback((): boolean => {
        if (availabilityRef.current === "available") {
            return true
        }

        setState({ phase: "idle", targetId: null, message: describeUnavailability(availabilityRef.current) })
        return false
    }, [])

    /** Focuses a field, restoring its last cursor position or selection. */
    const focusInput = useCallback((input: DictationField, targetId: string, force = false): void => {
        focusFieldWithSavedSelection(
            input,
            savedSelections.current.get(targetId),
            document.activeElement === input,
            force,
        )
    }, [])

    const startInInput = useCallback((targetId: string): void => {
        const input = inputs.current.get(targetId)

        if (!input || !isReadyToStart()) {
            return
        }

        focusInput(input, targetId)
        getController().start(targetId, getInputSelection(input))
    }, [focusInput, getController, isReadyToStart])

    const toggleFromButton = useCallback((targetId: string): void => {
        const controller = controllerRef.current
        const input = inputs.current.get(targetId)

        if (controller?.isActive && controller.activeTargetId === targetId) {
            if (input) {
                focusInput(input, targetId)
            }

            controller.stop("user")
        } else {
            startInInput(targetId)
        }
    }, [focusInput, startInInput])

    const toggleFromShortcut = useCallback((): void => {
        const controller = controllerRef.current

        if (controller?.isActive) {
            controller.stop("user")
            return
        }

        const focused = document.activeElement
        const targetId = findShortcutTargetId(inputs.current, buttons.current, focused)

        if (targetId) {
            startInInput(targetId)
        }
    }, [startInInput])

    useEffect(() => {
        let isCurrent = true

        void checkDictationAvailability().then((result) => {
            if (isCurrent) {
                setAvailability(result)
            }
        })

        return () => {
            isCurrent = false
        }
    }, [])

    useEffect(() => {
        let shortcutState = initialCtrlAltShortcutState

        const handleKeyDown = (event: KeyboardEvent): void => {
            shortcutState = trackShortcutKeyDown(shortcutState, toShortcutKeyEvent(event))
        }

        const handleKeyUp = (event: KeyboardEvent): void => {
            const result = trackShortcutKeyUp(shortcutState, toShortcutKeyEvent(event))
            shortcutState = result.state

            if (result.shouldToggle) {
                event.preventDefault()
                toggleFromShortcut()
            }
        }

        const resetShortcut = (): void => {
            shortcutState = initialCtrlAltShortcutState
        }

        const handleSelectionChange = (): void => {
            const controller = controllerRef.current
            const input = document.activeElement as DictationField | null
            const targetId = findFieldId(inputs.current, input)

            if (controller?.isActive && input && targetId) {
                controller.moveInsertionPoint(targetId, getInputSelection(input))
            }
        }

        const checkFocus = (): void => {
            const controller = controllerRef.current

            // Switching to another window or app is not a focus move within the page.
            if (!controller?.isActive || !document.hasFocus()) {
                return
            }

            const focused = document.activeElement
            const inputId = findFieldId(inputs.current, focused)

            if (inputId) {
                controller.moveInsertionPoint(inputId, getInputSelection(focused as DictationField))
            } else if (
                findFieldId(buttons.current, focused) !== controller.activeTargetId &&
                !isDictationSetting(focused)
            ) {
                controller.stop("focus")
            }
        }

        const handleFocusOut = (event: FocusEvent): void => {
            const targetId = findFieldId(inputs.current, event.target as Element)

            if (targetId) {
                savedSelections.current.set(targetId, getInputSelection(event.target as DictationField))
            }

            // Wait until focus has settled on its new element.
            setTimeout(checkFocus, 0)
        }

        window.addEventListener("keydown", handleKeyDown, true)
        window.addEventListener("keyup", handleKeyUp, true)
        window.addEventListener("blur", resetShortcut)
        document.addEventListener("selectionchange", handleSelectionChange)
        document.addEventListener("focusout", handleFocusOut)

        return () => {
            window.removeEventListener("keydown", handleKeyDown, true)
            window.removeEventListener("keyup", handleKeyUp, true)
            window.removeEventListener("blur", resetShortcut)
            document.removeEventListener("selectionchange", handleSelectionChange)
            document.removeEventListener("focusout", handleFocusOut)
        }
    }, [toggleFromShortcut])

    useEffect(() => () => {
        controllerRef.current?.dispose()
    }, [])

    const registerInput = useCallback((targetId: string, input: DictationField | null): void => {
        if (input) {
            inputs.current.set(targetId, input)
            return
        }

        inputs.current.delete(targetId)

        // An input leaving the page may not report losing focus. If it is the
        // one being dictated into and has not come straight back, as it does
        // on an ordinary re-render, dictation stops as it does when focus leaves.
        if (controllerRef.current?.isActive && controllerRef.current.activeTargetId === targetId) {
            setTimeout(() => {
                const controller = controllerRef.current

                if (controller?.isActive && controller.activeTargetId === targetId && !inputs.current.has(targetId)) {
                    controller.stop("focus")
                }
            }, 0)
        }
    }, [])

    const registerButton = useCallback((targetId: string, button: HTMLButtonElement | null): void => {
        if (button) {
            buttons.current.set(targetId, button)
        } else {
            buttons.current.delete(targetId)
        }
    }, [])

    const recordEdit = useCallback((targetId: string, before: string, after: string): void => {
        controllerRef.current?.recordUserEdit(targetId, before, after)
    }, [])

    const removeTarget = useCallback((targetId: string): void => {
        controllerRef.current?.removeTarget(targetId)
        getTargets().forget(targetId)
    }, [getTargets])

    const restoreFocus = useCallback((element: HTMLElement): void => {
        const targetId = findFieldId(inputs.current, element)

        if (targetId) {
            // The browser may already have returned focus here by itself, with
            // the cursor at the start, so the saved selection is applied anyway.
            focusInput(element as DictationField, targetId, true)
        } else {
            element.focus()
        }
    }, [focusInput])

    return {
        availability,
        phase: state.phase,
        activeTargetId: state.targetId,
        message: state.message,
        readAudioLevel,
        registerInput,
        registerButton,
        toggleFromButton,
        recordEdit,
        removeTarget,
        restoreFocus,
    }
}
