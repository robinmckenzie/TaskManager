import { useEffect, useRef } from "react"
import type { CSSProperties, FC } from "react"
import type { AudioLevelReading } from "./audioLevel"
import { createLevelHistory } from "./levelHistory"

export type MeterStyle = "bar" | "needle" | "waveform"
export type BarLook = "solid" | "segments" | "gradient"
export type NeedleLook = "classic" | "zones" | "ticks"
export type WaveformLook = "pill" | "pulse" | "columns"

/** The meter style in use, and the look last chosen for each style. */
export interface MeterChoice {
    style: MeterStyle
    bar: BarLook
    needle: NeedleLook
    waveform: WaveformLook
}

// With reduced motion the meter moves in a few steps a second, not continuously.
const REDUCED_MOTION_REFRESH_MS = 250

// The needle turns about this point, 50 degrees either side of upright.
const PIVOT_X = 36
const PIVOT_Y = 30
const TICK_ANGLES = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50]

/** A point on the dial, `radius` from the pivot and `degrees` from upright. */
const findDialPoint = (degrees: number, radius: number): { x: number; y: number } => {
    const radians = (degrees * Math.PI) / 180

    return {
        x: PIVOT_X + radius * Math.sin(radians),
        y: PIVOT_Y - radius * Math.cos(radians),
    }
}

const NeedleDial: FC<{ look: NeedleLook }> = ({ look }) => {
    switch (look) {
        case "classic":
            return (
                <>
                    <path
                        className="level-meter-scale"
                        d="M17.6 14.6A24 24 0 0 1 54.4 14.6M17.6 14.6l-2.3-1.9M36 6V3M54.4 14.6l2.3-1.9"
                    />
                    <line className="level-meter-hand" x1="36" y1="30" x2="36" y2="8" />
                </>
            )
        case "zones":
            return (
                <>
                    <path className="level-meter-zone-low" d="M17.6 14.6A24 24 0 0 1 40.2 6.4" />
                    <path className="level-meter-zone-mid" d="M40.2 6.4A24 24 0 0 1 48 9.2" />
                    <path className="level-meter-zone-high" d="M48 9.2A24 24 0 0 1 54.4 14.6" />
                    <line className="level-meter-hand" x1="36" y1="30" x2="36" y2="10" />
                </>
            )
        case "ticks":
            return (
                <>
                    {TICK_ANGLES.map((degrees) => {
                        const inner = findDialPoint(degrees, degrees % 50 === 0 ? 19 : 22)
                        const outer = findDialPoint(degrees, 26)

                        return (
                            <line
                                key={degrees}
                                className="level-meter-scale"
                                x1={inner.x}
                                y1={inner.y}
                                x2={outer.x}
                                y2={outer.y}
                            />
                        )
                    })}
                    <polygon className="level-meter-hand" points="36,9 34.2,30 37.8,30" />
                </>
            )
    }
}

// How far each bar of the "pulse" look rises at full level. There is one entry
// for each bar of the waveform, in every look.
const PULSE_SHAPE = [0.3, 0.5, 0.4, 0.7, 0.55, 0.85, 0.7, 1, 0.7, 0.85, 0.55, 0.7, 0.4, 0.5, 0.3]

// The scrolling looks move on by one bar this often.
const WAVEFORM_STEP_MS = 80

interface LevelMeterProps {
    choice: MeterChoice
    readLevel(): AudioLevelReading
}

/**
 * Shows the microphone input level, as a bar with a peak marker, as a needle
 * or as a waveform, in the look chosen for that style. Every style and look
 * fills the same space and is drawn from the same level, which is written
 * straight to the elements so that it does not re-render the page many times
 * a second.
 */
export const LevelMeter: FC<LevelMeterProps> = ({ choice, readLevel }) => {
    const meter = useRef<HTMLSpanElement>(null)
    const waveform = useRef<HTMLSpanElement>(null)
    const { style } = choice

    useEffect(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
        let frame = 0
        let lastDrawnAt = -Infinity
        // Kept whichever style is shown, so that a waveform chosen part-way
        // through starts with the levels that came before it.
        const history = createLevelHistory(PULSE_SHAPE.length, WAVEFORM_STEP_MS)

        const draw = (time: number): void => {
            frame = requestAnimationFrame(draw)

            if (reducedMotion.matches && time - lastDrawnAt < REDUCED_MOTION_REFRESH_MS) {
                return
            }

            lastDrawnAt = time
            const { level, peak } = readLevel()
            meter.current?.style.setProperty("--level", level.toFixed(3))
            meter.current?.style.setProperty("--peak", peak.toFixed(3))

            history.record(level, time)
            const bars = waveform.current?.children ?? []
            history.read().forEach((past, index) => {
                const bar = bars[index] as HTMLElement | undefined
                bar?.style.setProperty("--past", past.toFixed(3))
            })
        }

        frame = requestAnimationFrame(draw)

        return () => cancelAnimationFrame(frame)
    }, [readLevel])

    return (
        <span
            ref={meter}
            className={`level-meter level-meter-${style} level-meter-${style}-${choice[style]}`}
            role="img"
            aria-label="Microphone input level"
        >
            {style === "bar" ? (
                <>
                    <span className="level-meter-track">
                        <span className="level-meter-fill" />
                    </span>
                    <span className="level-meter-peak" />
                </>
            ) : style === "waveform" ? (
                <span ref={waveform} className="level-meter-wave">
                    {PULSE_SHAPE.map((shape, index) => (
                        <span
                            key={index}
                            className="level-meter-wave-bar"
                            style={{ "--shape": shape } as CSSProperties}
                        />
                    ))}
                </span>
            ) : (
                <svg aria-hidden="true" viewBox="0 0 72 32" width="72" height="32">
                    <NeedleDial look={choice.needle} />
                    <circle className="level-meter-pivot" cx={PIVOT_X} cy={PIVOT_Y} r="2" />
                </svg>
            )}
        </span>
    )
}
