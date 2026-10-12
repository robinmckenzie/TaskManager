/*
 * The microphone input level shown while dictation listens. It is worked out
 * from audio the session has already captured, and stays in the page: neither
 * the audio nor the level is kept or sent anywhere.
 */

// Sound at or below the floor reads as zero, and at or above the ceiling as full.
const FLOOR_DECIBELS = -60
const CEILING_DECIBELS = -10

/** How long the peak marker stays at a peak before it starts to fall. */
export const PEAK_HOLD_MS = 1000

// Parts of the full scale per second.
const LEVEL_FALL_RATE = 2
const PEAK_FALL_RATE = 1

/** A level and its recent peak, each from 0 (silence) to 1 (full scale). */
export interface AudioLevelReading {
    level: number
    peak: number
}

export interface AudioLevelMeter {
    /** Takes the level of the latest audio, measured at the time `now`. */
    receive(level: number, now: number): void
    /** The level and peak to show at the time `now`, in milliseconds. */
    read(now: number): AudioLevelReading
    /** Forgets the level and peak, as for a new dictation session. */
    reset(): void
}

const clampToScale = (value: number): number => Math.min(1, Math.max(0, value))

/** Measures a block of audio samples as a level from 0 (silence) to 1. */
export const measureAudioLevel = (samples: Float32Array): number => {
    if (samples.length === 0) {
        return 0
    }

    let sumOfSquares = 0

    for (const sample of samples) {
        sumOfSquares += sample * sample
    }

    const decibels = 10 * Math.log10(sumOfSquares / samples.length)

    return clampToScale((decibels - FLOOR_DECIBELS) / (CEILING_DECIBELS - FLOOR_DECIBELS))
}

/**
 * Creates a meter that rises at once with the sound and falls back gradually,
 * so that it can be read. Its peak holds the highest recent level for
 * `PEAK_HOLD_MS`, then falls until a higher level raises it again.
 */
export const createAudioLevelMeter = (): AudioLevelMeter => {
    let level = 0
    let levelAt = 0
    let peak = 0
    let peakAt = 0

    const readLevel = (now: number): number =>
        Math.max(0, level - (LEVEL_FALL_RATE * (now - levelAt)) / 1000)

    const readPeak = (now: number): number => {
        const fallingFor = now - peakAt - PEAK_HOLD_MS
        const held = fallingFor > 0 ? peak - (PEAK_FALL_RATE * fallingFor) / 1000 : peak

        return Math.max(held, readLevel(now))
    }

    return {
        receive: (received, now) => {
            const peakBefore = readPeak(now)
            level = Math.max(clampToScale(received), readLevel(now))
            levelAt = now

            if (level >= peakBefore) {
                peak = level
                peakAt = now
            }
        },
        read: (now) => ({ level: readLevel(now), peak: readPeak(now) }),
        reset: () => {
            level = 0
            peak = 0
        },
    }
}
