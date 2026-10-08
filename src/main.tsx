import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { rememberActivityUserFromAddress } from './dictation/dictationActivity.ts'

rememberActivityUserFromAddress(window.location.search, localStorage)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
