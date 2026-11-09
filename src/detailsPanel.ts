/** The part of a row's summary that a click landed on, and so the field the panel focuses. */
export type DetailField = "due" | "priority" | "assignee"

/** The details panel that is open. At most one is. */
export interface OpenPanel {
    taskId: string
    /** The field to focus when the panel opens, or null to leave focus on the summary button. */
    focusField: DetailField | null
}

/**
 * Works out which panel is open after a click on a row's summary. Clicking the
 * summary of the open panel closes it; clicking any other opens that task's
 * panel, which closes the one before.
 */
export const togglePanel = (
    current: OpenPanel | null,
    taskId: string,
    focusField: DetailField | null,
): OpenPanel | null => (current?.taskId === taskId ? null : { taskId, focusField })

/** Keeps the open panel only while its task is among the tasks on show. */
export const keepPanelIfShown = (
    current: OpenPanel | null,
    shownTaskIds: readonly string[],
): OpenPanel | null => (current !== null && shownTaskIds.includes(current.taskId) ? current : null)
