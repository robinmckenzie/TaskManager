import type { IncomingMessage, ServerResponse } from "node:http"
import { loadEnv } from "vite"
import type { Connect, Plugin } from "vite"
import { AUTH_BASE_PATH } from "../shared/accountApi.ts"
import { createAccountFetchHandlerFromEnvironment } from "./accountFunction.ts"

/** The variables sign-in reads locally. DATABASE_URL is never loaded. */
export const LOCAL_ACCOUNT_VARIABLE_PREFIXES = [
    "BETTER_AUTH_",
    "GOOGLE_CLIENT_",
    "AUTH_DATABASE_URL",
] as const

const isAccountPath = (pathname: string): boolean =>
    pathname.startsWith("/api/account/") || pathname.startsWith(`${AUTH_BASE_PATH}/`)

const readBody = async (request: IncomingMessage): Promise<Buffer | undefined> => {
    if (request.method === "GET" || request.method === "HEAD") {
        return undefined
    }

    const chunks: Buffer[] = []

    for await (const chunk of request) {
        chunks.push(chunk as Buffer)
    }

    return Buffer.concat(chunks)
}

/** Turns a Node request from the Vite server into a web-standard request. */
export const toWebRequest = async (request: IncomingMessage): Promise<Request> => {
    const headers = new Headers()

    for (const [name, value] of Object.entries(request.headers)) {
        for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
            headers.append(name, item)
        }
    }

    const body = await readBody(request)

    return new Request(new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`), {
        method: request.method,
        headers,
        body: body && body.length > 0 ? new Uint8Array(body) : undefined,
    })
}

/** Writes a web-standard response to a Node response, keeping every cookie. */
export const sendWebResponse = async (webResponse: Response, response: ServerResponse): Promise<void> => {
    response.statusCode = webResponse.status

    webResponse.headers.forEach((value, name) => {
        if (name !== "set-cookie") {
            response.setHeader(name, value)
        }
    })

    const cookies = webResponse.headers.getSetCookie()

    if (cookies.length > 0) {
        response.setHeader("Set-Cookie", cookies)
    }

    response.end(Buffer.from(await webResponse.arrayBuffer()))
}

const createAccountMiddleware = (
    getHandler: () => (request: Request) => Promise<Response>,
): Connect.NextHandleFunction => (request, response, next) => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname

    if (!isAccountPath(pathname)) {
        next()
        return
    }

    toWebRequest(request)
        .then((webRequest) => getHandler()(webRequest))
        .then((webResponse) => sendWebResponse(webResponse, response))
        .catch(next)
}

/**
 * Adds sign-in and the profile endpoint to `npm run dev` and `npm run
 * preview`. Locally sign-in always counts as local development, whatever
 * VERCEL_ENV says, so it can only use AUTH_DATABASE_URL.
 */
export const accountEndpoints = (): Plugin => {
    let handler: ((request: Request) => Promise<Response>) | undefined
    const middleware = createAccountMiddleware(() => {
        if (!handler) {
            throw new Error("Sign-in settings have not been loaded.")
        }

        return handler
    })

    return {
        name: "taskmanager-account-endpoints",
        configResolved(resolvedConfig) {
            handler = createAccountFetchHandlerFromEnvironment(
                loadEnv(resolvedConfig.mode, resolvedConfig.envDir, [...LOCAL_ACCOUNT_VARIABLE_PREFIXES]),
            )
        },
        configureServer(server) {
            server.middlewares.use(middleware)
        },
        configurePreviewServer(server) {
            server.middlewares.use(middleware)
        },
    }
}
