import { describeDictationError, describeDictationStop } from "./dictationMessages"
import type {
    DictationErrorKind,
    DictationStopReason,
    StopMessageTimings,
} from "./dictationMessages"
import type { DictationSessionListener } from "./dictationSession"
import {
    applyEdit,
    composeTokens,
    findEdit,
    moveAreaForEdit,
    normaliseRange,
    prepareInsertion,
    shiftRange,
} from "./insertionText"
import type { TextEdit, TextRange, TranscriptToken } from "./insertionText"

/** An editable text control that dictation can insert into. */
export interface DictationTextTarget {
    getValue(): string
    getSelection(): TextRange
    isFocused(): boolean
    /** Replaces the whole value and, when given, sets the selection. */
    writeValue(value: string, selection?: TextRange): void
}

export interface DictationSessionHandle {
    readonly audioTime: number
    readonly timings?: StopMessageTimings
    start(): Promise<void>
    stop(reason: DictationStopReason, errorKind?: DictationErrorKind): void
}

export type DictationPhase = "idle" | "starting" | "listening"

export interface DictationState {
    phase: DictationPhase
    targetId: string | null
    message: string
}

export interface DictationControllerOptions {
    createSession(listener: DictationSessionListener): DictationSessionHandle
    getTarget(targetId: string): DictationTextTarget | undefined
    onStateChange(state: DictationState): void
}

/** Where speech that began at or after `fromAudio` is inserted. */
interface InsertionArea {
    targetId: string
    range: TextRange
    isPrepared: boolean
    isDetached: boolean
    fromAudio: number
    finalTokens: TranscriptToken[]
    partialTokens: TranscriptToken[]
    text: string
}

/**
 * One dictation, from starting until its recognised text has settled: its
 * session and the insertion areas its speech goes to. The last area is the
 * current one. A stopped run is kept until settled so that late revisions
 * still reach their areas.
 */
interface DictationRun {
    session: DictationSessionHandle
    areas: InsertionArea[]
}

const isSameRange = (left: TextRange, right: TextRange): boolean => {
    const a = normaliseRange(left)
    const b = normaliseRange(right)

    return a.start === b.start && a.end === b.end
}

const getCursorRange = (area: InsertionArea): TextRange =>
    area.isPrepared ? { start: area.range.end, end: area.range.end } : normaliseRange(area.range)

/**
 * Creates an insertion area at a cursor position or selection. It receives
 * speech that begins at or after `fromAudio`, and holds no text until then.
 */
const createArea = (targetId: string, range: TextRange, fromAudio: number): InsertionArea => ({
    targetId,
    range: normaliseRange(range),
    isPrepared: false,
    isDetached: false,
    fromAudio,
    finalTokens: [],
    partialTokens: [],
    text: "",
})

/**
 * Inserts recognised speech into text targets, keeping each piece of speech in
 * the area where it began while new speech follows the cursor and focus.
 */
export class DictationController {
    private readonly options: DictationControllerOptions
    private readonly runs = new Set<DictationRun>()
    private activeRun?: DictationRun
    private state: DictationState = { phase: "idle", targetId: null, message: "" }

    constructor(options: DictationControllerOptions) {
        this.options = options
    }

    get activeTargetId(): string | null {
        return this.activeRun ? this.getCurrentArea(this.activeRun).targetId : null
    }

    get isActive(): boolean {
        return this.activeRun !== undefined
    }

    start(targetId: string, selection: TextRange): void {
        this.activeRun?.session.stop("user")

        const areas = [createArea(targetId, selection, 0)]
        const run: DictationRun = {
            areas,
            session: this.options.createSession(this.createListener(() => run)),
        }
        this.runs.add(run)
        this.activeRun = run
        this.emitState("starting", targetId, "Starting dictation.")
        void run.session.start()
    }

    stop(reason: DictationStopReason): void {
        this.activeRun?.session.stop(reason)
    }

    /** Sends subsequent speech to a new cursor position or focused target. */
    moveInsertionPoint(targetId: string, selection: TextRange): void {
        const run = this.activeRun

        if (!run) {
            return
        }

        const current = this.getCurrentArea(run)

        if (current.targetId === targetId && isSameRange(getCursorRange(current), selection)) {
            return
        }

        run.areas.push(createArea(targetId, selection, run.session.audioTime))

        if (current.targetId !== targetId) {
            this.emitState(this.state.phase, targetId, this.state.message)
        }
    }

    /** Keeps areas aligned with a user's edit, detaching any area it touches. */
    recordUserEdit(targetId: string, before: string, after: string): void {
        const edit = findEdit(before, after)

        for (const area of this.getTargetAreas(targetId)) {
            this.moveAreaForEdit(area, edit)
        }
    }

