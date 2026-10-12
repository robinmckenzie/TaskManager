import { format, parseISO } from "date-fns"
import { composeTokens, findEdit } from "../dictation/insertionText"
import type { TextEdit, TranscriptToken } from "../dictation/insertionText"
import { interpretDescription } from "./interpretDescription"
import type {
    DescriptionAssignee,
    DescriptionInstruction,
    DescriptionUncertainty,
    InstructionField,
} from "./interpretDescription"

/*
 * One attempt at describing a new task: the description as typed or
 * recognised, the user's own edits to the proposed fields, and what remains
 * to check before the task can be created. Every function here returns a new
 * attempt and changes nothing.
 *
 * The proposed fields are worked out from the whole description each time,
 * never changed by recognition. What decides between an instruction in the
 * description and the user's own edit of the same field is which came later.
 */

/**
 * When something was supplied. Typing and field edits each take a new step. A
 * capture takes one step, and within it speech is ordered by audio time, so a
 * revision of earlier speech keeps its earlier moment.
 */
export interface Moment {
    step: number
    audio: number
}

export type AttemptField = "title" | InstructionField

export interface AttemptFields {
    title: string
    /** yyyy-MM-dd, or "" for no due date. */
    dueDate: string
    priority: number
    userId: string
}

export type CaptureState = "none" | "starting" | "listening" | "finishing"

interface TimedInstruction extends DescriptionInstruction {
    moment: Moment
}

interface ManualEdit {
    value: string | number
    moment: Moment
}

type AcceptedPhrase = Pick<DescriptionUncertainty, "field" | "wording" | "start" | "end">

interface Capture {
    state: Exclude<CaptureState, "none">
    step: number
    /** The description before this capture, which its speech is added to. */
    baseText: string
    baseMoments: readonly Moment[]
    finalTokens: readonly TranscriptToken[]
    partialTokens: readonly TranscriptToken[]
}

export interface DescriptionAttempt {
    readonly id: string
    /** The local calendar day the attempt began, which relative dates count from. */
    readonly referenceDay: string
    readonly assignees: readonly DescriptionAssignee[]
    readonly defaults: Omit<AttemptFields, "title">
    readonly text: string
    /** When each character of the text was supplied. */
    readonly moments: readonly Moment[]
    readonly step: number
    readonly title: string
    /** The instructions in effect, in text order. */
    readonly instructions: readonly TimedInstruction[]
    /**
     * Instructions seen so far and not since typed over, wherever they now
     * are, so that one which comes back into effect keeps its moment.
     */
    readonly knownInstructions: readonly TimedInstruction[]
    readonly phraseUncertainties: readonly DescriptionUncertainty[]
    readonly manualEdits: Readonly<Partial<Record<AttemptField, ManualEdit>>>
    /**
     * The uncertain phrases accepted so far, by where each is in the text, so
     * that accepting one does not accept another with the same wording.
     */
    readonly acceptedPhrases: readonly AcceptedPhrase[]
    /** The accepted uncertainties that are not about a phrase. */
    readonly acceptedKeys: readonly string[]
    readonly capture: Capture | null
    /** The capture that ended with words still unconfirmed, until that is dealt with. */
    readonly incompleteCaptureStep: number | null
    /** The recognition language of the latest capture, once known. */
    readonly language: string | null
    readonly isClosed: boolean
}

export interface AttemptUncertainty {
    key: string
    /** The field whose displayed value is in question, if one is. */
    field: InstructionField | null
    message: string
}

export type CreateBlocker = "capturing" | "finishing" | "blank_title" | "unresolved"

/** What an attempt currently proposes, and whether it can be created. */
export interface AttemptView {
    fields: AttemptFields
    uncertainties: AttemptUncertainty[]
    captureState: CaptureState
    blockers: CreateBlocker[]
    canCreate: boolean
    /** The recognition language, when guided phrases will not be understood in it. */
    unsupportedLanguage: string | null
}

const DEFAULT_PRIORITY = 3
const FIRST_MOMENT: Moment = { step: 0, audio: 0 }

