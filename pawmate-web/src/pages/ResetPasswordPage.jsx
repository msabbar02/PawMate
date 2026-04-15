import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, Smartphone } from 'lucide-react';
import { supabase } from '../config/supabase';
import '../App.css';

export default function ResetPasswordPage() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pawmate-theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState(false);

  // Supabase sends the user here with a token in the URL hash
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Check if we already have a session (token in URL)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    // Timeout: if no session after 5s, show error
    const timeout = setTimeout(() => {
      setSessionReady(prev => {
        if (!prev) setSessionError(true);
        return prev;
      });
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const validate = () => {
    if (!password) return 'Introduce tu nueva contraseña.';
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(password)) return 'Incluye al menos una mayúscula.';
    if (!/[0-9]/.test(password)) return 'Incluye al menos un número.';
    if (password !== confirmPassword) return 'Las contraseñas no coinciden.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        if (updateError.message?.toLowerCase().includes('same') || updateError.message?.toLowerCase().includes('should be different')) {
          setError('La nueva contraseña no puede ser igual a la anterior. Elige una diferente.');
        } else {
          setError(updateError.message || 'Error al actualizar la contraseña.');
        }
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError('Ocurrió un error inesperado. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className="confirm-page">
        <div className="confirm-card">
          <div className="confirm-icon-wrap">
            <CheckCircle2 size={64} className="confirm-check-icon" />
          </div>
          <div className="confirm-paw">🔐</div>
          <h1 className="confirm-title">¡Contraseña Actualizada!</h1>
          <p className="confirm-desc">
            Tu contraseña ha sido cambiada con éxito.
            Ya puedes iniciar sesión en la app con tu nueva contraseña.
          </p>
          <div className="confirm-steps">
            <div className="confirm-step">
              <div className="confirm-step-num">1</div>
              <span>Abre la app de <strong>PawMate</strong></span>
            </div>
            <div className="confirm-step">
              <div className="confirm-step-num">2</div>
              <span>Inicia sesión con tu nueva contraseña</span>
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

  // Session error
  if (sessionError && !sessionReady) {
    return (
      <div className="confirm-page">
        <div className="confirm-card">
          <div className="confirm-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
            <AlertCircle size={64} style={{ color: '#EF4444' }} />
          </div>
          <h1 className="confirm-title">Enlace inválido o expirado</h1>
          <p className="confirm-desc">
            El enlace para restablecer tu contraseña ha expirado o ya fue utilizado.
            Por favor, solicita uno nuevo desde la app.
          </p>
          <a href="/" className="confirm-home-btn">
            <ArrowRight size={18} />
            Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  // Loading session
  if (!sessionReady) {
    return (
      <div className="confirm-page">
        <div className="confirm-card">
          <div className="reset-loading-spinner" />
          <p className="confirm-desc" style={{ marginTop: 20 }}>Verificando enlace...</p>
        </div>
      </div>
    );
  }

  // Reset form
  return (
    <div className="confirm-page">
      <div className="confirm-card">
        <div className="confirm-icon-wrap" style={{ background: 'rgba(245, 166, 35, 0.1)' }}>
          <Lock size={48} style={{ color: '#F5A623' }} />
        </div>
        <div className="confirm-paw">🐾</div>
        <h1 className="confirm-title">Nueva Contraseña</h1>
        <p className="confirm-desc">
          Introduce tu nueva contraseña para tu cuenta de PawMate.
        </p>

        <form className="reset-form" onSubmit={handleSubmit}>
          <div className="reset-input-group">
            <label className="reset-label">Nueva contraseña</label>
            <div className="reset-input-wrap">
              <Lock size={18} className="reset-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="reset-input"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="reset-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="reset-input-group">
            <label className="reset-label">Confirmar contraseña</label>
            <div className="reset-input-wrap">
              <Lock size={18} className="reset-input-icon" />
              <input
                type={showConfirm ? 'text' : 'password'}
                className="reset-input"
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="reset-eye-btn"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Password requirements */}
          <div className="reset-requirements">
            <div className={`reset-req ${password.length >= 8 ? 'met' : ''}`}>
              <CheckCircle2 size={14} /> Mínimo 8 caracteres
            </div>
            <div className={`reset-req ${/[A-Z]/.test(password) ? 'met' : ''}`}>
              <CheckCircle2 size={14} /> Una mayúscula
            </div>
            <div className={`reset-req ${/[0-9]/.test(password) ? 'met' : ''}`}>
              <CheckCircle2 size={14} /> Un número
            </div>
            <div className={`reset-req ${password && password === confirmPassword ? 'met' : ''}`}>
              <CheckCircle2 size={14} /> Contraseñas coinciden
            </div>
          </div>

          {error && (
            <div className="reset-error">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="reset-submit-btn"
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
