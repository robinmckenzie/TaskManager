import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"
import { scrollCaretIntoView } from "./caretScroll"
import {
    initialCtrlAltShortcutState,
    trackShortcutKeyDown,
    trackShortcutKeyUp,
} from "./ctrlAltShortcut"
import type { ShortcutKeyEvent } from "./ctrlAltShortcut"
import { DictationController } from "./dictationController"
import type { DictationPhase, DictationState, DictationTextTarget } from "./dictationController"
import { describeDictationError } from "./dictationMessages"
import { DictationSession } from "./dictationSession"
import { shiftRangeForChange } from "./insertionText"
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
    setText(targetId: string, text: string): void
}

export interface Dictation {
    availability: DictationAvailability
    phase: DictationPhase
    activeTargetId: string | null
    message: string
    registerInput(targetId: string, input: HTMLInputElement | null): void
    registerButton(targetId: string, button: HTMLButtonElement | null): void
    toggleFromButton(targetId: string): void
    recordEdit(targetId: string, before: string, after: string): void
    removeTarget(targetId: string): void
}

const getInputSelection = (input: HTMLInputElement): TextRange => ({
    start: input.selectionStart ?? input.value.length,
    end: input.selectionEnd ?? input.value.length,
})

const findTargetId = <T extends Element>(
    elements: Map<string, T>,
    element: Element | null,
): string | undefined =>
    [...elements].find(([, candidate]) => candidate === element)?.[0]

const toShortcutKeyEvent = (event: KeyboardEvent): ShortcutKeyEvent => ({
    key: event.key,
    isAltGraph: event.key === "AltGraph" || event.getModifierState("AltGraph"),
})

const describeUnavailability = (availability: DictationAvailability): string =>
    availability === "checking"
        ? "Dictation is still being checked. Try again in a moment."
        : describeDictationError(availability === "unsupported" ? "unsupported" : "not_configured")

/**
 * Connects dictation to registered text inputs: their dictation buttons, the
 * Ctrl + Alt shortcut, cursor and focus tracking, and status messages.
 */
export const useDictation = ({ vocabulary, setText }: UseDictationOptions): Dictation => {
    const [availability, setAvailability] = useState<DictationAvailability>("checking")
    const [state, setState] = useState<DictationState>({ phase: "idle", targetId: null, message: "" })
    const inputs = useRef(new Map<string, HTMLInputElement>())
    const buttons = useRef(new Map<string, HTMLButtonElement>())
    const savedSelections = useRef(new Map<string, TextRange>())
    const vocabularyRef = useRef(vocabulary)
    const setTextRef = useRef(setText)
    const availabilityRef = useRef(availability)
    const controllerRef = useRef<DictationController | null>(null)

    useEffect(() => {
        vocabularyRef.current = vocabulary
        setTextRef.current = setText
        availabilityRef.current = availability
    })

    const createInputTarget = useCallback((targetId: string, input: HTMLInputElement): DictationTextTarget => ({
        getValue: () => input.value,
        getSelection: () => getInputSelection(input),
        isFocused: () => document.activeElement === input,
        writeValue: (value, selection) => {
            const before = input.value
            const saved = savedSelections.current.get(targetId)
            flushSync(() => setTextRef.current(targetId, value))

            if (selection) {
                input.setSelectionRange(selection.start, selection.end)
                scrollCaretIntoView(input)
            } else if (saved) {
                // Not focused: keep the selection that focusing will restore
                // pointing at the same text.
                savedSelections.current.set(targetId, shiftRangeForChange(saved, before, value))
            }
        },
    }), [])

    const getController = useCallback((): DictationController => {
        controllerRef.current ??= new DictationController({
            createSession: (listener) => new DictationSession({
                fetchToken: fetchDictationToken,
                createConnection: createRealtimeConnection,
                createAudioSource: createBrowserAudioSource,
                vocabulary: vocabularyRef.current,
                listener,
            }),
            getTarget: (targetId) => {
                const input = inputs.current.get(targetId)
                return input && createInputTarget(targetId, input)
            },
            onStateChange: setState,
        })

        return controllerRef.current
    }, [createInputTarget])

    const isReadyToStart = useCallback((): boolean => {
        if (availabilityRef.current === "available") {
            return true
        }

        setState({ phase: "idle", targetId: null, message: describeUnavailability(availabilityRef.current) })
        return false
    }, [])

    /** Focuses an input, restoring its last cursor position or selection. */
    const focusInput = useCallback((input: HTMLInputElement, targetId: string): void => {
        if (document.activeElement === input) {
            return
        }

        const saved = savedSelections.current.get(targetId)
        const length = input.value.length
        input.focus()
        input.setSelectionRange(
            Math.min(saved?.start ?? length, length),
            Math.min(saved?.end ?? length, length),
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
        const targetId = findTargetId(inputs.current, focused) ?? findTargetId(buttons.current, focused)

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
            const input = document.activeElement as HTMLInputElement | null
            const targetId = findTargetId(inputs.current, input)

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
            const inputId = findTargetId(inputs.current, focused)

            if (inputId) {
                controller.moveInsertionPoint(inputId, getInputSelection(focused as HTMLInputElement))
            } else if (findTargetId(buttons.current, focused) !== controller.activeTargetId) {
                controller.stop("focus")
            }
        }

        const handleFocusOut = (event: FocusEvent): void => {
            const targetId = findTargetId(inputs.current, event.target as Element)

            if (targetId) {
                savedSelections.current.set(targetId, getInputSelection(event.target as HTMLInputElement))
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

    const registerInput = useCallback((targetId: string, input: HTMLInputElement | null): void => {
        if (input) {
            inputs.current.set(targetId, input)
        } else {
            inputs.current.delete(targetId)
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
        savedSelections.current.delete(targetId)
    }, [])

    return {
        availability,
        phase: state.phase,
        activeTargetId: state.targetId,
        message: state.message,
        registerInput,
        registerButton,
        toggleFromButton,
        recordEdit,
        removeTarget,
    }
}
