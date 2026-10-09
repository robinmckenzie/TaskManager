import { EventEmitter } from "node:events"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const spawn = vi.hoisted(() => vi.fn())

vi.mock("node:child_process", () => ({ spawn }))

/** Stands in for the process ending, so nothing after `process.exit` runs, as in the real launcher. */
class ProcessExit extends Error {}

const PLAIN_ARGUMENTS = ["-y", "@playwright/mcp@0.0.83", "--isolated", "--allowed-origins", "http://127.0.0.1:5183"]

const originalArgv = process.argv
const originalEnv = process.env

/** @returns whatever the launcher wrote with `console.error`, which goes to standard error. */
const readStandardError = () =>
    vi
        .mocked(console.error)
        .mock.calls.map((call) => call.join(" "))
        .join("\n")

/**
 * Runs the launcher script as `.mcp.json` would, with the given arguments and
 * environment, until it has started the server or exited.
 */
const runLauncher = async (launcherArguments: string[], env: Record<string, string>) => {
    process.argv = ["node", "server/startPlaywrightMcp.mjs", ...launcherArguments]
    process.env = env

    try {
        await import("./startPlaywrightMcp.mjs")
    } catch (error) {
        if (!(error instanceof ProcessExit)) {
            throw error
        }
    }
}

/** Runs the launcher so that it starts a server, and returns the stand-in for that server's process. */
const startServer = async () => {
    const server = new EventEmitter()
    spawn.mockReturnValue(server)

    await runLauncher(PLAIN_ARGUMENTS, { PATH: "/usr/bin" })

    return server
}

beforeEach(() => {
    vi.resetModules()
    spawn.mockReset()
    vi.spyOn(process, "exit").mockImplementation(() => {
        throw new ProcessExit()
    })
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "log").mockImplementation(() => {})
})

afterEach(() => {
    process.argv = originalArgv
    process.env = originalEnv
    vi.restoreAllMocks()
})

describe("startPlaywrightMcp", () => {
    it("starts npx through a shell with the arguments it was given, sharing its input and output", async () => {
        await startServer()

        expect(spawn).toHaveBeenCalledTimes(1)
        expect(spawn).toHaveBeenCalledWith(
            "npx -y @playwright/mcp@0.0.83 --isolated --allowed-origins http://127.0.0.1:5183",
            { shell: true, stdio: "inherit" },
        )
        expect(process.exit).not.toHaveBeenCalled()
        expect(console.error).not.toHaveBeenCalled()
    })

    it("does not start the server when a Playwright variable is inherited", async () => {
        await runLauncher(PLAIN_ARGUMENTS, {
            PATH: "/usr/bin",
            PLAYWRIGHT_MCP_STORAGE_STATE: "synthetic-state-path",
            PLAYWRIGHT_MCP_CDP_ENDPOINT: "synthetic-endpoint",
        })

        expect(spawn).not.toHaveBeenCalled()
        expect(process.exit).toHaveBeenCalledTimes(1)
        expect(process.exit).toHaveBeenCalledWith(1)
    })

    it("reports the refusal on standard error, naming the variables without their values", async () => {
        await runLauncher(PLAIN_ARGUMENTS, {
            PATH: "/usr/bin",
            PLAYWRIGHT_MCP_STORAGE_STATE: "synthetic-state-path",
            PLAYWRIGHT_MCP_CDP_ENDPOINT: "synthetic-endpoint",
        })

        const standardError = readStandardError()

        expect(standardError).toContain("PLAYWRIGHT_MCP_CDP_ENDPOINT, PLAYWRIGHT_MCP_STORAGE_STATE")
        expect(standardError).not.toMatch(/synthetic-state-path|synthetic-endpoint/)
        // Standard output carries the MCP protocol, so nothing else may be written to it.
        expect(console.log).not.toHaveBeenCalled()
    })

    it.each([
        ["an argument a shell could read as more than text", [...PLAIN_ARGUMENTS, "a&b"], /not plain text/],
        ["no arguments", [], /no package/],
    ])("does not start the server when given %s", async (_description, launcherArguments, reason) => {
        await runLauncher(launcherArguments, { PATH: "/usr/bin" })

        expect(spawn).not.toHaveBeenCalled()
        expect(process.exit).toHaveBeenCalledTimes(1)
        expect(process.exit).toHaveBeenCalledWith(1)
        expect(readStandardError()).toMatch(reason)
        expect(console.log).not.toHaveBeenCalled()
    })

    it("reports a server that could not be started on standard error and exits with status 1", async () => {
        const server = await startServer()

        expect(() => server.emit("error", new Error("spawn npx ENOENT"))).toThrow(ProcessExit)

        expect(readStandardError()).toBe("spawn npx ENOENT")
        expect(process.exit).toHaveBeenCalledTimes(1)
        expect(process.exit).toHaveBeenCalledWith(1)
        expect(console.log).not.toHaveBeenCalled()
    })

    it.each([0, 1, 3])("exits with the server's own status %i", async (status) => {
        const server = await startServer()

        expect(() => server.emit("exit", status, null)).toThrow(ProcessExit)

        expect(process.exit).toHaveBeenCalledTimes(1)
        expect(process.exit).toHaveBeenCalledWith(status)
    })

    it("exits with status 1 when the server ended without a status, as when a signal stops it", async () => {
        const server = await startServer()

        expect(() => server.emit("exit", null, "SIGTERM")).toThrow(ProcessExit)

        expect(process.exit).toHaveBeenCalledTimes(1)
        expect(process.exit).toHaveBeenCalledWith(1)
    })
})
