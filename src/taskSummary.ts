import { getDueState } from "./dueDates"
import type { TaskType } from "./tasks"

export interface TaskSummary {
    overdue: number
    dueSoon: number
    completed: number
}

/**
 * Counts how many of `tasks` are overdue, due soon and completed, using the
 * same due state as the task rows. Each task counts in at most one category:
 * completed tasks count only as completed, and only incomplete tasks count as
 * overdue or due soon. An empty list gives three zeroes.
 */
export const summariseTasks = (tasks: TaskType[], today: Date): TaskSummary => {
    const summary: TaskSummary = { overdue: 0, dueSoon: 0, completed: 0 }

    for (const task of tasks) {
        const { kind } = getDueState(task.dueDate, task.completed, today)

        if (kind === "completed") {
            summary.completed += 1
        } else if (kind === "overdue") {
            summary.overdue += 1
        } else if (kind === "due-soon") {
            summary.dueSoon += 1
        }
    }

    return summary
}
