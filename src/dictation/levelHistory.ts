/*
 * The recent microphone levels that the scrolling waveform looks draw, one
 * for each bar. Like the level itself, they stay in the page.
 */

export interface LevelHistory {
    /** Takes the level shown at the time `now`, in milliseconds. */
    record(level: number, now: number): void
    /** The recent levels, oldest first. The last is the one still being taken. */
    read(): readonly number[]
}

/**
 * Creates a history of `length` levels, which moves on by one every `stepMs`.
 * Each holds the highest level recorded during its step, so that a short
 * sound between two steps is not lost.
 */
export const createLevelHistory = (length: number, stepMs: number): LevelHistory => {
    const levels: number[] = new Array<number>(length).fill(0)
    let steppedAt: number | undefined

    return {
        record: (level, now) => {
            steppedAt ??= now
            // After a long gap, such as a hidden tab, one full history is enough.
            const steps = Math.min(length, Math.floor((now - steppedAt) / stepMs))

            if (steps === 0) {
                levels[length - 1] = Math.max(levels[length - 1], level)
                return
            }

            for (let step = 0; step < steps; step++) {
                levels.shift()
                levels.push(level)
            }

            steppedAt = now - ((now - steppedAt) % stepMs)
        },
        read: () => levels,
    }
}