const compareMoments = (left: Moment, right: Moment): number =>
    left.step - right.step || left.audio - right.audio

const getLater = (left: Moment, right: Moment): Moment =>
    compareMoments(left, right) >= 0 ? left : right

/**
 * One moment for each character of a text. Characters are counted as text
 * offsets count them, so a character outside the basic plane takes two.
 */
const repeatMoment = (moment: Moment, text: string): Moment[] =>
    Array.from({ length: text.length }, () => moment)

const formatDay = (day: Date): string => format(day, "yyyy-MM-dd")

export const createDescriptionAttempt = (options: {
    id: string
    referenceDay: Date
    assignees: readonly DescriptionAssignee[]
    defaultUserId: string
}): DescriptionAttempt => ({
    id: options.id,
    referenceDay: formatDay(options.referenceDay),
    assignees: options.assignees,
    defaults: { dueDate: "", priority: DEFAULT_PRIORITY, userId: options.defaultUserId },
    text: "",
    moments: [],
    step: 0,
    title: "",
    instructions: [],
    knownInstructions: [],
    phraseUncertainties: [],
    manualEdits: {},
    acceptedPhrases: [],
    acceptedKeys: [],
    capture: null,
    incompleteCaptureStep: null,
    language: null,
    isClosed: false,
})

const isSamePhrase = (left: DescriptionInstruction, right: DescriptionInstruction): boolean =>
    left.field === right.field &&
    left.value === right.value &&
    left.start === right.start &&
    left.end === right.end

const hasSameWording = (left: AcceptedPhrase, right: AcceptedPhrase): boolean =>
    left.field === right.field && left.wording.toLowerCase() === right.wording.toLowerCase()

const isSameUncertainPhrase = (left: AcceptedPhrase, right: AcceptedPhrase): boolean =>
    hasSameWording(left, right) && left.start === right.start && left.end === right.end

const countWording = (uncertainties: readonly DescriptionUncertainty[], phrase: AcceptedPhrase): number =>
    uncertainties.filter((uncertainty) => hasSameWording(uncertainty, phrase)).length

/** Moves a remembered phrase to follow an edit, or drops it when the edit changes its words. */
const shiftPhrase = <Phrase extends { start: number; end: number }>(phrase: Phrase, edit: TextEdit): Phrase[] => {
    if (edit.start >= phrase.end) {
        return [phrase]
    }

    if (edit.end > phrase.start) {
        return []
    }

    const delta = edit.insert.length - (edit.end - edit.start)

    return [{ ...phrase, start: phrase.start + delta, end: phrase.end + delta }]
}

/**
 * Reads the description afresh after its text changes. An instruction takes
 * the latest moment of its characters. One that a typed edit creates or
 * changes takes that edit's moment instead, so that it counts as newly
 * supplied, while one the edit leaves alone keeps the moment it had.
 */
const applyText = (
    attempt: DescriptionAttempt,
    text: string,
    moments: readonly Moment[],
    typedMoment?: Moment,
): DescriptionAttempt => {
    const edit = findEdit(attempt.text, text)
    const known = attempt.knownInstructions.flatMap((instruction) => shiftPhrase(instruction, edit))
    const interpretation = interpretDescription(text, parseISO(attempt.referenceDay), attempt.assignees)
    const instructions = interpretation.instructions.map((instruction): TimedInstruction => {
        const counterpart = known.find((candidate) => isSamePhrase(candidate, instruction))
        const latestCharacter = moments.slice(instruction.start, instruction.end).reduce(getLater, FIRST_MOMENT)

        return {
            ...instruction,
            moment: counterpart
                ? getLater(counterpart.moment, latestCharacter)
                : typedMoment ?? latestCharacter,
        }
    })

    return {
        ...attempt,
        text,
        moments,
        title: interpretation.title,
        instructions,
        knownInstructions: [
            ...known.filter((candidate) => !instructions.some((instruction) => isSamePhrase(candidate, instruction))),
            ...instructions,
        ],
        phraseUncertainties: interpretation.uncertainties,
        // Accepting a phrase lasts only while that phrase is there, so the
        // same wording supplied again later is put to the user again. When
        // the number of phrases with its wording changes, which of them the
        // edit added or removed cannot be told from the text alone, so the
        // acceptance ends then too.
        acceptedPhrases: attempt.acceptedPhrases
            .filter((accepted) =>
                countWording(attempt.phraseUncertainties, accepted) ===
                countWording(interpretation.uncertainties, accepted))
            .flatMap((accepted) => shiftPhrase(accepted, edit))
            .filter((accepted) =>
                interpretation.uncertainties.some((uncertainty) => isSameUncertainPhrase(accepted, uncertainty))),
    }
}

