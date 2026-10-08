import { handleHostedDictationRequest } from "../../server/dictationFunction.ts"

// Vercel serves this file at its path under /api. The handler routes by path.
export default { fetch: handleHostedDictationRequest }
