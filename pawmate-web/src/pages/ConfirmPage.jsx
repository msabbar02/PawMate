import { useState, useEffect } from 'react';
import { CheckCircle2, ArrowRight, Smartphone } from 'lucide-react';
import '../App.css';

export default function ConfirmPage() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pawmate-theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className="confirm-page">
      <div className="confirm-card">
        <div className="confirm-icon-wrap">
          <CheckCircle2 size={64} className="confirm-check-icon" />
        </div>

        <div className="confirm-paw">🐾</div>

        <h1 className="confirm-title">¡Cuenta Confirmada!</h1>
        <p className="confirm-desc">
          Tu correo electrónico ha sido verificado correctamente.
          Tu cuenta de <strong>PawMate</strong> ya está lista para usar.
        </p>

        <div className="confirm-steps">
          <div className="confirm-step">
            <div className="confirm-step-num">1</div>
            <span>Abre la app de <strong>PawMate</strong> en tu móvil</span>
          </div>
          <div className="confirm-step">
            <div className="confirm-step-num">2</div>
            <span>Inicia sesión con tu correo y contraseña</span>
          </div>
          <div className="confirm-step">
            <div className="confirm-step-num">3</div>
            <span>¡Empieza a cuidar de tus mascotas!</span>
          </div>
        </div>

        <a href="/" className="confirm-home-btn">
          <ArrowRight size={18} />
          Ir a la página principal
        </a>

        <p className="confirm-footer-text">
          <Smartphone size={14} />
          Ya puedes cerrar esta ventana e ir a la app
        </p>
      </div>
    </div>
  );
}
