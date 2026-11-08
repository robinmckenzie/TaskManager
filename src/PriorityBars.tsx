import type { FC } from "react"

const LEVELS = [1, 2, 3, 4, 5]

interface PriorityBarsProps {
    priority: number
}

/**
 * Five rising bars, filled up to the priority. They are decorative: the number
 * beside them, and the task's controls, carry the value. A saved priority
 * outside 1 to 5 fills none or all of the bars.
 */
export const PriorityBars: FC<PriorityBarsProps> = ({ priority }) => (
    <svg className="priority-bars" viewBox="0 0 19 12" width="19" height="12" aria-hidden="true">
        {LEVELS.map((level: number) => (
            <rect
                key={level}
                className={level <= priority ? "priority-bar-on" : "priority-bar-off"}
                x={(level - 1) * 4}
                y={12 - (level + 1) * 2}
                width="3"
                height={(level + 1) * 2}
                rx="0.75"
            />
        ))}
    </svg>
)
