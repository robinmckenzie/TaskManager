import type { TaskType } from "./tasks"

export const ASSIGNEE_FILTER_STORAGE_KEY = "taskmanager.assigneeFilter"

interface Assignee {
    id: string
}

export const normalizeAssigneeFilter = (
    selection: string | null,
    users: readonly Assignee[],
): string => selection !== null && users.some((user) => user.id === selection) ? selection : ""

export const loadAssigneeFilter = (
    users: readonly Assignee[],
    storage?: Pick<Storage, "getItem">,
): string => {
    try {
        return normalizeAssigneeFilter(
            (storage ?? localStorage).getItem(ASSIGNEE_FILTER_STORAGE_KEY),
            users,
        )
    } catch (error) {
        console.warn("Unable to load assignee filter. Showing all assignees.", error)
        return ""
    }
}

export const saveAssigneeFilter = (
    selection: string,
    storage?: Pick<Storage, "setItem">,
): void => {
    try {
        (storage ?? localStorage).setItem(ASSIGNEE_FILTER_STORAGE_KEY, selection)
    } catch (error) {
        console.warn("Unable to save assignee filter. Selection will only be kept in memory.", error)
    }
}

export const getVisibleTasks = (tasks: readonly TaskType[], selection: string) =>
    tasks.map((task, index) => ({ task, index }))
        .filter(({ task }) => selection === "" || task.userId === selection)
