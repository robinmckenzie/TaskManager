import type { TaskSummary } from "./taskSummary"

const countTasks = (count: number): string => `${count} task${count === 1 ? "" : "s"}`

export interface TaskViewText {
    /** Names the view: "All tasks" or "Bob's tasks". */
    heading: string
    /** "N tasks", or "N of M tasks" when the view is filtered. */
    count: string
    /** Shown in place of the list when a filter leaves no task, else null. */
    emptyMessage: string | null
}

/**
 * Words the heading, the count and the empty message of the task list.
 * `assigneeName` is the person the list is filtered to, or undefined when all
 * assignees are on show. `shownCount` is the number of tasks on show and
 * `totalCount` the number of tasks in all.
 */
export const describeTaskView = (
    assigneeName: string | undefined,
    shownCount: number,
    totalCount: number,
): TaskViewText => {
    if (assigneeName === undefined) {
        return { heading: "All tasks", count: countTasks(totalCount), emptyMessage: null }
    }

    return {
        heading: `${assigneeName}'s tasks`,
        count: `${shownCount} of ${countTasks(totalCount)}`,
        emptyMessage: shownCount === 0 ? `No tasks for ${assigneeName}.` : null,
    }
}

/**
 * Words the summary line, such as "1 overdue · 2 due soon · 1 completed".
 * A category with no tasks is left out, so an empty summary gives an empty
 * string.
 */
export const describeTaskSummary = ({ overdue, dueSoon, completed }: TaskSummary): string =>
    [
        overdue > 0 && `${overdue} overdue`,
        dueSoon > 0 && `${dueSoon} due soon`,
        completed > 0 && `${completed} completed`,
    ]
        .filter(Boolean)
        .join(" · ")
