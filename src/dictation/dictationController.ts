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
    /** The recognition language, known once the session has its token. */
    readonly language?: string
    start(): Promise<void>
    stop(reason: DictationStopReason, errorKind?: DictationErrorKind): void
}

/**
 * "starting" lasts until recognition is ready, and "listening" while speech is
 * accepted. "finishing" means recording has stopped but the session may still
 * deliver recognised text.
 */
export type DictationPhase = "idle" | "starting" | "listening" | "finishing"

export interface DictationState {
    phase: DictationPhase
    targetId: string | null
    message: string
}

export interface DictationControllerOptions {
    createSession(listener: DictationSessionListener): DictationSessionHandle
    getTarget(targetId: string): DictationTextTarget | undefined
    onStateChange(state: DictationState): void
    /** The listening session's microphone level, or null when it has none to show. */
    onAudioLevel(level: number | null): void
}

/**
 * Receives the speech of a task description, which is interpreted as it
 * arrives and not inserted into a text target.
 */
export interface DescriptionSink {
    onListening(language?: string): void
    onTranscript(isFinal: boolean, tokens: TranscriptToken[]): void
    /** Called once, as soon as recording stops for any reason. */
    onStopped(): void
    /** Called once no more recognised text will arrive after stopping. */
    onSettled(): void
}

/** The target id that the dictation state reports while a description is being captured. */
export const DESCRIPTION_TARGET_ID = "task-description"

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
 * still reach their areas. A description run has a sink and no areas.
 */
interface DictationRun {
    session: DictationSessionHandle
    areas: InsertionArea[]
    sink?: DescriptionSink
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
    /** The run that stopped last, until it settles or another run starts. */
    private finishingRun?: DictationRun
    private state: DictationState = { phase: "idle", targetId: null, message: "" }

    constructor(options: DictationControllerOptions) {
        this.options = options
    }

    get activeTargetId(): string | null {
        return this.activeRun ? this.getRunTargetId(this.activeRun) : null
    }

    /** Whether a task description is being captured, as opposed to a title dictated. */
    get isDescriptionActive(): boolean {
        return this.activeRun?.sink !== undefined
    }

    /** The audio time of the description capture in progress, on the clock of its results. */
    get descriptionAudioTime(): number | undefined {
        return this.activeRun?.sink ? this.activeRun.session.audioTime : undefined
    }

    get isActive(): boolean {
        return this.activeRun !== undefined
    }

    start(targetId: string, selection: TextRange): void {
        this.startRun([createArea(targetId, selection, 0)])
    }

    /** Starts capturing a task description, whose speech goes to `sink`. */
    startDescription(sink: DescriptionSink): void {
        this.startRun([], sink)
    }

    private startRun(areas: InsertionArea[], sink?: DescriptionSink): void {
        this.activeRun?.session.stop("user")

        const run: DictationRun = {
            areas,
            sink,
            session: this.options.createSession(this.createListener(() => run)),
        }
        const targetId = this.getRunTargetId(run)
        this.runs.add(run)
        this.activeRun = run
        // Feedback now belongs to this run, not to one that is still finishing.
        this.finishingRun = undefined
        this.options.onAudioLevel(null)
        this.emitState("starting", targetId, "")
        void run.session.start()
    }

    stop(reason: DictationStopReason): void {
        this.activeRun?.session.stop(reason)
    }

    /** Sends subsequent speech to a new cursor position or focused target. */
    moveInsertionPoint(targetId: string, selection: TextRange): void {
        const run = this.activeRun

        if (!run || run.sink) {
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
        this.finishingRun = undefined
    }

    private createListener(getRun: () => DictationRun): DictationSessionListener {
        return {
            onListening: () => {
                const run = getRun()

                if (run === this.activeRun) {
                    this.emitState("listening", this.getRunTargetId(run), "")
                }

                run.sink?.onListening(run.session.language)
            },
            onAudioLevel: (level) => {
                if (getRun() === this.activeRun) {
                    this.options.onAudioLevel(level)
                }
            },
            onTranscript: (isFinal, tokens) => {
                const run = getRun()

                if (run.sink) {
                    run.sink.onTranscript(isFinal, tokens)
                } else {
                    this.applyTranscript(run, isFinal, tokens)
                }
            },
            onStopped: (reason, errorKind) => {
                const run = getRun()
                run.sink?.onStopped()

                if (run !== this.activeRun) {
                    return
                }

                this.activeRun = undefined
                this.finishingRun = run
                this.options.onAudioLevel(null)
                this.emitState(
                    "finishing",
                    null,
                    reason === "error"
                        ? describeDictationError(errorKind ?? "service_unavailable")
                        : describeDictationStop(reason, run.session.timings, run.sink !== undefined),
                )
            },
            onSettled: () => {
                const run = getRun()
                this.runs.delete(run)
                run.sink?.onSettled()

                if (run === this.finishingRun) {
                    this.finishingRun = undefined
                    this.emitState("idle", null, this.state.message)
                }
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

    private getRunTargetId(run: DictationRun): string {
        return run.sink ? DESCRIPTION_TARGET_ID : this.getCurrentArea(run).targetId
    }

    private emitState(phase: DictationPhase, targetId: string | null, message: string): void {
        this.state = { phase, targetId, message }
        this.options.onStateChange(this.state)
    }
}
