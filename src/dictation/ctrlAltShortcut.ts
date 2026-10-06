export interface ShortcutKeyEvent {
    key: string
    isAltGraph: boolean
}

export interface CtrlAltShortcutState {
    isControlDown: boolean
    isAltDown: boolean
    isChordPressed: boolean
    isCancelled: boolean
}

export const initialCtrlAltShortcutState: CtrlAltShortcutState = {
    isControlDown: false,
    isAltDown: false,
    isChordPressed: false,
    isCancelled: false,
}

const isModifierKey = (key: string): boolean => key === "Control" || key === "Alt"

/**
 * Tracks a key press for the Ctrl + Alt shortcut. Any other key pressed while
 * either modifier is held, including AltGr, cancels the shortcut.
 */
export const trackShortcutKeyDown = (
    state: CtrlAltShortcutState,
    event: ShortcutKeyEvent,
): CtrlAltShortcutState => {
    const isHoldingModifier = state.isControlDown || state.isAltDown

    if (event.isAltGraph || !isModifierKey(event.key)) {
        return isHoldingModifier ? { ...state, isCancelled: true } : state
    }

    const next = {
        ...state,
        isControlDown: state.isControlDown || event.key === "Control",
        isAltDown: state.isAltDown || event.key === "Alt",
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
    if (!isModifierKey(event.key)) {
        return { state, shouldToggle: false }
    }

    const shouldToggle = state.isChordPressed && !state.isCancelled
    const isControlDown = state.isControlDown && event.key !== "Control"
    const isAltDown = state.isAltDown && event.key !== "Alt"

    if (!isControlDown && !isAltDown) {
        return { state: initialCtrlAltShortcutState, shouldToggle }
    }

    return {
        state: { ...state, isControlDown, isAltDown, isCancelled: state.isCancelled || shouldToggle },
        shouldToggle,
    }
}