const isCapturing = (attempt: DescriptionAttempt): boolean => attempt.capture !== null

/** Applies a change typed into the description. Refused while a capture is unsettled. */
export const typeDescription = (attempt: DescriptionAttempt, text: string): DescriptionAttempt => {
    if (attempt.isClosed || isCapturing(attempt) || text === attempt.text) {
        return attempt
    }

    const edit = findEdit(attempt.text, text)
    const moment: Moment = { step: attempt.step + 1, audio: 0 }
    const moments = [
        ...attempt.moments.slice(0, edit.start),
        ...repeatMoment(moment, edit.insert),
        ...attempt.moments.slice(edit.end),
    ]

    // Words left unconfirmed by a capture have now been looked at and corrected.
    return applyText({ ...attempt, step: moment.step, incompleteCaptureStep: null }, text, moments, moment)
}

/**
 * Records the user's own edit of a proposed field. `audioTime` is the
 * capture's audio time while one is starting or listening, so that speech
 * after the edit counts as later than it and speech before it as earlier.
 */
export const editField = (
    attempt: DescriptionAttempt,
    field: AttemptField,
    value: string | number,
    audioTime?: number,
): DescriptionAttempt => {
    if (attempt.isClosed) {
        return attempt
    }

    const capture = attempt.capture
    const isDuringSpeech = capture !== null && capture.state !== "finishing" && audioTime !== undefined
    const moment: Moment = isDuringSpeech
        ? { step: capture.step, audio: audioTime }
        : { step: attempt.step + 1, audio: 0 }
    const isInEffect = (known: TimedInstruction): boolean =>
        attempt.instructions.some((instruction) => isSamePhrase(known, instruction))

    return {
        ...attempt,
        step: Math.max(attempt.step, moment.step),
        manualEdits: { ...attempt.manualEdits, [field]: { value, moment } },
        // Editing a field settles what was in question about it.
        acceptedPhrases: [
            ...attempt.acceptedPhrases,
            ...attempt.phraseUncertainties.filter((uncertainty) => uncertainty.field === field),
        ],
        // An instruction for this field that is not in effect was not what
        // this edit replaced, so if it comes into effect later it is new.
        knownInstructions: attempt.knownInstructions.filter(
            (known) => known.field !== field || isInEffect(known),
        ),
    }
}

/** Accepts the displayed values despite one uncertainty, for as long as its wording stays. */
export const acceptUncertainty = (attempt: DescriptionAttempt, key: string): DescriptionAttempt =>
{
    const phrases = attempt.phraseUncertainties.filter((uncertainty) => uncertainty.key === key)

    if (attempt.isClosed) {
        return attempt
    }

    return phrases.length > 0
        ? { ...attempt, acceptedPhrases: [...attempt.acceptedPhrases, ...phrases] }
        : { ...attempt, acceptedKeys: [...attempt.acceptedKeys, key] }
}

/** The separator, "" or " ", that recognised text puts between two tokens. */
const getSeparator = (previous: TranscriptToken, token: TranscriptToken): string =>
    composeTokens([previous, token]).slice(previous.content.length, -token.content.length || undefined)

