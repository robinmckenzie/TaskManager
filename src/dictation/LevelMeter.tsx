import { useEffect, useRef } from "react"
import type { FC } from "react"
import type { AudioLevelReading } from "./audioLevel"

export type MeterStyle = "bar" | "needle"

// With reduced motion the meter moves in a few steps a second, not continuously.
const REDUCED_MOTION_REFRESH_MS = 250

interface LevelMeterProps {
    meterStyle: MeterStyle
    readLevel(): AudioLevelReading
}

/**
 * Shows the microphone input level, as a bar with a peak marker or as a
 * needle. Both styles fill the same space and are drawn from the same level,
 * which is written straight to the element so that it does not re-render the
 * page many times a second.
 */
export const LevelMeter: FC<LevelMeterProps> = ({ meterStyle, readLevel }) => {
    const meter = useRef<HTMLSpanElement>(null)

    useEffect(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
        let frame = 0
        let lastDrawnAt = -Infinity

        const draw = (time: number): void => {
            frame = requestAnimationFrame(draw)

            if (reducedMotion.matches && time - lastDrawnAt < REDUCED_MOTION_REFRESH_MS) {
                return
            }

            lastDrawnAt = time
            const { level, peak } = readLevel()
            meter.current?.style.setProperty("--level", level.toFixed(3))
            meter.current?.style.setProperty("--peak", peak.toFixed(3))
        }

        frame = requestAnimationFrame(draw)

        return () => cancelAnimationFrame(frame)
    }, [readLevel])

    return (
        <span
            ref={meter}
            className={`level-meter level-meter-${meterStyle}`}
            role="img"
            aria-label="Microphone input level"
        >
            {meterStyle === "bar" ? (
                <>
                    <span className="level-meter-track">
                        <span className="level-meter-fill" />
                    </span>
                    <span className="level-meter-peak" />
                </>
            ) : (
                <svg aria-hidden="true" viewBox="0 0 72 32" width="72" height="32">
                    <path
                        className="level-meter-scale"
                        d="M17.6 14.6A24 24 0 0 1 54.4 14.6M17.6 14.6l-2.3-1.9M36 6V3M54.4 14.6l2.3-1.9"
                    />
                    <line className="level-meter-needle" x1="36" y1="30" x2="36" y2="8" />
                    <circle className="level-meter-pivot" cx="36" cy="30" r="2" />
                </svg>
            )}
        </span>
    )
}
