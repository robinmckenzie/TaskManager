/** The accessible names of the controls on one task card. */
export interface TaskControlNames {
    title: string
    /** What the task's dictation button says it dictates into. */
    dictationTarget: string
    dueDate: string
    priority: string
    assignee: string
    completed: string
    deleteButton: string
}

/**
 * Names a task's controls so that each says what it does first and which task
 * it belongs to last. A task with a blank title is known by its position among
 * the tasks on show, counted from 1.
 */
export const getTaskControlNames = (title: string, visiblePosition: number): TaskControlNames => {
    const trimmedTitle = title.trim()
    const taskName = trimmedTitle === "" ? `untitled task ${visiblePosition}` : trimmedTitle

    return {
        // A text input's content is read out after its name, so the title is
        // not repeated in it.
        title: trimmedTitle === "" ? `Title of ${taskName}` : "Task title",
        dictationTarget: taskName,
        dueDate: `Due date for ${taskName}`,
        priority: `Priority for ${taskName}`,
        assignee: `Assignee for ${taskName}`,
        completed: `Complete ${taskName}`,
        deleteButton: `Delete ${taskName}`,
    }
}