/** Adds a capture's recognised words, final then unconfirmed, to the end of its base text. */
const composeCaptureText = (capture: Capture): { text: string; moments: Moment[] } => {
    const tokens = [...capture.finalTokens, ...capture.partialTokens]
    let text = capture.baseText
    const moments = [...capture.baseMoments]

    tokens.forEach((token, index) => {
        const separator = index === 0
            ? (text && !/\s$/.test(text) ? " " : "")
            : getSeparator(tokens[index - 1], token)
        const piece = separator + token.content
        const moment: Moment = { step: capture.step, audio: token.startTime }

        text += piece
        moments.push(...repeatMoment(moment, piece))
    })

    return { text, moments }
}

const applyCapture = (attempt: DescriptionAttempt, capture: Capture): DescriptionAttempt => {
    const { text, moments } = composeCaptureText(capture)

    return applyText({ ...attempt, capture }, text, moments)
}

/**
 * Begins a capture, or returns null when one may not start: the attempt is
 * closed, or its previous capture has not settled.
 */
export const startCapture = (attempt: DescriptionAttempt): DescriptionAttempt | null => {
    if (attempt.isClosed || isCapturing(attempt)) {
        return null
    }

    const step = attempt.step + 1

    return {
        ...attempt,
        step,
        language: null,
        capture: {
            state: "starting",
            step,
            baseText: attempt.text,
            baseMoments: attempt.moments,
            finalTokens: [],
            partialTokens: [],
        },
    }
}

export const markCaptureListening = (attempt: DescriptionAttempt, language?: string): DescriptionAttempt =>
    attempt.isClosed || attempt.capture?.state !== "starting"
        ? attempt
        : { ...attempt, language: language ?? null, capture: { ...attempt.capture, state: "listening" } }

/** Applies recognised words. Final words are added; unconfirmed words replace the last such. */
export const receiveTranscript = (
    attempt: DescriptionAttempt,
    isFinal: boolean,
    tokens: readonly TranscriptToken[],
): DescriptionAttempt => {
    const capture = attempt.capture

    if (attempt.isClosed || !capture) {
        return attempt
    }

    return applyCapture(attempt, {
        ...capture,
        finalTokens: isFinal ? [...capture.finalTokens, ...tokens] : capture.finalTokens,
        partialTokens: isFinal ? [] : tokens,
    })
}

/** Recording has stopped. Recognised words may still arrive until the capture settles. */
export const stopCapture = (attempt: DescriptionAttempt): DescriptionAttempt =>
    attempt.isClosed || !attempt.capture
        ? attempt
        : { ...attempt, capture: { ...attempt.capture, state: "finishing" } }

/**
 * No more recognised words will arrive. Words still unconfirmed stay in the
 * description, and are flagged as possibly incomplete.
 */
export const settleCapture = (attempt: DescriptionAttempt): DescriptionAttempt => {
    const capture = attempt.capture

    if (attempt.isClosed || !capture) {
        return attempt
    }

    return {
        ...attempt,
        capture: null,
        incompleteCaptureStep: capture.partialTokens.length > 0 ? capture.step : attempt.incompleteCaptureStep,
    }
}

/** Ends the attempt. A closed attempt ignores everything that happens to it afterwards. */
export const closeAttempt = (attempt: DescriptionAttempt): DescriptionAttempt =>
    ({ ...attempt, capture: null, isClosed: true })

interface FieldResult {
    value: string | number
    /** The instruction that supplied the value, when one did. */
    instruction?: TimedInstruction
}

/**
 * The value of a field: its last instruction in the description, unless the
 * user edited the field after that instruction was supplied.
 */
const readField = (attempt: DescriptionAttempt, field: InstructionField): FieldResult => {
    const manual = attempt.manualEdits[field]
    const instruction = attempt.instructions.filter((candidate) => candidate.field === field).at(-1)

    if (instruction && (!manual || compareMoments(instruction.moment, manual.moment) >= 0)) {
        return { value: instruction.value, instruction }
    }

    return { value: manual ? manual.value : attempt.defaults[field] }
}

export const readFields = (attempt: DescriptionAttempt): AttemptFields => ({
    // A title the user has edited stays as they left it.
    title: String(attempt.manualEdits.title?.value ?? attempt.title),
    dueDate: String(readField(attempt, "dueDate").value),
    priority: Number(readField(attempt, "priority").value),
    userId: String(readField(attempt, "userId").value),
})

