import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { setupCrossTabLogout } from './lib/auth/crossTabLogout'
import './styles/globals.css'
import 'maplibre-gl/dist/maplibre-gl.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found in index.html')

// Cuando una pestaña hace logout o el refresh expira, las demás se enteran por storage.
setupCrossTabLogout()

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
