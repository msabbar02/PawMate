/**
 * Página de inicio de sesión del panel de administración.
 *
 * Renderiza un formulario controlado (email + contraseña) y delega la
 * autenticación en `AuthContext.login`. Muestra errores y redirige a la
 * raíz al autenticarse correctamente.
 */
import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldHalved, faLock, faUser, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import './LoginPage.css';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const { login } = useContext(AuthContext);
    const { t } = useTranslation();
    const navigate = useNavigate();

    /**
     * Envía credenciales al backend de autenticación y navega al dashboard
     * en caso de éxito; en caso contrario muestra el mensaje de error.
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoggingIn(true);
        const result = await login(email, password);
        if (result.success) {
            navigate('/');
        } else {
            setError(result.message || t('login.errorDefault'));
        }
        setIsLoggingIn(false);
    };

    return (
        <div className="login-container">
            <div className="login-card glass-panel">
                <div className="login-header">
                    <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: 48 }} className="login-icon" />
                    <h1>{t('login.title')}</h1>
                    <p>{t('login.subtitle')}</p>
                </div>
                
                {error && <div className="login-error">{error}</div>}
                
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-group">
                        <FontAwesomeIcon icon={faUser} style={{ fontSize: 20 }} className="input-icon" />
                        <input 
                            type="email" 
                            placeholder={t('login.emailPlaceholder')} 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    
                    <div className="input-group">
                        <FontAwesomeIcon icon={faLock} style={{ fontSize: 20 }} className="input-icon" />
                        <input 
                            type={showPassword ? "text" : "password"} 
                            placeholder={t('login.passwordPlaceholder')} 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button 
                            type="button" 
                            className="toggle-password-btn"
                            onClick={() => setShowPassword(!showPassword)}
                            title={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                        >
                            {showPassword ? <FontAwesomeIcon icon={faEyeSlash} style={{ fontSize: 18 }} /> : <FontAwesomeIcon icon={faEye} style={{ fontSize: 18 }} />}
                        </button>
                    </div>
                    
                    <button type="submit" className="login-button" disabled={isLoggingIn}>
                        {isLoggingIn ? t('login.loggingIn') : t('login.submit')}
                    </button>
                </form>
            </div>
        </div>
    );
}