    /** Stops dictation into a removed target and forgets its areas. */
    removeTarget(targetId: string): void {
        if (this.activeTargetId === targetId) {
            this.activeRun?.session.stop("task_deleted")
        }

        for (const area of this.getTargetAreas(targetId)) {
            area.isDetached = true
        }
    }

    dispose(): void {
        for (const run of this.runs) {
            run.session.stop("user")
        }

        this.runs.clear()
        this.activeRun = undefined
    }

    private createListener(getRun: () => DictationRun): DictationSessionListener {
        return {
            onListening: () => {
                const run = getRun()

                if (run === this.activeRun) {
                    this.emitState("listening", this.getCurrentArea(run).targetId, "Dictation started.")
                }
            },
            onTranscript: (isFinal, tokens) => this.applyTranscript(getRun(), isFinal, tokens),
            onStopped: (reason, errorKind) => {
                if (getRun() !== this.activeRun) {
                    return
                }

                this.activeRun = undefined
                this.emitState(
                    "idle",
                    null,
                    reason === "error"
                        ? describeDictationError(errorKind ?? "service_unavailable")
                        : describeDictationStop(reason, getRun().session.timings),
                )
            },
            onSettled: () => {
                this.runs.delete(getRun())
            },
        }
    }

    private applyTranscript(run: DictationRun, isFinal: boolean, tokens: TranscriptToken[]): void {
        const tokensByArea = new Map<InsertionArea, TranscriptToken[]>()

        for (const token of tokens) {
            const area = this.findAreaForTime(run, token.startTime)
            tokensByArea.set(area, [...(tokensByArea.get(area) ?? []), token])
        }

        for (const area of run.areas) {
            const areaTokens = tokensByArea.get(area) ?? []

            if (isFinal) {
                area.finalTokens = [...area.finalTokens, ...areaTokens]
                area.partialTokens = []
            } else {
                area.partialTokens = areaTokens
            }

            this.renderArea(run, area)
        }
    }

    private findAreaForTime(run: DictationRun, time: number): InsertionArea {
        const startedBefore = run.areas.filter((area) => area.fromAudio <= time)

        return startedBefore.at(-1) ?? run.areas[0]
    }

    private renderArea(run: DictationRun, area: InsertionArea): void {
        const target = this.options.getTarget(area.targetId)
        const text = composeTokens([...area.finalTokens, ...area.partialTokens])

        if (!target || area.isDetached || text === area.text || (!area.isPrepared && !text)) {
            return
        }

        let value = target.getValue()
        let selection = target.isFocused() ? target.getSelection() : undefined
        const applyAreaEdit = (edit: TextEdit): void => {
            value = applyEdit(value, edit)
            this.moveOtherAreas(area, edit)
            selection = selection && shiftRange(selection, edit)
        }

        if (!area.isPrepared) {
            const prepared = prepareInsertion(value, area.range)
            applyAreaEdit(prepared.edit)
            area.range = { start: prepared.position, end: prepared.position }
            area.isPrepared = true
        }

        const { start } = area.range
        applyAreaEdit({ start, end: area.range.end, insert: text })
        area.range = { start, end: start + text.length }
        area.text = text

        if (selection && area === this.getCurrentArea(run) && run === this.activeRun) {
            selection = getCursorRange(area)
        }

        target.writeValue(value, selection)
    }

    private moveOtherAreas(changedArea: InsertionArea, edit: TextEdit): void {
        for (const area of this.getTargetAreas(changedArea.targetId)) {
            if (area !== changedArea) {
                this.moveAreaForEdit(area, edit)
            }
        }
    }

    /**
     * Keeps an area aligned with an edit elsewhere in its text. An edit that
     * overlaps dictated text detaches its area. An area still waiting for its
     * first speech has no text to protect, so it follows the edit as the
     * cursor or selection it came from does.
     */
    private moveAreaForEdit(area: InsertionArea, edit: TextEdit): void {
        const moved = moveAreaForEdit(area.range, edit)

        if (moved) {
            area.range = moved
        } else if (area.isPrepared) {
            area.isDetached = true
        } else {
            area.range = shiftRange(area.range, edit)
        }
    }

    private getTargetAreas(targetId: string): InsertionArea[] {
        return [...this.runs].flatMap((run) =>
            run.areas.filter((area) => area.targetId === targetId && !area.isDetached))
    }

    private getCurrentArea(run: DictationRun): InsertionArea {
        return run.areas[run.areas.length - 1]
    }

    private emitState(phase: DictationPhase, targetId: string | null, message: string): void {
        this.state = { phase, targetId, message }
        this.options.onStateChange(this.state)
    }
}
