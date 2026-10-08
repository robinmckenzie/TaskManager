import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { dictationEndpoints } from './server/dictationEndpoints.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dictationEndpoints()],
})
