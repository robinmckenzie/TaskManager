import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { accountEndpoints } from './server/accountEndpoints.ts'
import { dictationEndpoints } from './server/dictationEndpoints.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dictationEndpoints(), accountEndpoints()],
  // The stylesheet test reads src/index.css; Vitest leaves CSS empty unless told.
  test: { css: { include: [/src\/index\.css/] } },
})
