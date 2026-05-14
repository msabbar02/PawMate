/**
 * Punto de entrada del panel de administración.
 *
 * Monta el árbol React envuelto en `ErrorBoundary`, el `ThemeProvider`,
 * el `BrowserRouter` y el `AuthProvider`. Inicializa i18n importando
 * `./i18n/i18n` por su efecto colateral.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './App.css';
import './i18n/i18n';

/**
 * Captura cualquier error de renderizado en el subárbol y muestra un
 * mensaje legible para evitar la pantalla blanca de React.
 */
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() { if (this.state.hasError) return <div style={{padding: 20, color: 'red'}}><h1>Error:</h1><pre>{this.state.error?.toString()}</pre></div>; return this.props.children; }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
