export interface ShortcutKeyEvent {
    key: string
    /** Identifies the physical key, so that a release matches its press. */
    code: string
    isAltGraph: boolean
}

export interface CtrlAltShortcutState {
    isControlDown: boolean
    isAltDown: boolean
    isChordPressed: boolean
    isCancelled: boolean
    /** Codes of keys other than Ctrl and Alt that are currently held. */
    otherKeysDown: readonly string[]
}

export const initialCtrlAltShortcutState: CtrlAltShortcutState = {
    isControlDown: false,
    isAltDown: false,
    isChordPressed: false,
    isCancelled: false,
    otherKeysDown: [],
}

const isModifierKey = (key: string): boolean => key === "Control" || key === "Alt"

/**
 * Tracks a key press for the Ctrl + Alt shortcut. Any other key held together
 * with either modifier, including AltGr, cancels the shortcut, whether it was
 * pressed before or after the modifier.
 */
export const trackShortcutKeyDown = (
    state: CtrlAltShortcutState,
    event: ShortcutKeyEvent,
): CtrlAltShortcutState => {
    const isHoldingModifier = state.isControlDown || state.isAltDown

    if (event.isAltGraph || !isModifierKey(event.key)) {
        return {
            ...state,
            isCancelled: state.isCancelled || isHoldingModifier,
            otherKeysDown: state.otherKeysDown.includes(event.code)
                ? state.otherKeysDown
                : [...state.otherKeysDown, event.code],
        }
    }

    const next = {
        ...state,
        isControlDown: state.isControlDown || event.key === "Control",
        isAltDown: state.isAltDown || event.key === "Alt",
        isCancelled: state.isCancelled || state.otherKeysDown.length > 0,
    }

    return {
        ...next,
        isChordPressed: next.isChordPressed || (next.isControlDown && next.isAltDown),
    }
}

/**
 * Tracks a key release and reports whether it completes the shortcut. The
 * shortcut fires once, when the first of Ctrl and Alt is released.
 */
export const trackShortcutKeyUp = (
    state: CtrlAltShortcutState,
    event: ShortcutKeyEvent,
): { state: CtrlAltShortcutState; shouldToggle: boolean } => {
    // Released under either name: AltGr can arrive as a Ctrl press that is
    // treated as another key, then leave as an ordinary Ctrl release.
    const otherKeysDown = state.otherKeysDown.filter((code) => code !== event.code)

    if (!isModifierKey(event.key)) {
        return { state: { ...state, otherKeysDown }, shouldToggle: false }
    }

    const shouldToggle = state.isChordPressed && !state.isCancelled
    const isControlDown = state.isControlDown && event.key !== "Control"
    const isAltDown = state.isAltDown && event.key !== "Alt"

    if (!isControlDown && !isAltDown) {
        return { state: { ...initialCtrlAltShortcutState, otherKeysDown }, shouldToggle }
    }

    return {
        state: {
            ...state,
            otherKeysDown,
            isControlDown,
            isAltDown,
            isCancelled: state.isCancelled || shouldToggle,
        },
        shouldToggle,
    }
}
