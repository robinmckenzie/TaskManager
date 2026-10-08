import { describe, expect, it, vi } from "vitest"
import { createBrowserAudioSource } from "./speechmaticsAdapters"
import type { AudioRecorder } from "./speechmaticsAdapters"

/** A promise that the test settles when it chooses. */
const createDeferred = <T,>() => {
    let resolve!: (value: T) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise
        reject = rejectPromise
    })

    return { promise, resolve, reject }
}

/** An audio source whose SDK loading and microphone start the test controls. */
const setUp = () => {
    const loading = createDeferred<void>()
    const microphone = createDeferred<void>()
    let isRecording = false
    let audioListener: (data: Float32Array) => void = () => undefined
    const recorder = {
        get isRecording() {
            return isRecording
        },
        onAudio: vi.fn((listener: (data: Float32Array) => void) => {
            audioListener = listener
        }),
        // The microphone is live from the moment the request is granted.
        startRecording: vi.fn(async () => {
            await microphone.promise
            isRecording = true
        }),
        stopRecording: vi.fn(() => {
            isRecording = false
        }),
    } satisfies AudioRecorder
    const audioContext = { sampleRate: 16_000, close: vi.fn(async () => undefined) }
    const createAudioContext = vi.fn(() => audioContext as unknown as AudioContext)
    const createRecorder = vi.fn(async () => {
        await loading.promise
        return recorder
    })
    const onAudio = vi.fn()
    const source = createBrowserAudioSource({ createRecorder, createAudioContext })

    return {
        source,
        recorder,
        audioContext,
        createAudioContext,
        onAudio,
        finishLoading: () => loading.resolve(),
        grantMicrophone: () => microphone.resolve(),
        denyMicrophone: () => microphone.reject(Object.assign(new Error("denied"), { name: "NotAllowedError" })),
        hearAudio: () => audioListener(new Float32Array(160)),
        isRecording: () => isRecording,
    }
}

/** Lets pending promise callbacks run. */
const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("createBrowserAudioSource", () => {
    it("starts recording, delivers audio, and releases everything when stopped", async () => {
        const { source, recorder, audioContext, onAudio, finishLoading, grantMicrophone, hearAudio, isRecording } = setUp()

        const starting = source.start(onAudio)
        finishLoading()
        grantMicrophone()

        await expect(starting).resolves.toEqual({ sampleRate: 16_000 })
        hearAudio()
        expect(onAudio).toHaveBeenCalledTimes(1)

        source.stop()

        expect(isRecording()).toBe(false)
        expect(recorder.stopRecording).toHaveBeenCalledTimes(1)
        expect(audioContext.close).toHaveBeenCalledTimes(1)
    })

    it("creates nothing and does not request the microphone when stopped while the SDK loads", async () => {
        const { source, recorder, createAudioContext, onAudio, finishLoading } = setUp()

        const starting = source.start(onAudio)
        source.stop()
        finishLoading()

        await expect(starting).rejects.toThrow("stopped while it was starting")
        expect(createAudioContext).not.toHaveBeenCalled()
        expect(recorder.startRecording).not.toHaveBeenCalled()
        expect(recorder.onAudio).not.toHaveBeenCalled()
    })

    it("releases the audio context at once when stopped while the recorder is still starting", async () => {
        const { source, recorder, audioContext, onAudio, finishLoading } = setUp()

        const starting = source.start(onAudio)
        starting.catch(() => undefined)
        finishLoading()
        await settle()
        expect(recorder.startRecording).toHaveBeenCalledTimes(1)

        source.stop()

        // The recorder never finishes starting, yet nothing is left held.
        expect(audioContext.close).toHaveBeenCalledTimes(1)
        expect(recorder.stopRecording).not.toHaveBeenCalled()
    })

    it("stops the microphone as soon as a permission granted after stopping takes effect", async () => {
        const { source, recorder, audioContext, onAudio, finishLoading, grantMicrophone, hearAudio, isRecording } = setUp()

        const starting = source.start(onAudio)
        finishLoading()
        await settle()

        // The permission prompt is still showing.
        source.stop()
        expect(isRecording()).toBe(false)

        grantMicrophone()

        await expect(starting).rejects.toThrow("stopped while it was starting")
        expect(isRecording()).toBe(false)
        expect(recorder.stopRecording).toHaveBeenCalledTimes(1)
        expect(audioContext.close).toHaveBeenCalledTimes(1)

        hearAudio()
        expect(onAudio).not.toHaveBeenCalled()
    })

    it("releases the audio context when the microphone is refused, before or after stopping", async () => {
        for (const stopFirst of [false, true]) {
            const { source, recorder, audioContext, onAudio, finishLoading, denyMicrophone } = setUp()

            const starting = source.start(onAudio)
            finishLoading()
            await settle()

            if (stopFirst) {
                source.stop()
            }

            denyMicrophone()

            await expect(starting).rejects.toMatchObject({ name: "NotAllowedError" })
            expect(audioContext.close).toHaveBeenCalledTimes(1)
            expect(recorder.stopRecording).not.toHaveBeenCalled()
        }
    })

    it("can be stopped repeatedly, and before it was ever started", async () => {
        const unused = setUp()
        expect(() => {
            unused.source.stop()
            unused.source.stop()
        }).not.toThrow()

        const { source, recorder, audioContext, onAudio, finishLoading, grantMicrophone } = setUp()
        const starting = source.start(onAudio)
        finishLoading()
        grantMicrophone()
        await starting

        source.stop()
        source.stop()
        source.stop()

        expect(recorder.stopRecording).toHaveBeenCalledTimes(1)
        expect(audioContext.close).toHaveBeenCalledTimes(1)
    })
})
