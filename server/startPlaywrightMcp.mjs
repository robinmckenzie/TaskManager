/**
 * Starts the Playwright MCP server for `.mcp.json`, which passes the package
 * and its options as arguments. It refuses to start the server when an
 * inherited Playwright variable could change how the browser starts (see
 * `playwrightMcpEnvironment.mjs`), so the check happens in the process that
 * the server inherits its environment from.
 */

import { spawn } from "node:child_process"
import { assertNoPlaywrightVariables, buildNpxCommandLine } from "./playwrightMcpEnvironment.mjs"

/**
 * Reports why the server was not started. An MCP client reads protocol
 * messages from standard output, so the reason goes to standard error.
 *
 * @param {unknown} error
 * @returns {never}
 */
const refuseToStart = (error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
}

/** @type {string} */
let commandLine

try {
    assertNoPlaywrightVariables(process.env)
    commandLine = buildNpxCommandLine(process.argv.slice(2))
} catch (error) {
    refuseToStart(error)
}

// The server talks to the MCP client over this process's own input and output.
const server = spawn(commandLine, { shell: true, stdio: "inherit" })

server.on("error", refuseToStart)
server.on("exit", (code) => process.exit(code ?? 1))
