import { createHash } from "node:crypto"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import type { Duplex } from "node:stream"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { RealtimeMessage } from "./dictationSession"
import { createRealtimeConnection } from "./speechmaticsAdapters"

/*
 * These tests run the real Speechmatics client against a local WebSocket
 * server. They guard the adapter's close(), which relies on a private field of
 * the client, against changes in the installed client.
 */

const WEBSOCKET_ACCEPT_SUFFIX = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

interface Peer {
    /** Completes the WebSocket handshake. */
    accept(): void
    send(message: object): void
}

interface ServerOptions {
    holdHandshake?: boolean
    onMessage?(message: { message: string }, peer: Peer): void
}

const servers: { stop(): void }[] = []

/** Starts a minimal WebSocket server that records what the client does. */
const startSpeechServer = async ({ holdHandshake = false, onMessage }: ServerOptions = {}) => {
    const received: string[] = []
    const peers: Peer[] = []
    const sockets: Duplex[] = []
    let closedSockets = 0
    const server = createServer()

    server.on("upgrade", (request, socket) => {
        const peer: Peer = {
            accept: () => {
                const accept = createHash("sha1")
                    .update(request.headers["sec-websocket-key"] + WEBSOCKET_ACCEPT_SUFFIX)
                    .digest("base64")
                socket.write(
                    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n" +
                    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
                )
            },
            send: (message) => {
                const payload = Buffer.from(JSON.stringify(message))

                if (!socket.destroyed) {
                    socket.write(Buffer.concat([Buffer.from([0x81, payload.length]), payload]))
                }
            },
        }
        let buffered = Buffer.alloc(0)

        peers.push(peer)
        sockets.push(socket)
        socket.on("error", () => undefined)
        socket.on("close", () => {
            closedSockets += 1
        })
        // Reads client frames, which are always masked and here always short.
        socket.on("data", (chunk: Buffer) => {
            buffered = Buffer.concat([buffered, chunk])

            while (buffered.length >= 2) {
                const opcode = buffered[0] & 0x0f
                const shortLength = buffered[1] & 0x7f
                const headerLength = shortLength === 126 ? 4 : 2
                const length = shortLength === 126 ? buffered.readUInt16BE(2) : shortLength
                const frameLength = headerLength + 4 + length

                if (buffered.length < frameLength) {
                    return
                }

                const mask = buffered.subarray(headerLength, headerLength + 4)
                const payload = buffered
                    .subarray(headerLength + 4, frameLength)
                    .map((byte, index) => byte ^ mask[index % 4])
                buffered = buffered.subarray(frameLength)

                if (opcode === 1) {
                    const message = JSON.parse(Buffer.from(payload).toString()) as { message: string }
                    received.push(message.message)
                    onMessage?.(message, peer)
                } else if (opcode === 8) {
                    socket.end(Buffer.from([0x88, 0]))
                }
            }
        })

        if (!holdHandshake) {
            peer.accept()
        }
    })

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    servers.push({
        stop: () => {
            sockets.forEach((socket) => socket.destroy())
            server.close()
        },
    })

    return {
        url: `ws://127.0.0.1:${(server.address() as AddressInfo).port}/v2`,
        received,
        peers,
        getClosedSockets: () => closedSockets,
    }
}

const recognitionConfig = { transcription_config: { language: "en" } }

const connect = async (url: string) => {
    const connection = await createRealtimeConnection(url)
    const messages: string[] = []
    const onClosed = vi.fn()

    connection.onMessage((message: RealtimeMessage) => messages.push(message.message))
    connection.onClosed(onClosed)

    return { connection, messages, onClosed }
}

describe("createRealtimeConnection", () => {
    afterEach(() => {
        servers.splice(0).forEach((server) => server.stop())
    })

    it("stops a connection that is closed while still connecting", async () => {
        const server = await startSpeechServer({ holdHandshake: true })
        const { connection } = await connect(server.url)

        const starting = connection.start("jwt", recognitionConfig)
        await vi.waitFor(() => expect(server.peers).toHaveLength(1))
        connection.close()

        await expect(starting).rejects.toBeDefined()

        // The server completing the handshake late must not revive it.
        server.peers[0].accept()
        await vi.waitFor(() => expect(server.getClosedSockets()).toBe(1))
        expect(server.received).toEqual([])
        expect(server.peers).toHaveLength(1)
    })

    it("closes a connection that is waiting for recognition to start", async () => {
        const server = await startSpeechServer()
        const { connection, onClosed } = await connect(server.url)
        const started = vi.fn()

        connection.start("jwt", recognitionConfig).then(started, () => undefined)
        await vi.waitFor(() => expect(server.received).toEqual(["StartRecognition"]))
        connection.close()

        await vi.waitFor(() => expect(server.getClosedSockets()).toBe(1))
        await vi.waitFor(() => expect(onClosed).toHaveBeenCalled())

        // A late answer from the server must not start the session.
        server.peers[0].send({ message: "RecognitionStarted" })
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(started).not.toHaveBeenCalled()
        expect(server.peers).toHaveLength(1)
    })

    it("delivers results sent after a stop request, then closes", async () => {
        const server = await startSpeechServer({
            onMessage: (message, peer) => {
                if (message.message === "StartRecognition") {
                    peer.send({ message: "RecognitionStarted" })
                } else if (message.message === "EndOfStream") {
                    setTimeout(() => {
                        peer.send({ message: "AddTranscript", results: [] })
                        peer.send({ message: "EndOfTranscript" })
                    }, 50)
                }
            },
        })
        const { connection, messages } = await connect(server.url)

        await connection.start("jwt", recognitionConfig)
        await connection.stopRecognition()

        // The stop request resolves before the final results arrive.
        expect(messages).toEqual(["RecognitionStarted"])

        await vi.waitFor(() =>
            expect(messages).toEqual(["RecognitionStarted", "AddTranscript", "EndOfTranscript"]))
        await vi.waitFor(() => expect(server.getClosedSockets()).toBe(1))

        // Closing again after the client has closed is harmless.
        expect(() => connection.close()).not.toThrow()
    })

    it("closes an open connection when Speechmatics never finishes", async () => {
        const server = await startSpeechServer({
            onMessage: (message, peer) => {
                if (message.message === "StartRecognition") {
                    peer.send({ message: "RecognitionStarted" })
                }
            },
        })
        const { connection } = await connect(server.url)

        await connection.start("jwt", recognitionConfig)
        await connection.stopRecognition()
        expect(server.getClosedSockets()).toBe(0)

        connection.close()

        await vi.waitFor(() => expect(server.getClosedSockets()).toBe(1))
    })

    it("can be closed before it has started", async () => {
        const { connection } = await connect("ws://127.0.0.1:9/v2")

        expect(() => connection.close()).not.toThrow()
    })
})
