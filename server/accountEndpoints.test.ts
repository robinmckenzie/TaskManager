import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { afterEach, describe, expect, it } from "vitest"
import { sendWebResponse, toWebRequest } from "./accountEndpoints.ts"

let close: (() => void) | undefined

afterEach(() => close?.())

/** Starts a Node server that passes each request through the bridge to `handle`. */
const serve = async (handle: (request: Request) => Promise<Response>): Promise<string> => {
    const server = createServer((request, response) => {
        void toWebRequest(request)
            .then(handle)
            .then((webResponse) => sendWebResponse(webResponse, response))
    })

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    close = () => server.close()

    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

describe("the development server bridge", () => {
    it("passes the method, address, headers and body through", async () => {
        let received: { method: string; url: string; cookie: string | null; body: string } | undefined
        const origin = await serve(async (request) => {
            received = {
                method: request.method,
                url: request.url,
                cookie: request.headers.get("cookie"),
                body: await request.text(),
            }
            return new Response("ok")
        })

        await fetch(`${origin}/api/account/profile?x=1`, {
            method: "PUT",
            headers: { cookie: "session=abc", "Content-Type": "application/json" },
            body: JSON.stringify({ preferredName: "Ada" }),
        })

        expect(received).toEqual({
            method: "PUT",
            url: `${origin}/api/account/profile?x=1`,
            cookie: "session=abc",
            body: JSON.stringify({ preferredName: "Ada" }),
        })
    })

    it("keeps every cookie, the status and a redirect", async () => {
        const origin = await serve(async () => {
            const headers = new Headers({ Location: "https://accounts.google.com/" })
            headers.append("Set-Cookie", "first=1; Path=/")
            headers.append("Set-Cookie", "second=2; Path=/")
            return new Response(null, { status: 302, headers })
        })

        const response = await fetch(`${origin}/api/auth/sign-in/social`, { redirect: "manual" })

        expect(response.status).toBe(302)
        expect(response.headers.get("location")).toBe("https://accounts.google.com/")
        expect(response.headers.getSetCookie()).toEqual(["first=1; Path=/", "second=2; Path=/"])
    })
})