export const describeDueDate = (dueDate: string): string =>
    dueDate ? format(parseISO(dueDate), "EEE d MMM yyyy") : "No due date"

const describePhraseUncertainty = (uncertainty: DescriptionUncertainty): string => {
    const quoted = `"${uncertainty.wording}"`
    const inTitle = uncertainty.isInTitle ? " The words are still in the title." : ""

    if (uncertainty.reason === "date_does_not_exist") {
        return `${quoted} is not a date that exists.${inTitle}`
    }

    if (uncertainty.reason === "date_in_past") {
        return `${quoted} is in the past.${inTitle}`
    }

    switch (uncertainty.field) {
        case "dueDate":
            return `${quoted} was not understood as a due date.${inTitle}`
        case "priority":
            return `${quoted} was not understood. Priority is high, medium, low or 1 to 5.${inTitle}`
        case "userId":
            return `${quoted} does not name an existing assignee.${inTitle}`
    }
}

/** Everything in question about the attempt, whether or not it has been accepted. */
const listUncertainties = (attempt: DescriptionAttempt, today?: Date): AttemptUncertainty[] => {
    const uncertainties: AttemptUncertainty[] = attempt.phraseUncertainties
        .filter((uncertainty) =>
            !attempt.acceptedPhrases.some((accepted) => isSameUncertainPhrase(accepted, uncertainty)))
        .map((uncertainty) => ({
        key: uncertainty.key,
        field: uncertainty.field,
        message: describePhraseUncertainty(uncertainty),
    }))
    const dueDate = readField(attempt, "dueDate")

    // A date worked out from the day the attempt began does not move when
    // the day changes, so it is put to the user instead.
    if (today && dueDate.instruction?.isRelative && formatDay(today) !== attempt.referenceDay) {
        uncertainties.push({
            key: `day_changed:${formatDay(today)}:${dueDate.instruction.wording.toLowerCase()}`,
            field: "dueDate",
            message:
                `The day has changed since this description was started. "${dueDate.instruction.wording}" ` +
                `was read as ${describeDueDate(String(dueDate.value))}.`,
        })
    }

    if (attempt.incompleteCaptureStep !== null) {
        uncertainties.push({
            key: `incomplete:${attempt.incompleteCaptureStep}`,
            field: null,
            message: "The last words may be incomplete, because recognition stopped before confirming them.",
        })
    }

    return uncertainties
}

const isEnglish = (language: string): boolean => /^en(?:[-_]|$)/i.test(language)

/** Works out what the attempt proposes and whether it can be created, as of `today`. */
export const viewAttempt = (attempt: DescriptionAttempt, today: Date): AttemptView => {
    const fields = readFields(attempt)
    const uncertainties = listUncertainties(attempt, today)
        .filter((uncertainty) => !attempt.acceptedKeys.includes(uncertainty.key))
    const captureState = attempt.capture?.state ?? "none"
    const blockers: CreateBlocker[] = [
        ...(captureState === "starting" || captureState === "listening" ? ["capturing" as const] : []),
        ...(captureState === "finishing" ? ["finishing" as const] : []),
        ...(fields.title.trim() ? [] : ["blank_title" as const]),
        ...(uncertainties.length > 0 ? ["unresolved" as const] : []),
    ]

    return {
        fields,
        uncertainties,
        captureState,
        blockers,
        canCreate: !attempt.isClosed && blockers.length === 0,
        unsupportedLanguage: attempt.language && !isEnglish(attempt.language) ? attempt.language : null,
    }
}

/**
 * Closes an attempt that is ready and returns the fields of the task to
 * create, or returns null and leaves the attempt as it is. An attempt can
 * therefore be created once only.
 */
export const createFromAttempt = (
    attempt: DescriptionAttempt,
    today: Date,
): { attempt: DescriptionAttempt; fields: AttemptFields } | null => {
    const view = viewAttempt(attempt, today)

    return view.canCreate
        ? { attempt: closeAttempt(attempt), fields: { ...view.fields, title: view.fields.title.trim() } }
        : null
}
