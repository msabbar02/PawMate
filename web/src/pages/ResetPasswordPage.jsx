import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faEye, faEyeSlash, faCircleCheck, faCircleExclamation, faArrowRight, faMobileScreenButton } from '@fortawesome/free-solid-svg-icons';
import { supabase } from '../config/supabase';
import '../App.css';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [dark] = useState(() => {
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
    if (!password) return t('reset.errEmpty');
    if (password.length < 8) return t('reset.errMin8');
    if (!/[A-Z]/.test(password)) return t('reset.errUppercase');
    if (!/[0-9]/.test(password)) return t('reset.errNumber');
    if (password !== confirmPassword) return t('reset.errNoMatch');
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
          setError(t('reset.errSamePassword'));
        } else {
          setError(updateError.message || t('reset.errUpdate'));
        }
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(t('reset.errGeneric'));
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
            <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 64 }} className="confirm-check-icon" />
          </div>
          <div className="confirm-paw">🔐</div>
          <h1 className="confirm-title">{t('reset.titleSuccess')}</h1>
          <p className="confirm-desc" dangerouslySetInnerHTML={{ __html: t('reset.descSuccess1') + '<br/>' + t('reset.descSuccess2') }} />
          <div className="confirm-steps">
            <div className="confirm-step">
              <div className="confirm-step-num">1</div>
              <span dangerouslySetInnerHTML={{ __html: t('reset.stepOpen') }} />
            </div>
            <div className="confirm-step">
              <div className="confirm-step-num">2</div>
              <span dangerouslySetInnerHTML={{ __html: t('reset.stepLogin') }} />
            </div>
          </div>
          <a href="/" className="confirm-home-btn">
            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 18 }} />
            {t('reset.goHome')}
          </a>
          <p className="confirm-footer-text">
            <FontAwesomeIcon icon={faMobileScreenButton} style={{ fontSize: 14 }} />
            {t('reset.canClose')}
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
            <FontAwesomeIcon icon={faCircleExclamation} size="4x" style={{ color: '#EF4444' }} />
          </div>
          <h1 className="confirm-title">{t('reset.invalidLink')}</h1>
          <p className="confirm-desc">
            {t('reset.invalidDesc')}
          </p>
          <a href="/" className="confirm-home-btn">
            <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 18 }} />
            {t('reset.backHome')}
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
          <p className="confirm-desc" style={{ marginTop: 20 }}>{t('reset.verifying')}</p>
        </div>
      </div>
    );
  }

  // Reset form
  return (
    <div className="confirm-page">
      <div className="confirm-card">
        <div className="confirm-icon-wrap" style={{ background: 'rgba(245, 166, 35, 0.1)' }}>
          <FontAwesomeIcon icon={faLock} style={{ fontSize: 48, color: '#F5A623' }} />
        </div>
        <div className="confirm-paw">🐾</div>
        <h1 className="confirm-title">{t('reset.title')}</h1>
        <p className="confirm-desc">
          {t('reset.desc')}
        </p>

        <form className="reset-form" onSubmit={handleSubmit}>
          <div className="reset-input-group">
            <label className="reset-label">{t('reset.newPassword')}</label>
            <div className="reset-input-wrap">
              <FontAwesomeIcon icon={faLock} style={{ fontSize: 18 }} className="reset-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="reset-input"
                placeholder={t('reset.placeholderMin')}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="reset-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FontAwesomeIcon icon={faEyeSlash} style={{ fontSize: 18 }} /> : <FontAwesomeIcon icon={faEye} style={{ fontSize: 18 }} />}
              </button>
            </div>
          </div>

          <div className="reset-input-group">
            <label className="reset-label">{t('reset.confirmPassword')}</label>
            <div className="reset-input-wrap">
              <FontAwesomeIcon icon={faLock} style={{ fontSize: 18 }} className="reset-input-icon" />
              <input
                type={showConfirm ? 'text' : 'password'}
                className="reset-input"
                placeholder={t('reset.placeholderRepeat')}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="reset-eye-btn"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <FontAwesomeIcon icon={faEyeSlash} style={{ fontSize: 18 }} /> : <FontAwesomeIcon icon={faEye} style={{ fontSize: 18 }} />}
              </button>
            </div>
          </div>

          {/* Password requirements */}
          <div className="reset-requirements">
            <div className={`reset-req ${password.length >= 8 ? 'met' : ''}`}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 14 }} /> {t('reset.reqMin8')}
            </div>
            <div className={`reset-req ${/[A-Z]/.test(password) ? 'met' : ''}`}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 14 }} /> {t('reset.reqUppercase')}
            </div>
            <div className={`reset-req ${/[0-9]/.test(password) ? 'met' : ''}`}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 14 }} /> {t('reset.reqNumber')}
            </div>
            <div className={`reset-req ${password && password === confirmPassword ? 'met' : ''}`}>
              <FontAwesomeIcon icon={faCircleCheck} style={{ fontSize: 14 }} /> {t('reset.reqMatch')}
            </div>
          </div>

          {error && (
            <div className="reset-error">
              <FontAwesomeIcon icon={faCircleExclamation} style={{ fontSize: 16 }} />
              {error}
            </div>
          )}

          <button
            type="submit"
            className="reset-submit-btn"
            disabled={loading}
          >
            {loading ? t('reset.saving') : t('reset.save')}
          </button>
        </form>
      </div>
    </div>
  );
}
