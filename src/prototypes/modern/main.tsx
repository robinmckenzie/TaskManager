import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ModernApp } from "./ModernApp"
import "./modern.css"

// The prototype's own entry point. It loads none of the app's styles, no
// analytics, and nothing that reaches the dictation or sign-in endpoints.
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ModernApp />
    </StrictMode>,
)
