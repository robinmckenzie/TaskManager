import { describe, expect, it } from "vitest"
import { createAudioLevelMeter, measureAudioLevel, PEAK_HOLD_MS } from "./audioLevel"

const samples = (amplitude: number): Float32Array => new Float32Array(160).fill(amplitude)

describe("measureAudioLevel", () => {
    it("reads silence, and no audio at all, as zero", () => {
        expect(measureAudioLevel(samples(0))).toBe(0)
        expect(measureAudioLevel(new Float32Array(0))).toBe(0)
    })

    it("reads sound too quiet to matter as zero and full-scale sound as one", () => {
        expect(measureAudioLevel(samples(0.0005))).toBe(0)
        expect(measureAudioLevel(samples(1))).toBe(1)
    })

    it("rises with louder sound, whichever way the samples swing", () => {
        const quiet = measureAudioLevel(samples(0.01))
        const loud = measureAudioLevel(samples(-0.1))

        expect(quiet).toBeCloseTo(0.4)
        expect(loud).toBeCloseTo(0.8)
    })
})

describe("createAudioLevelMeter", () => {
    it("reads zero before any audio", () => {
        expect(createAudioLevelMeter().read(0)).toEqual({ level: 0, peak: 0 })
    })

    it("rises at once and falls back gradually", () => {
        const meter = createAudioLevelMeter()

        meter.receive(0.8, 1000)
        expect(meter.read(1000).level).toBe(0.8)

        // Silence follows: the level falls but does not drop straight to zero.
        meter.receive(0, 1100)
        expect(meter.read(1100).level).toBeCloseTo(0.6)
        expect(meter.read(1500).level).toBe(0)
    })

    it("falls when audio stops arriving", () => {
        const meter = createAudioLevelMeter()

        meter.receive(0.8, 1000)

        expect(meter.read(1200).level).toBeCloseTo(0.4)
        expect(meter.read(5000).level).toBe(0)
    })

    it("holds the peak, then lets it fall", () => {
        const meter = createAudioLevelMeter()

        meter.receive(0.8, 1000)
        meter.receive(0, 1100)

        expect(meter.read(1000 + PEAK_HOLD_MS).peak).toBe(0.8)
        expect(meter.read(1000 + PEAK_HOLD_MS + 200).peak).toBeCloseTo(0.6)
        expect(meter.read(1000 + PEAK_HOLD_MS + 5000).peak).toBe(0)
    })

    it("raises the peak for a higher level and holds it afresh", () => {
        const meter = createAudioLevelMeter()

        meter.receive(0.5, 1000)
        meter.receive(0.3, 1400)
        expect(meter.read(1400).peak).toBe(0.5)

        meter.receive(0.9, 1800)
        expect(meter.read(1800).peak).toBe(0.9)
        expect(meter.read(1800 + PEAK_HOLD_MS).peak).toBe(0.9)
    })

    it("takes a falling peak back up to a level that passes it", () => {
        const meter = createAudioLevelMeter()

        meter.receive(0.8, 0)
        meter.receive(0.5, PEAK_HOLD_MS + 500)

        expect(meter.read(PEAK_HOLD_MS + 500).peak).toBe(0.5)
        expect(meter.read(2 * PEAK_HOLD_MS + 500).peak).toBe(0.5)
    })

    it("never shows the peak below the level", () => {
        const meter = createAudioLevelMeter()

        meter.receive(0.6, 0)

        for (const now of [0, 300, 1200, 1500]) {
            const { level, peak } = meter.read(now)
            expect(peak).toBeGreaterThanOrEqual(level)
        }
    })

    it("keeps levels within the scale", () => {
        const meter = createAudioLevelMeter()

        meter.receive(3, 0)

        expect(meter.read(0)).toEqual({ level: 1, peak: 1 })
    })

    it("forgets the level and peak when reset, as for a new session", () => {
        const meter = createAudioLevelMeter()

        meter.receive(0.9, 1000)
        meter.reset()

        expect(meter.read(1000)).toEqual({ level: 0, peak: 0 })

        meter.receive(0.2, 1100)
        expect(meter.read(1100)).toEqual({ level: 0.2, peak: 0.2 })
    })
})
