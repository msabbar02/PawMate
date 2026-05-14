/**
 * Punto de entrada de la web pública de PawMate (landing).
 *
 * Importa la configuración de i18n para que se inicialice antes del
 * primer render y monta el componente raíz `App` envuelto en `StrictMode`.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n/i18n';
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
