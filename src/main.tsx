import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import './index.css'
import App from './App.tsx'
import { rememberDevModeFromAddress } from './dictation/dictationActivity.ts'

rememberDevModeFromAddress(window.location.search, localStorage)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>,
)
